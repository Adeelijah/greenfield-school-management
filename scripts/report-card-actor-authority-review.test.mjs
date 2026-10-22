import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../docs/security/REPORT_CARD_ACTOR_AUTHORITY_REVIEW.sql', import.meta.url), 'utf8');
const bridge = await readFile(new URL('../src/server/auth/report-card-identity.ts', import.meta.url), 'utf8');

test('review draft RPC accepts no client identity and derives its actor from Supabase auth.uid()', () => {
  assert.match(sql, /CREATE FUNCTION public\.resolve_report_card_actor\(\)/);
  assert.match(sql, /verified_auth_id uuid := auth\.uid\(\)/);
  assert.match(bridge, /supabase\.rpc\('resolve_report_card_actor'\)/);
  assert.doesNotMatch(bridge, /rpc\('resolve_report_card_actor'\s*,/);
  assert.match(bridge, /supabase\.auth\.getUser\(\)/);
});

test('complete active-membership count is actor-wide and ambiguity returns no authority row', () => {
  assert.match(sql, /SELECT count\(\*\)::integer INTO active_count[\s\S]*?FROM public\.memberships m[\s\S]*?WHERE m\.user_id = actor_user_id AND m\.status = 'active'/);
  assert.match(sql, /IF active_count <> 1 THEN RETURN; END IF;/);
  assert.doesNotMatch(sql.slice(sql.indexOf('CREATE FUNCTION public.resolve_report_card_actor()'), sql.indexOf('ALTER FUNCTION public.resolve_report_card_actor()')), /m\.school_id\s*=/);
});

test('function owner is non-login and non-bypass with narrowly granted complete-read policies', () => {
  assert.match(sql, /CREATE ROLE greenfield_report_card_authority_owner[\s\S]*?NOLOGIN NOSUPERUSER NOBYPASSRLS/);
  for (const table of ['school_users', 'memberships', 'schools']) {
    assert.match(sql, new RegExp(`CREATE POLICY report_card_authority_owner_read_${table}[\\s\\S]*?ON public\\.${table} FOR SELECT[\\s\\S]*?TO greenfield_report_card_authority_owner USING \\(true\\)`));
  }
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.resolve_report_card_actor\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.resolve_report_card_actor\(\) TO authenticated/);
});

test('transaction resolver locks actor, all membership rows and school before returning authority', () => {
  // Git can check out the SQL as CRLF on Windows. Exercise both forms and
  // normalize only line endings; retain the exact required lock clauses/order.
  for (const ending of ['\n', '\r\n']) {
    const source = sql.replace(/\r?\n/g, ending);
    const lock = source.slice(source.indexOf('CREATE FUNCTION public.lock_report_card_actor('), source.indexOf('ALTER FUNCTION public.lock_report_card_actor(')).replace(/\r\n/g, '\n');
    const anchorClause = 'WHERE su.auth_user_id = p_verified_auth_user_id\n  FOR UPDATE';
    const membershipClause = 'WHERE m.user_id = actor_user_id ORDER BY m.id FOR SHARE';
    const anchorLock = lock.indexOf(anchorClause);
    const membershipLock = lock.indexOf(membershipClause);
    const activeCount = lock.indexOf("WHERE m.user_id = actor_user_id AND m.status = 'active'");
    assert.ok(anchorLock >= 0 && membershipLock > anchorLock && activeCount > membershipLock);
    assert.match(lock, /WHERE s\.id = active_school_id FOR SHARE/);
  }
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.lock_report_card_actor\(uuid\) FROM PUBLIC, anon, authenticated/);
});

test('membership insert/update/delete serializes through the school-user actor anchor', () => {
  assert.match(sql, /CREATE TRIGGER report_card_membership_actor_anchor\s+BEFORE INSERT OR UPDATE OR DELETE ON public\.memberships/);
  const trigger = sql.slice(sql.indexOf('CREATE FUNCTION public.lock_report_card_membership_actor_anchor()'), sql.indexOf('ALTER FUNCTION public.lock_report_card_membership_actor_anchor()'));
  assert.match(trigger, /TG_OP = 'INSERT'[\s\S]*?WHERE su\.id = NEW\.user_id FOR UPDATE/);
  assert.match(trigger, /TG_OP = 'DELETE'[\s\S]*?WHERE su\.id = OLD\.user_id FOR UPDATE/);
  assert.match(trigger, /ORDER BY su\.id FOR UPDATE/);
});

test('server bridge is server-only, fails closed, and refreshes authority inside the supplied transaction', () => {
  assert.match(bridge, /^import 'server-only';/);
  assert.match(bridge, /if \(authError \|\| !auth\.user\?\.id\) return null/);
  assert.match(bridge, /if \(error\) return null/);
  assert.match(bridge, /lock_report_card_actor\(\$\{verifiedIdentity\.authUserId\}::uuid\)/);
  assert.match(bridge, /decodeReportCardActorAuthority\(verifiedIdentity\.authUserId, transactionRows\(result\)\)/);
  assert.match(bridge, /and teacher_membership_id = \$\{authority\.membershipId\}::uuid[\s\S]*and class_id = \$\{classId\}::uuid[\s\S]*and session_id = \$\{sessionId\}::uuid[\s\S]*and ended_at is null[\s\S]*for share/);
  assert.doesNotMatch(bridge, /export async function resolveVerifiedReportCardIdentity\([^)]/);
});



test('both authority resolvers acquire the shared statement gate before actor reads', () => {
  for (const name of ['resolve_report_card_actor', 'lock_report_card_actor']) {
    const body = sql.slice(sql.indexOf('CREATE FUNCTION public.' + name + '('), sql.indexOf('ALTER FUNCTION public.' + name + '('));
    const gate = body.indexOf("pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1', 0))");
    assert.ok(gate >= 0 && gate < body.indexOf('SELECT su.id INTO actor_user_id'));
  }
});

test('authority writers gate before row discovery on every parent and assignment table', () => {
  for (const table of ['school_users', 'memberships', 'schools', 'teacher_class_assignments']) {
    assert.match(sql, new RegExp('BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public\\.' + table + '\\s+FOR EACH STATEMENT EXECUTE FUNCTION public\\.lock_report_card_authority_write_gate\\(\\)'));
  }
  const body = sql.slice(sql.indexOf('CREATE FUNCTION public.lock_report_card_authority_write_gate()'), sql.indexOf('ALTER FUNCTION public.lock_report_card_authority_write_gate()'));
  assert.match(body, /pg_catalog\.pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('greenfield\.report-card\.authority-gate\.v1', 0\)\)/);
});

test('statement gate rejects truncate and exposes no callable privileged helper to app roles', () => {
  const body = sql.slice(sql.indexOf('CREATE FUNCTION public.lock_report_card_authority_write_gate()'), sql.indexOf('ALTER FUNCTION public.lock_report_card_authority_write_gate()'));
  assert.match(body, /TG_OP = 'TRUNCATE'[\s\S]*?RAISE EXCEPTION[\s\S]*?ERRCODE='P0001'/);
  assert.match(body, /SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog[\s\S]*?SET row_security = on/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.lock_report_card_authority_write_gate\(\) FROM PUBLIC, anon, authenticated/);
});
