import test from 'node:test';
import assert from 'node:assert/strict';
import { reportUpgradeGuardPlan } from './lib/report-card-upgrade-guards.mjs';
const schema = 'rc_it_0123456789abcdef';
const plan = reportUpgradeGuardPlan(schema), text = plan.statements.join('\n');
test('guard composition refuses application and arbitrary fixture identifiers', () => {
  for (const value of ['public', 'rc_it_wrong', schema + ';DROP', null]) assert.throws(() => reportUpgradeGuardPlan(value));
});
test('source discovery gate is installed before every parent and history guard', () => {
  const gate = plan.statements.findIndex(s => s.startsWith('CREATE TABLE') && s.includes('fixture_source_write_gate'));
  const parent = plan.statements.findIndex(s => s.includes('CREATE TRIGGER fixture_authority_gate'));
  const history = plan.statements.findIndex(s => s.includes('CREATE TRIGGER fixture_upgrade_history_write'));
  assert.ok(gate >= 0 && parent > gate && history > parent);
  assert.match(plan.readGate, /WHERE id=1 FOR SHARE$/);
});
test('all eight history families reject even zero-row update/delete and truncate', () => {
  assert.equal(plan.immutable.length, 8);
  for (const name of plan.immutable) {
    const table = '"' + schema + '"."' + name + '"';
    assert.ok(plan.statements.some(s => s.includes('BEFORE UPDATE OR DELETE ON ' + table + ' FOR EACH STATEMENT')));
    assert.ok(plan.statements.some(s => s.includes('BEFORE TRUNCATE ON ' + table + ' FOR EACH STATEMENT')));
  }
});
test('finalized configuration freeze and one-way release history are retained', () => {
  assert.match(text, /FOR EACH ROW WHEN \(OLD\.state='finalized'\)/);
  assert.match(text, /OLD\.revoked_at IS NOT NULL OR NEW\.revoked_at IS NULL/);
  assert.match(text, /to_jsonb\(NEW\)-'revoked_at'/);
  assert.match(text, /fixture_release_no_delete BEFORE DELETE/);
  assert.match(text, /fixture_release_no_truncate BEFORE TRUNCATE/);
});
test('every helper uses fixed search path and has its exact PUBLIC execute grant revoked', () => {
  const functions = plan.statements.filter(s => s.startsWith('CREATE FUNCTION'));
  assert.equal(functions.length, 7);
  for (const statement of functions) assert.match(statement, /SET search_path=pg_catalog/);
  assert.equal(plan.statements.filter(s => s.startsWith('REVOKE ALL ON FUNCTION') && s.endsWith(' FROM PUBLIC')).length, 7);
});
test('guard plan never installs runtime roles, policies, application objects or unrelated module guards', () => {
  assert.doesNotMatch(text, /CREATE ROLE|CREATE POLICY|GRANT |SECURITY DEFINER|"public"\.|\bpublic\./);
  for (const name of ['guardians', 'student_guardians', 'admissions', 'audit_events']) assert.equal(plan.authorityTargets.includes(name), false);
  assert.equal(plan.authorityTargets.length, 11);
  assert.ok(plan.sourceTargets.includes('enrollments'));
});
