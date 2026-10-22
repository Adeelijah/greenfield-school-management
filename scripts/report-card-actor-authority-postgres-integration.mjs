// Explicit opt-in, local disposable PostgreSQL verification of the review draft.
// Never run against Supabase, staging, production, or an application database.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { awaitFixtureAuthorityLock, cleanupFixtureAuthority } from './lib/actor-authority-fixture-lifecycle.mjs';

const url = process.env.REPORT_CARD_TEST_DATABASE_URL;
const confirmed = process.env.REPORT_CARD_TEST_CONFIRM === 'DISPOSABLE_REPORT_CARD_TEST_ONLY';
const roleAdminConfirmed = process.env.REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM === 'DISPOSABLE_ROLE_ADMIN_TEST_ONLY';
if (!url || !confirmed || !roleAdminConfirmed) {
  console.error('SKIPPED: local disposable URL plus both explicit test and role-admin confirmations are required.');
  process.exitCode = 2;
} else {
  const parsed = new URL(url);
  const disposableName = decodeURIComponent(parsed.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
    !/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(disposableName)) {
    throw Error('Only the named local disposable report-card database is permitted.');
  }

  const db = postgres(url, { max: 4, connect_timeout: 5, prepare: false, onnotice: () => {} });
  const suffix = randomBytes(8).toString('hex');
  const schema = `rc_auth_${suffix}`;
  const ownerRole = `gf_rc_auth_owner_${suffix}`;
  const runtimeRole = `gf_rc_auth_runtime_${suffix}`;
  const q = value => '"' + value.replaceAll('"', '""') + '"';
  const t = name => `${q(schema)}.${q(name)}`;
  const owner = q(ownerRole), runtime = q(runtimeRole);
  const created = { schema: false, owner: false, runtime: false };
  let held, heldSuspension, workloadError;
  let holdingResolve;
  let lockedResolve;
  let suspensionResolve;
  let suspensionLockedResolve;
  const holdingGate = new Promise(resolve => { holdingResolve = resolve; });
  const lockedGate = new Promise(resolve => { lockedResolve = resolve; });
  const suspensionGate = new Promise(resolve => { suspensionResolve = resolve; });
  const suspensionLockedGate = new Promise(resolve => { suspensionLockedResolve = resolve; });
  const proposal = await readFile(new URL('../docs/security/REPORT_CARD_ACTOR_AUTHORITY_REVIEW.sql', import.meta.url), 'utf8');

  function functionDefinition(name, signature) {
    const start = proposal.indexOf(`CREATE FUNCTION public.${name}(`);
    const end = proposal.indexOf(`ALTER FUNCTION public.${signature}`, start);
    if (start < 0 || end < 0) throw Error(`Review function ${name} not found.`);
    return proposal.slice(start, end)
      .replaceAll('public.', `${q(schema)}.`)
      .replaceAll('greenfield_report_card_authority_owner', ownerRole)
      .trim();
  }

  async function localActor(authUserId) {
    return db.begin(async tx => {
      await tx.unsafe(`SET LOCAL ROLE ${runtime}`);
      return tx.unsafe(`SELECT * FROM ${t('lock_report_card_actor')}($1::uuid)`, [authUserId]);
    });
  }

  const authUserId = randomUUID();
  const userId = randomUUID();
  const schoolA = randomUUID();
  const schoolB = randomUUID();
  const schoolC = randomUUID();
  const membershipA = randomUUID();
  const membershipB = randomUUID();
  const membershipC = randomUUID();
  try {
    await db.unsafe(`CREATE ROLE ${owner} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION`);
    created.owner = true;
    await db.unsafe(`CREATE ROLE ${runtime} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION`);
    created.runtime = true;
    await db.unsafe(`CREATE SCHEMA ${q(schema)}`);
    created.schema = true;
    await db.unsafe(`GRANT USAGE ON SCHEMA ${q(schema)} TO ${owner},${runtime}`);
    await db.unsafe(`CREATE TABLE ${t('schools')} (id uuid PRIMARY KEY,final_primary_year integer NOT NULL)`);
    await db.unsafe(`CREATE TABLE ${t('school_users')} (id uuid PRIMARY KEY,auth_user_id uuid NOT NULL UNIQUE,display_name text NOT NULL)`);
    await db.unsafe(`CREATE TABLE ${t('memberships')} (id uuid PRIMARY KEY,school_id uuid NOT NULL,user_id uuid NOT NULL,role text NOT NULL,status text NOT NULL,UNIQUE(school_id,user_id))`);

    for (const name of ['schools', 'school_users', 'memberships']) {
      await db.unsafe(`ALTER TABLE ${t(name)} ENABLE ROW LEVEL SECURITY`);
      await db.unsafe(`ALTER TABLE ${t(name)} FORCE ROW LEVEL SECURITY`);
      await db.unsafe(`CREATE POLICY setup_owner ON ${t(name)} FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true)`);
      await db.unsafe(`CREATE POLICY owner_read_${name} ON ${t(name)} FOR SELECT TO ${owner} USING (true)`);
      await db.unsafe(`CREATE POLICY owner_lock_${name} ON ${t(name)} FOR UPDATE TO ${owner} USING (true) WITH CHECK (false)`);
      await db.unsafe(`GRANT SELECT ON ${t(name)} TO ${owner}`);
      await db.unsafe(`GRANT UPDATE (id) ON ${t(name)} TO ${owner}`);
    }
    await db.unsafe(`CREATE POLICY fixed_school_membership_read ON ${t('memberships')} FOR SELECT TO ${runtime} USING (school_id='${schoolA}'::uuid)`);
    await db.unsafe(`GRANT USAGE ON SCHEMA ${q(schema)} TO ${runtime}`);
    await db.unsafe(`GRANT SELECT ON ${t('memberships')} TO ${runtime}`);

    await db.unsafe(functionDefinition('lock_report_card_actor', 'lock_report_card_actor(uuid)'));
    await db.unsafe(`ALTER FUNCTION ${t('lock_report_card_actor')}(uuid) OWNER TO ${owner}`);
    await db.unsafe(`REVOKE ALL ON FUNCTION ${t('lock_report_card_actor')}(uuid) FROM PUBLIC`);
    await db.unsafe(`GRANT EXECUTE ON FUNCTION ${t('lock_report_card_actor')}(uuid) TO ${runtime}`);
    await db.unsafe(functionDefinition('lock_report_card_membership_actor_anchor', 'lock_report_card_membership_actor_anchor()'));
    await db.unsafe(`ALTER FUNCTION ${t('lock_report_card_membership_actor_anchor')}() OWNER TO ${owner}`);
    await db.unsafe(`REVOKE ALL ON FUNCTION ${t('lock_report_card_membership_actor_anchor')}() FROM PUBLIC`);
    await db.unsafe(`CREATE TRIGGER membership_actor_anchor BEFORE INSERT OR UPDATE OR DELETE ON ${t('memberships')} FOR EACH ROW EXECUTE FUNCTION ${t('lock_report_card_membership_actor_anchor')}()`);

    await db.unsafe(`INSERT INTO ${t('schools')} VALUES ($1::uuid,5),($2::uuid,6),($3::uuid,5)`, [schoolA, schoolB, schoolC]);
    await db.unsafe(`INSERT INTO ${t('school_users')} VALUES ($1::uuid,$2::uuid,'Fictional QA actor')`, [userId, authUserId]);
    await db.unsafe(`INSERT INTO ${t('memberships')} VALUES ($1::uuid,$2::uuid,$3::uuid,'teacher','active'),($4::uuid,$5::uuid,$3::uuid,'teacher','active')`, [membershipA, schoolA, userId, membershipB, schoolB]);

    const visible = await db.begin(async tx => {
      await tx.unsafe(`SET LOCAL ROLE ${runtime}`);
      return tx.unsafe(`SELECT id FROM ${t('memberships')} WHERE user_id=$1::uuid`, [userId]);
    });
    assert.equal(visible.length, 1, 'fixed-school RLS must hide the second active membership in this fixture');
    assert.equal((await localActor(authUserId)).length, 0, 'complete authority lookup must reject the hidden second active membership');
    console.log('PASS: fixed-school RLS exposes one row while complete actor lookup rejects two active schools');

    await db.unsafe(`UPDATE ${t('memberships')} SET status='suspended' WHERE id=$1::uuid`, [membershipB]);
    const oneActive = await localActor(authUserId);
    assert.equal(oneActive.length, 1);
    assert.equal(oneActive[0].membership_id, membershipA);
    assert.equal(oneActive[0].active_membership_count, 1);
    console.log('PASS: one active membership plus a suspended historical membership resolves exactly once');

    held = db.begin(async tx => {
      await tx.unsafe("SET LOCAL statement_timeout='10s'");
      await tx.unsafe(`SET LOCAL ROLE ${runtime}`);
      const rows = await tx.unsafe(`SELECT * FROM ${t('lock_report_card_actor')}($1::uuid)`, [authUserId]);
      assert.equal(rows.length, 1);
      lockedResolve();
      await holdingGate;
    });
    await awaitFixtureAuthorityLock(held, lockedGate);
    await assert.rejects(db.begin(async tx => {
      await tx.unsafe(`SET LOCAL lock_timeout='200ms'`);
      await tx.unsafe(`INSERT INTO ${t('memberships')} VALUES ($1::uuid,$2::uuid,$3::uuid,'teacher','active')`, [membershipC, schoolC, userId]);
    }), error => error.code === '55P03');
    holdingResolve();
    await held;
    await db.unsafe(`INSERT INTO ${t('memberships')} VALUES ($1::uuid,$2::uuid,$3::uuid,'teacher','active')`, [membershipC, schoolC, userId]);
    assert.equal((await localActor(authUserId)).length, 0, 'a committed concurrent membership must invalidate later authority resolution');
    console.log('PASS: concurrent membership insertion waits on the actor anchor and later ambiguity is denied');

    await db.unsafe(`UPDATE ${t('memberships')} SET status='suspended' WHERE id=$1::uuid`, [membershipC]);
    heldSuspension = db.begin(async tx => {
      await tx.unsafe("SET LOCAL statement_timeout='10s'");
      await tx.unsafe(`SET LOCAL ROLE ${runtime}`);
      const rows = await tx.unsafe(`SELECT * FROM ${t('lock_report_card_actor')}($1::uuid)`, [authUserId]);
      assert.equal(rows.length, 1);
      suspensionLockedResolve();
      await suspensionGate;
    });
    await awaitFixtureAuthorityLock(heldSuspension, suspensionLockedGate);
    // Use PostgreSQL's lock timeout as deterministic evidence that authority
    // cannot be suspended while a report transaction retains its membership lock.
    await assert.rejects(db.begin(async tx => {
      await tx.unsafe(`SET LOCAL lock_timeout='200ms'`);
      await tx.unsafe(`UPDATE ${t('memberships')} SET status='suspended' WHERE id=$1::uuid`, [membershipA]);
    }), error => error.code === '55P03');
    suspensionResolve();
    await heldSuspension;
    await db.unsafe(`UPDATE ${t('memberships')} SET status='suspended' WHERE id=$1::uuid`, [membershipA]);
    assert.equal((await localActor(authUserId)).length, 0, 'later requests must lose access after membership suspension');
    console.log('PASS: membership suspension is serialized and subsequent authority resolution denies');
  } catch (error) {
    workloadError = error;
    throw error;
  } finally {
    holdingResolve?.();
    suspensionResolve?.();
    // Release and drain every holder before attempting schema/role cleanup.
    await Promise.allSettled([held, heldSuspension].filter(Boolean));
    try {
      await cleanupFixtureAuthority(db, {schema, ownerRole, runtimeRole}, created);
    } catch (cleanupError) {
      if (workloadError) throw new AggregateError([workloadError, cleanupError], 'Authority workload and cleanup failed');
      throw cleanupError;
    } finally { await db.end(); }
  }
  console.log('PASS: exact generated fixture schema and role cleanup completed');
}

