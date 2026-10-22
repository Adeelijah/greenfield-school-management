// Called only by the explicitly opted-in local disposable role-admin harness.
// Transactional SET LOCAL role probes, not a generated LOGIN or SDK auth test.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { reportUpgradeSecurityPlan, inspectUpgradeSecurityLayout } from './report-card-upgrade-security-plan.mjs';
import { inspectFixtureRestrictedRoles } from './assessment-disposable-role-preflight.mjs';
import { upgradeFixtureSchema } from './report-card-upgrade-plan.mjs';

export async function probeUpgradeSecurity(db, schema, schoolId, userId, authorityReview) {
  const q = upgradeFixtureSchema(schema), table = name => q + '."' + name + '"';
  const plan = reportUpgradeSecurityPlan(schema, schoolId, authorityReview);
  const rollback = Error('Intentional upgraded security rollback');
  await assert.rejects(db.begin(async tx => {
    const layout = await tx.unsafe(plan.layoutQuery, plan.layoutParameters);
    assert.deepEqual(inspectUpgradeSecurityLayout(plan, layout), { ok: true });
    const actor = await tx.unsafe('SELECT auth_user_id FROM ' + table('school_users') + ' WHERE id=$1::uuid', [userId]);
    assert.equal(actor.length, 1);
    const foreignSchool = randomUUID(), foreignStudent = randomUUID(), foreignMembership = randomUUID();
    // Fixture setup precedes security/helper reads. No real identities or data.
    await tx.unsafe('INSERT INTO ' + table('schools') + " (id,name,slug,final_primary_year) VALUES ($1,'Foreign fixture','security-foreign',5)", [foreignSchool]);
    await tx.unsafe('INSERT INTO ' + table('students') + " (id,school_id,admission_number,first_name,last_name) VALUES ($1,$2,'FOREIGN-1','Foreign','Fixture')", [foreignStudent, foreignSchool]);
    for (const statement of plan.statements) await tx.unsafe(statement);
    // Acquire the installed exclusive protocol before any complete actor reads.
    // This one setup transaction is not a report concurrency/arrival-order test.
    await tx.unsafe('UPDATE ' + table('schools') + ' SET final_primary_year=5 WHERE id=$1::uuid', [schoolId]);
    const roles = await tx.unsafe(plan.rolePreflight.query, plan.rolePreflight.parameters);
    assert.equal(inspectFixtureRestrictedRoles(schema, roles).ok, true);
    const rls = await tx.unsafe(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r'`, [schema]);
    for (const name of plan.rlsTargets) assert.ok(rls.some(row => row.relname === name && row.relrowsecurity && row.relforcerowsecurity), name);
    console.log('PASS: upgraded security installs three generated roles and forced school RLS after guarded-layout and leaf-role preflight');

    const asRole = (role, work) => tx.savepoint(async scoped => {
      await scoped.unsafe('SET LOCAL ROLE "' + role + '"');
      const current = await scoped.unsafe('SELECT current_user AS role'); assert.equal(current[0].role, role);
      const result = await work(scoped);
      await scoped.unsafe('RESET ROLE');
      return result;
    });
    const denied = work => assert.rejects(work, error => error.code === '42501');
    for (const role of [plan.roles.reader, plan.roles.writer]) {
      await asRole(role, async scoped => {
        assert.equal((await scoped.unsafe('SELECT id FROM ' + table('students') + ' WHERE id=$1::uuid', [foreignStudent])).length, 0);
        assert.equal((await scoped.unsafe('SELECT id FROM ' + table('schools') + ' WHERE id=$1::uuid', [schoolId])).length, 1);
      });
      for (const name of plan.excludedRuntimeTables) await denied(() => asRole(role, scoped => scoped.unsafe('SELECT * FROM ' + table(name))));
      await denied(() => asRole(role, scoped => scoped.unsafe('SELECT ' + table('fixture_mark_source_scope') + '($1::uuid)', [randomUUID()])));
    }
    await denied(() => asRole(plan.roles.reader, scoped => scoped.unsafe('UPDATE ' + table('students') + ' SET id=id WHERE false')));
    await denied(() => asRole(plan.roles.writer, scoped => scoped.unsafe('UPDATE ' + table('assessment_scores') + ' SET id=id WHERE false')));
    await denied(() => asRole(plan.roles.writer, scoped => scoped.unsafe('UPDATE ' + table('report_card_snapshots') + ' SET id=id WHERE false')));
    console.log('PASS: upgraded reader/writer roles hide foreign rows and deny legacy-module, revision-helper, academic and immutable mutations');

    await denied(() => asRole(plan.roles.reader, scoped => scoped.unsafe('SELECT * FROM ' + table('lock_report_card_actor') + '($1::uuid)', [actor[0].auth_user_id])));
    const complete = () => asRole(plan.roles.writer, scoped => scoped.unsafe('SELECT * FROM ' + table('lock_report_card_actor') + '($1::uuid)', [actor[0].auth_user_id]));
    const initial = await complete(); assert.equal(initial.length, 1);
    assert.equal(initial[0].active_membership_count, 1); assert.equal(initial[0].school_id, schoolId);
    await tx.unsafe('INSERT INTO ' + table('memberships') + " (id,school_id,user_id,role) VALUES ($1,$2,$3,'admin')", [foreignMembership, foreignSchool, userId]);
    const visible = await asRole(plan.roles.writer, scoped => scoped.unsafe('SELECT id FROM ' + table('memberships') + " WHERE user_id=$1::uuid AND status='active'", [userId]));
    assert.equal(visible.length, 1);
    assert.equal((await complete()).length, 0, 'complete helper must reject two active schools hidden by service RLS');
    await tx.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [foreignMembership]);
    assert.equal((await complete()).length, 1);
    console.log('PASS: upgraded complete resolver rejects a hidden second active membership, accepts suspended history and denies reader helper access');
    throw rollback;
  }), error => error === rollback);
  const remaining = await db.unsafe('SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ($1::text,$2::text,$3::text)', Object.values(plan.roles));
  assert.equal(remaining.length, 0);
  const helper = await db.unsafe(`SELECT p.proname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=$1 AND p.proname='lock_report_card_actor'`, [schema]);
  assert.equal(helper.length, 0);
  const policies = await db.unsafe('SELECT policyname FROM pg_catalog.pg_policies WHERE schemaname=$1', [schema]);
  assert.equal(policies.length, 0);
  console.log('PASS: upgraded role, policy, helper and workload installation rolls back without persistent security roles');
}
