import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingReportSecurityPlan } from './lib/report-card-staging-security-plan.mjs';
const config = { mode: 'isolated-staging-review', schema: 'public', schoolId: '00000000-0000-0000-0000-000000000001', sourceCommit: 'ead39921348a87f3625a14cb919214f4f95e274d' };
const plan = stagingReportSecurityPlan(config), sql = plan.statements.join(';\n');

test('policy fragment requires explicit staging mode, school UUID and full source revision', () => {
  for (const patch of [{ mode: 'production' }, { schema: 'rc_it_0123456789abcdef' }, { schoolId: "';DROP" }, { sourceCommit: 'main' }, { sourceCommit: null }]) assert.throws(() => stagingReportSecurityPlan({ ...config, ...patch }));
  assert.equal(Object.isFrozen(plan), true); assert.equal(Object.isFrozen(plan.statements), true);
  assert.equal(plan.requiresEffectivePrivilegeAudit, true);
});

test('fixed-school RLS clamps login and runtime on every selected relation without a session GUC', () => {
  assert.equal(plan.targets.length, 28);
  for (const name of plan.targets) {
    assert.ok(sql.includes('ALTER TABLE public."' + name + '" FORCE ROW LEVEL SECURITY'));
    assert.ok(sql.includes('CREATE POLICY report_card_fixed_school ON public."' + name + '" AS RESTRICTIVE FOR ALL TO greenfield_app,greenfield_report_card_runtime'));
  }
  assert.match(sql, /m\.user_id="school_users"\.id AND m\.school_id='00000000-0000-0000-0000-000000000001'::uuid/);
  assert.doesNotMatch(sql, /current_setting|set_config|auth\.uid/);
});

test('runtime privileges are reset only for the selected tables and no unrelated module grant is changed', () => {
  const revokes = plan.statements.filter(s => s.startsWith('REVOKE ALL ON TABLE'));
  assert.equal(revokes.length, 28);
  assert.ok(revokes.every(s => s.endsWith(' FROM greenfield_report_card_runtime')));
  for (const name of ['admissions', 'guardians', 'student_guardians', 'audit_events', 'student_departures', 'student_readmissions', 'student_lifecycle_decisions', 'assessment_source_write_claims']) assert.equal(plan.targets.includes(name), false);
  assert.doesNotMatch(sql, /ALL TABLES|ALL FUNCTIONS|ALL SEQUENCES|DROP POLICY|ALTER ROLE|CREATE ROLE/);
});

test('locking grants retain an independent statement guard against academic and immutable writes', () => {
  assert.equal(plan.statements.filter(s => s.startsWith('CREATE TRIGGER aaa_report_card_runtime_write_guard')).length, 28);
  assert.equal(plan.statements.filter(s => s.startsWith('CREATE TRIGGER aaa_report_card_runtime_truncate_guard')).length, 28);
  assert.match(sql, /GRANT UPDATE \(id\) ON public\."assessment_scores" TO greenfield_report_card_runtime/);
  assert.match(sql, /report runtime cannot mutate academic or immutable rows/);
  assert.match(sql, /FOR EACH STATEMENT EXECUTE FUNCTION public\.report_card_restrict_runtime_writes/);
  assert.match(sql, /current_user IN \('greenfield_app','anon','authenticated'\)/);
  assert.doesNotMatch(sql, /SECURITY DEFINER/);
});

test('report insert and transition privileges are column-bounded and preserve one-way release revocation', () => {
  assert.equal(plan.statements.filter(s => s.startsWith('GRANT INSERT')).length, 5);
  assert.deepEqual(plan.reportUpdates, ['stage', 'version', 'submitted_by', 'approved_by', 'published_at', 'return_reason', 'assessment_source_version_id', 'assessment_revision']);
  assert.match(sql, /GRANT UPDATE \(revoked_at\) ON public\.report_card_releases/);
  assert.match(sql, /AND revoked_at IS NOT NULL/);
  assert.doesNotMatch(sql, /GRANT (?:DELETE|TRUNCATE|ALL)/);
});

test('only the private actor helper is granted and the authority owner is unreachable through memberships', () => {
  assert.deepEqual(plan.statements.filter(s => s.startsWith('GRANT EXECUTE')), ['GRANT EXECUTE ON FUNCTION public.lock_report_card_actor(uuid) TO greenfield_report_card_runtime']);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.lock_report_card_actor\(uuid\) FROM PUBLIC,anon,authenticated,greenfield_app/);
  assert.equal(plan.statements.filter(s => /^GRANT greenfield_report_card_runtime TO greenfield_app WITH /.test(s)).length, 3);
  assert.doesNotMatch(sql, /GRANT greenfield_report_card_authority_owner|TO greenfield_report_card_authority_owner/);
});

test('role activation is last, after all clamps, guards and exact helper access', () => {
  assert.deepEqual(plan.statements.slice(-3), ['GRANT greenfield_report_card_runtime TO greenfield_app WITH SET TRUE', 'GRANT greenfield_report_card_runtime TO greenfield_app WITH INHERIT FALSE', 'GRANT greenfield_report_card_runtime TO greenfield_app WITH ADMIN FALSE']);
  assert.ok(sql.indexOf('CREATE TRIGGER') < sql.indexOf('GRANT greenfield_report_card_runtime TO greenfield_app'));
  assert.doesNotMatch(sql, /^BEGIN;|^COMMIT;|process\.env|DATABASE_URL/gm);
});

test('school and source bindings are captured without modifying existing prepared plans', () => {
  const changed = { ...config };
  const first = stagingReportSecurityPlan(changed); changed.schoolId = '00000000-0000-0000-0000-000000000099';
  const second = stagingReportSecurityPlan(changed);
  assert.equal(first.schoolId, config.schoolId); assert.notEqual(second.schoolId, first.schoolId);
  assert.notDeepEqual(first.statements, second.statements); assert.equal(first.sourceCommit, config.sourceCommit);
});
