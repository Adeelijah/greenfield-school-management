import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeLoginSetupPlan, upgradeLoginCleanupPlan } from './lib/report-card-upgrade-login-plan.mjs';
const schema = 'rc_it_0123456789abcdef', database = 'greenfield_report_cards_disposable', secret = '0'.repeat(64);
test('login preparation rejects arbitrary schema/database names and non-generated secrets', () => {
  for (const name of ['public', 'rc_it_wrong', schema + ';DROP']) assert.throws(() => upgradeLoginSetupPlan(name, database, secret));
  for (const name of ['postgres', 'greenfield', database + '";DROP']) assert.throws(() => upgradeLoginSetupPlan(schema, name, secret));
  for (const value of ['', 'password', 'f'.repeat(63), "'".repeat(64)]) assert.throws(() => upgradeLoginSetupPlan(schema, database, value));
});
test('login has no privileged flags or inherited service access', () => {
  const plan = upgradeLoginSetupPlan(schema, database, secret);
  assert.match(plan.statements[0], /LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION/);
  assert.deepEqual(plan.roles, [schema + '_reader', schema + '_writer']);
});
test('exact two service memberships are SET-only and never grant authority-owner/admin membership', () => {
  const plan = upgradeLoginSetupPlan(schema, database, secret);
  const memberships = plan.statements.filter(s => s.startsWith('GRANT "'));
  assert.equal(memberships.length, 6);
  for (const role of plan.roles) for (const option of ['SET TRUE', 'INHERIT FALSE', 'ADMIN FALSE']) assert.ok(memberships.includes('GRANT "' + role + '" TO "' + plan.login + '" WITH ' + option));
  assert.equal(memberships.some(s => s.includes('_authority_owner')), false);
});
test('acknowledged committed security cleanup drops schema before four exact roles and explicit CONNECT', () => {
  const plan = upgradeLoginCleanupPlan(schema, database, true);
  assert.equal(plan.statements[0], 'DROP SCHEMA "' + schema + '" CASCADE');
  assert.match(plan.statements[1], /^REVOKE CONNECT ON DATABASE/);
  assert.equal(plan.statements.filter(s => s.startsWith('DROP ROLE')).length, 4);
  assert.equal(new Set(plan.roles).size, 4);
  assert.ok(plan.statements[2].includes('_login'));
});
test('uncommitted security cleanup does not drop unacknowledged roles', () => {
  assert.deepEqual(upgradeLoginCleanupPlan(schema, database, false).statements, ['DROP SCHEMA "' + schema + '" CASCADE']);
});
test('cleanup requires an exact generated namespace and explicit commit evidence', () => {
  assert.throws(() => upgradeLoginCleanupPlan('public', database, true));
  assert.throws(() => upgradeLoginCleanupPlan(schema, 'postgres', true));
  for (const value of [undefined, 'true', 1, null]) assert.throws(() => upgradeLoginCleanupPlan(schema, database, value));
});
