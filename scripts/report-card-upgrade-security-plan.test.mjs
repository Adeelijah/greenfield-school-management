import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reportUpgradeSecurityPlan, inspectUpgradeSecurityLayout } from './lib/report-card-upgrade-security-plan.mjs';
const schema = 'rc_it_0123456789abcdef', schoolId = '00000000-0000-0000-0000-000000000001';
const review = readFileSync(new URL('../docs/security/REPORT_CARD_ACTOR_AUTHORITY_REVIEW.sql', import.meta.url), 'utf8');
const plan = reportUpgradeSecurityPlan(schema, schoolId, review), text = plan.statements.join('\n');
const layout = () => [...plan.requiredRelations.map(name => ({ kind: 'relation', name })), ...plan.requiredExistingFunctions.map(name => ({ kind: 'function', name }))];

test('security composition requires exact fixture namespace, school UUID and reviewed authority protocol', () => {
  for (const name of ['public', 'rc_it_wrong', schema + ';DROP']) assert.throws(() => reportUpgradeSecurityPlan(name, schoolId, review));
  assert.throws(() => reportUpgradeSecurityPlan(schema, 'forged', review));
  assert.throws(() => reportUpgradeSecurityPlan(schema, schoolId, ''));
});
test('guarded layout gate refuses absent, ambiguous and missing prerequisite evidence', () => {
  assert.deepEqual(inspectUpgradeSecurityLayout(plan, layout()), { ok: true });
  assert.equal(plan.requiredRelations.length, 33);
  assert.deepEqual(inspectUpgradeSecurityLayout(plan, layout().slice(1)), { ok: false, code: 'missing_prerequisite' });
  assert.deepEqual(inspectUpgradeSecurityLayout(plan, [...layout(), layout()[0]]), { ok: false, code: 'invalid_layout' });
  assert.deepEqual(inspectUpgradeSecurityLayout(plan, null), { ok: false, code: 'invalid_layout' });
});
test('all three generated roles are restricted non-login roles with no execution-role ownership shortcut', () => {
  const roles = plan.statements.filter(s => s.startsWith('CREATE ROLE'));
  assert.equal(roles.length, 3);
  for (const sql of roles) assert.match(sql, /NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION$/);
  assert.doesNotMatch(text, new RegExp('OWNER TO "' + plan.roles.writer + '"|OWNER TO "' + plan.roles.reader + '"'));
  assert.equal(plan.rolePreflight.roles.writer, plan.roles.writer);
});
test('installed release guards are reused while complete authority is ordered after forced school RLS', () => {
  assert.equal(plan.statements.some(s => s.startsWith('CREATE FUNCTION') && s.includes('fixture_guard_release_history')), false);
  assert.equal(plan.statements.some(s => s.startsWith('CREATE TRIGGER fixture_release_')), false);
  const force = plan.statements.findIndex(s => s.includes('FORCE ROW LEVEL SECURITY'));
  const owner = plan.statements.findIndex(s => s.startsWith('CREATE ROLE "' + plan.roles.authorityOwner));
  assert.ok(force >= 0 && owner > force);
  assert.ok(text.includes('AS RESTRICTIVE FOR ALL TO "' + plan.roles.reader + '","' + plan.roles.writer + '"'));
});
test('legacy modules and claim table receive no runtime grants while all existing table privileges are revoked first', () => {
  assert.ok(plan.statements.some(s => s.startsWith('REVOKE ALL ON ALL TABLES IN SCHEMA')));
  for (const name of plan.excludedRuntimeTables) {
    const grants = plan.statements.filter(s => s.startsWith('GRANT ') && s.includes('."' + name + '"'));
    assert.deepEqual(grants, [], name);
  }
  // UPDATE(id) is the existing row-lock privilege; guards/policy forbid mutation.
  const snapshotUpdates = plan.statements.filter(s => s.startsWith('GRANT UPDATE') && s.includes('."report_card_snapshots"') && s.endsWith('TO "' + plan.roles.writer + '"'));
  assert.deepEqual(snapshotUpdates, ['GRANT UPDATE (id) ON "' + schema + '"."report_card_snapshots" TO "' + plan.roles.writer + '"']);
  assert.match(text, /fixture_service_lock.*WITH CHECK \(false\)/);
});
test('complete resolver preserves source-before-authority order and is executable only by exact writer', () => {
  const resolver = plan.statements.find(s => s.startsWith('CREATE FUNCTION') && s.includes('.lock_report_card_actor('));
  assert.ok(resolver.indexOf('fixture_source_write_gate') < resolver.indexOf('pg_advisory_xact_lock_shared'));
  const grants = plan.statements.filter(s => s.startsWith('GRANT EXECUTE ON FUNCTION'));
  assert.deepEqual(grants, ['GRANT EXECUTE ON FUNCTION "' + schema + '"."lock_report_card_actor"(uuid) TO "' + plan.roles.writer + '"']);
  assert.ok(plan.statements.some(s => s.includes('lock_report_card_actor"(uuid) FROM PUBLIC,"' + plan.roles.writer + '","' + plan.roles.reader + '"')));
});
