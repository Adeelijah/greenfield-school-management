// SQL text/semantic port inspection only. No driver, environment or SQL execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reportUpgradeGuardPlan } from './lib/report-card-upgrade-guards.mjs';

const sql = readFileSync(new URL('../docs/staging/REPORT_CARD_COORDINATED_GUARDS_REVIEW.sql', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const original = readFileSync(new URL('../docs/security/REPORT_CARD_ACTOR_AUTHORITY_REVIEW.sql', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const schema = 'rc_it_0123456789abcdef', plan = reportUpgradeGuardPlan(schema);
const names = {
  fixture_source_write_gate: 'assessment_source_write_gate', fixture_source_write_claims: 'assessment_source_write_claims',
  fixture_lock_source_write: 'assessment_lock_source_write', fixture_mark_source_scope: 'assessment_mark_source_scope',
  fixture_invalidate_source_rows: 'assessment_invalidate_source_rows', fixture_reject_source_truncate: 'assessment_reject_source_truncate',
  fixture_invalidate_parent_rows: 'assessment_invalidate_parent_rows', fixture_upgrade_reject_history: 'report_card_reject_history',
  fixture_guard_release_history: 'report_card_guard_release_history',
};
function sourceFunction(text, name, delimiter = '$$') {
  const start = text.indexOf('CREATE FUNCTION ' + name + '('), end = text.indexOf('END ' + delimiter, start);
  assert.ok(start >= 0 && end > start, name);
  return text.slice(start, end + ('END ' + delimiter).length).trim();
}
function authorityFunction(text, name) {
  const start = text.indexOf('CREATE FUNCTION public.' + name + '('), end = text.indexOf('ALTER FUNCTION public.' + name + '(', start);
  assert.ok(start >= 0 && end > start, name);
  return text.slice(start, end);
}

test('coordinated draft has one transaction and creates only the two protocol tables', () => {
  assert.equal((sql.match(/^BEGIN;$/gm) ?? []).length, 1); assert.equal((sql.match(/^COMMIT;$/gm) ?? []).length, 1);
  assert.deepEqual([...sql.matchAll(/^CREATE TABLE "public"\."([^"]+)"/gm)].map(match => match[1]), ['assessment_source_write_gate', 'assessment_source_write_claims']);
  assert.doesNotMatch(sql, /^\s*(?:DROP|TRUNCATE|ALTER ROLE|SET ROLE)\b/gm);
  const alters = sql.match(/^ALTER TABLE .*$/gm) ?? [];
  assert.equal(alters.length, 4);
  for (const line of alters) assert.match(line, /^ALTER TABLE public\.assessment_source_write_(?:gate|claims) (?:ENABLE|FORCE) ROW LEVEL SECURITY;$/);
  assert.doesNotMatch(sql, /IF NOT EXISTS|rc_it_|fixture_/);
  assert.match(sql, /not a complete migration/);
});

test('all seven source/history function bodies preserve the verified fixture semantics under explicit public names', () => {
  const functions = plan.statements.filter(statement => statement.startsWith('CREATE FUNCTION'));
  assert.equal(functions.length, 7);
  for (const definition of functions) {
    let port = definition.replaceAll('"' + schema + '"', '"public"').replaceAll("'" + schema + "'", "'public'");
    for (const [before, after] of Object.entries(names)) port = port.replaceAll(before, after);
    port = port.replaceAll('fixture', 'reviewed');
    const name = port.match(/^CREATE FUNCTION ([^(]+)\(/)[1];
    assert.equal(sourceFunction(sql, name), port.trim(), name);
  }
});

test('discovery and once-per-transaction revision claims precede dependent source discovery', () => {
  assert.ok(sql.indexOf('CREATE TABLE "public"."assessment_source_write_gate"') < sql.indexOf('CREATE TRIGGER'));
  const gate = sourceFunction(sql, '"public"."assessment_lock_source_write"');
  assert.match(gate, /WHERE id=1 FOR UPDATE/); assert.match(gate, /IF NOT FOUND THEN RAISE/);
  const mark = sourceFunction(sql, '"public"."assessment_mark_source_scope"');
  assert.match(mark, /pg_current_xact_id\(\)::text,target/);
  assert.match(mark, /ON CONFLICT DO NOTHING RETURNING scope_id INTO claimed/);
  assert.match(mark, /IF claimed IS NOT NULL THEN[\s\S]*revision=revision\+1/);
  assert.ok(mark.indexOf('ON CONFLICT') < mark.indexOf('revision=revision+1'));
  for (const name of [...plan.sourceTargets, 'assessment_scopes']) {
    assert.ok(sql.includes('CREATE TRIGGER assessment_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."' + name + '" FOR EACH STATEMENT'));
    assert.ok(sql.includes('BEFORE TRUNCATE ON "public"."' + name + '" FOR EACH STATEMENT'));
  }
  for (const name of plan.sourceTargets) assert.ok(sql.includes('AFTER INSERT OR UPDATE OR DELETE ON "public"."' + name + '" FOR EACH ROW'));
  assert.match(sql, /assessment_no_scope_delete BEFORE DELETE ON "public"\."assessment_scopes" FOR EACH STATEMENT/);
});

test('request RPC, command lock and authority writer take source before advisory discovery', () => {
  for (const name of ['resolve_report_card_actor', 'lock_report_card_actor', 'lock_report_card_authority_write_gate']) {
    const body = authorityFunction(sql, name);
    const source = body.indexOf('PERFORM id FROM public.assessment_source_write_gate');
    const advisory = body.indexOf('PERFORM pg_catalog.pg_advisory_xact_lock');
    assert.ok(source >= 0 && advisory > source, name);
    assert.match(body.slice(source, advisory), name.endsWith('write_gate') ? /FOR UPDATE/ : /FOR SHARE/);
    if (!name.endsWith('write_gate')) assert.ok(advisory < body.indexOf('FROM public.school_users'), name);
  }
  assert.doesNotMatch(authorityFunction(sql, 'resolve_report_card_actor').slice(0, 100), /p_verified/);
  assert.match(authorityFunction(sql, 'resolve_report_card_actor'), /verified_auth_id uuid := auth\.uid\(\)/);
});

test('statement authority gates cover zero-row writes and parent invalidation passes rows through', () => {
  for (const name of plan.authorityTargets) {
    assert.ok(sql.includes('BEFORE INSERT OR UPDATE OR DELETE ON "public"."' + name + '" FOR EACH STATEMENT'));
    assert.ok(sql.includes('BEFORE TRUNCATE ON "public"."' + name + '" FOR EACH STATEMENT'));
  }
  for (const name of ['school_users', 'memberships', 'schools', 'teacher_class_assignments']) assert.ok(sql.includes('BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.' + name));
  const parent = sourceFunction(sql, '"public"."assessment_invalidate_parent_rows"');
  assert.match(parent, /IF TG_OP='DELETE' THEN RETURN OLD; END IF;\n RETURN NEW;/);
  assert.match(parent, /ORDER BY s\.id/);
});

test('immutable history, finalized configuration and one-way release protection remain complete', () => {
  for (const name of plan.immutable) {
    assert.ok(sql.includes('BEFORE UPDATE OR DELETE ON "public"."' + name + '" FOR EACH STATEMENT'));
    assert.ok(sql.includes('BEFORE TRUNCATE ON "public"."' + name + '" FOR EACH STATEMENT'));
  }
  assert.match(sql, /FOR EACH ROW WHEN \(OLD\.state='finalized'\)/);
  const release = sourceFunction(sql, '"public"."report_card_guard_release_history"');
  assert.match(release, /to_jsonb\(NEW\)-'revoked_at'/);
  assert.match(release, /OLD\.revoked_at IS NOT NULL OR NEW\.revoked_at IS NULL/);
  assert.match(sql, /BEFORE DELETE ON "public"\."report_card_releases" FOR EACH STATEMENT/);
  assert.match(sql, /BEFORE TRUNCATE ON "public"\."report_card_releases" FOR EACH STATEMENT/);
});

test('helpers retain private EXECUTE and narrow gate owner access without runtime wiring', () => {
  assert.equal((sql.match(/^CREATE FUNCTION /gm) ?? []).length, 11);
  assert.equal((sql.match(/^REVOKE ALL ON FUNCTION /gm) ?? []).length, 22);
  assert.match(sql, /FROM PUBLIC, anon, authenticated, greenfield_app, greenfield_report_card_runtime;/);
  for (const name of ['assessment_source_write_gate', 'assessment_source_write_claims']) {
    assert.ok(sql.includes('ALTER TABLE public.' + name + ' FORCE ROW LEVEL SECURITY;'));
    assert.ok(sql.includes('CREATE POLICY report_card_protocol_setup_operator ON public.' + name));
  }
  assert.match(sql, /GRANT SELECT, UPDATE \(id\) ON public\.assessment_source_write_gate TO greenfield_report_card_authority_owner/);
  assert.match(sql, /FOR UPDATE TO greenfield_report_card_authority_owner USING \(id=1\) WITH CHECK \(false\)/);
  assert.match(sql, /^GRANT EXECUTE ON FUNCTION public\.resolve_report_card_actor\(\) TO authenticated;$/m);
  assert.doesNotMatch(sql, /^GRANT .*TO greenfield_report_card_runtime|^GRANT .*TO greenfield_app/gm);
  assert.doesNotMatch(sql, /GRANT .* ON ALL TABLES|CREATE ROLE greenfield_app|DISABLE ROW LEVEL SECURITY/);
});

test('LF and CRLF review text preserve authority bodies and leave the standalone draft unported', () => {
  const windows = sql.replaceAll('\n', '\r\n').replaceAll('\r\n', '\n');
  for (const name of ['resolve_report_card_actor', 'lock_report_card_actor', 'lock_report_card_authority_write_gate']) assert.equal(authorityFunction(windows, name), authorityFunction(sql, name));
  assert.doesNotMatch(original, /public\.assessment_source_write_gate/);
  assert.match(sql, /Source-derived 2026-10-23 from b8e9634204dc7d3e336c3c789f940c2949b72452/);
});
