// Opt-in generated LOGIN probes. No application request/SDK/production connection.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { disposableLoginURL, inspectDisposableLogin } from './disposable-login-plan.mjs';
import { disposableSessionRendezvous } from './disposable-session-rendezvous.mjs';
import { awaitFixtureAuthorityLock } from './actor-authority-fixture-lifecycle.mjs';
import { reportUpgradeSecurityPlan, inspectUpgradeSecurityLayout } from './report-card-upgrade-security-plan.mjs';
import { upgradeLoginSetupPlan } from './report-card-upgrade-login-plan.mjs';
import { upgradeFixtureSchema } from './report-card-upgrade-plan.mjs';

export async function probeUpgradeLogin(db, adminURL, schema, schoolId, userId, memberId, authorityReview, onCommitted) {
  const q = upgradeFixtureSchema(schema), table = name => q + '."' + name + '"';
  const databaseName = decodeURIComponent(new URL(adminURL).pathname.slice(1));
  const password = randomBytes(32).toString('hex');
  const login = upgradeLoginSetupPlan(schema, databaseName, password);
  const security = reportUpgradeSecurityPlan(schema, schoolId, authorityReview);
  const foreignSchool = randomUUID(), foreignStudent = randomUUID(), foreignMembership = randomUUID();
  let authId, setupRole;
  try { await db.begin(async tx => {
    assert.deepEqual(inspectUpgradeSecurityLayout(security, await tx.unsafe(security.layoutQuery, security.layoutParameters)), { ok: true });
    setupRole = (await tx.unsafe('SELECT current_user AS role'))[0].role;
    const actor = await tx.unsafe('SELECT auth_user_id FROM ' + table('school_users') + ' WHERE id=$1::uuid', [userId]);
    assert.equal(actor.length, 1); authId = actor[0].auth_user_id;
    await tx.unsafe('UPDATE ' + table('schools') + ' SET final_primary_year=5 WHERE id=$1::uuid', [schoolId]);
    await tx.unsafe('INSERT INTO ' + table('schools') + " (id,name,slug,final_primary_year) VALUES ($1,'Login foreign fixture','login-foreign',5)", [foreignSchool]);
    await tx.unsafe('INSERT INTO ' + table('students') + " (id,school_id,admission_number,first_name,last_name) VALUES ($1,$2,'LOGIN-FOREIGN','Foreign','Fixture')", [foreignStudent, foreignSchool]);
    for (const statement of [...security.statements, ...login.statements]) await tx.unsafe(statement);
  }); } catch (error) {
    // Setup can contain CREATE ROLE password text; do not surface driver query
    // objects or connection details. A bounded SQLSTATE is sufficient here.
    const code = typeof error?.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? ' (' + error.code + ')' : '';
    throw Error('Upgraded LOGIN setup failed' + code + '; connection/query details suppressed');
  }
  // Outer harness now owns cleanup of this exact committed role set and schema.
  onCommitted();
  const restricted = postgres(disposableLoginURL(adminURL, schema, password), { max: 2, prepare: false, connect_timeout: 5, connection: { search_path: 'pg_catalog' }, onnotice: () => {} });
  const role = async () => (await restricted.unsafe('SELECT current_user AS role'))[0].role;
  const asRole = (name, work) => restricted.begin(async tx => {
    await tx.unsafe('SET LOCAL ROLE "' + name + '"');
    await tx.unsafe("SET LOCAL statement_timeout='5s'");
    assert.equal((await tx.unsafe('SELECT current_user AS role'))[0].role, name);
    return work(tx);
  });
  const denied = work => assert.rejects(work, error => error.code === '42501');
  const complete = () => asRole(security.roles.writer, tx => tx.unsafe('SELECT * FROM ' + table('lock_report_card_actor') + '($1::uuid)', [authId]));
  try {
    assert.equal(inspectDisposableLogin(schema, await db.unsafe(login.query, login.parameters)), true);
    try {
      const evidence = (await restricted.unsafe('SELECT session_user AS login,current_user AS role'))[0];
      assert.equal(evidence.login, login.login); assert.equal(evidence.role, login.login);
    } catch { throw Error('Upgraded LOGIN authentication/evidence failed; connection details suppressed'); }
    await denied(() => restricted.unsafe('SELECT id FROM ' + table('schools')));
    for (const name of [setupRole, security.roles.authorityOwner]) await denied(() => restricted.begin(tx => tx.unsafe('SET LOCAL ROLE "' + name.replaceAll('"', '""') + '"')));
    await denied(() => asRole(security.roles.writer, tx => tx.unsafe('GRANT "' + security.roles.writer + '" TO "' + login.login + '" WITH ADMIN TRUE')));
    console.log('PASS: upgraded generated LOGIN has no inherited data, owner/administrator role switch or membership administration');

    for (const name of [security.roles.reader, security.roles.writer]) {
      await asRole(name, async tx => {
        assert.equal((await tx.unsafe('SELECT id FROM ' + table('schools') + ' WHERE id=$1::uuid', [schoolId])).length, 1);
        assert.equal((await tx.unsafe('SELECT id FROM ' + table('students') + ' WHERE id=$1::uuid', [foreignStudent])).length, 0);
      });
      for (const excluded of security.excludedRuntimeTables) await denied(() => asRole(name, tx => tx.unsafe('SELECT * FROM ' + table(excluded))));
      await denied(() => asRole(name, tx => tx.unsafe('SELECT ' + table('fixture_mark_source_scope') + '($1::uuid)', [randomUUID()])));
    }
    await denied(() => asRole(security.roles.reader, tx => tx.unsafe('SELECT * FROM ' + table('lock_report_card_actor') + '($1::uuid)', [authId])));
    await denied(() => asRole(security.roles.writer, tx => tx.unsafe('ALTER TABLE ' + table('report_cards') + ' DISABLE ROW LEVEL SECURITY')));
    await denied(() => asRole(security.roles.writer, async tx => {
      await tx.unsafe('RESET ROLE');
      assert.equal((await tx.unsafe('SELECT current_user AS role'))[0].role, login.login);
      await tx.unsafe('SELECT id FROM ' + table('schools'));
    }));
    assert.equal(await role(), login.login);
    console.log('PASS: upgraded LOGIN service roles preserve school RLS and private helpers; RESET ROLE returns to the unprivileged login');

    const barrier = disposableSessionRendezvous(security.roles.writer);
    try {
      const results = await Promise.allSettled([0, 1].map(() => asRole(security.roles.writer, async tx => {
        const session = (await tx.unsafe('SELECT pg_catalog.pg_backend_pid() AS pid,current_user AS role'))[0];
        await barrier.arrive(session.pid, session.role);
        const rows = await tx.unsafe('SELECT * FROM ' + table('lock_report_card_actor') + '($1::uuid)', [authId]);
        assert.equal(rows.length, 1); assert.equal(rows[0].school_id, schoolId); assert.equal(rows[0].membership_id, memberId);
        return session.pid;
      })));
      for (const result of results) if (result.status === 'rejected') throw result.reason;
      assert.notEqual(results[0].value, results[1].value);
    } finally { barrier.cancel(); }
    console.log('PASS: two distinct upgraded LOGIN sessions resolve complete authority under the exact writer role');

    await db.unsafe('INSERT INTO ' + table('memberships') + " (id,school_id,user_id,role) VALUES ($1,$2,$3,'admin')", [foreignMembership, foreignSchool, userId]);
    const visible = await asRole(security.roles.writer, tx => tx.unsafe('SELECT id FROM ' + table('memberships') + " WHERE user_id=$1::uuid AND status='active'", [userId]));
    assert.equal(visible.length, 1); assert.equal((await complete()).length, 0);
    await db.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [foreignMembership]);
    assert.equal((await complete()).length, 1);
    console.log('PASS: upgraded LOGIN cannot hide a second active membership from the complete resolver and suspended history recovers');

    let release, signal;
    const ready = new Promise(resolve => { signal = resolve; });
    const hold = new Promise(resolve => { release = resolve; });
    const holder = asRole(security.roles.writer, async tx => {
      assert.equal((await tx.unsafe('SELECT * FROM ' + table('lock_report_card_actor') + '($1::uuid)', [authId])).length, 1);
      signal(); await hold;
    });
    try {
      await awaitFixtureAuthorityLock(holder, ready);
      await assert.rejects(db.begin(async tx => {
        await tx.unsafe("SET LOCAL lock_timeout='200ms'");
        await tx.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [memberId]);
      }), error => error.code === '55P03');
    } finally { release(); await holder; }
    await db.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [memberId]);
    assert.equal((await complete()).length, 0);
    await db.unsafe('UPDATE ' + table('memberships') + " SET status='active' WHERE id=$1::uuid", [memberId]);
    assert.equal((await complete()).length, 1);
    console.log('PASS: upgraded LOGIN authority locks block suspension before discovery and later requests recheck committed membership');
  } finally { await restricted.end(); }
}
