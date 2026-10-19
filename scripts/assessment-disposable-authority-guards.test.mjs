import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentAuthorityGuardDDL } from './lib/assessment-disposable-authority-guards.mjs';
const schema = 'rc_it_0123456789abcdef';
test('authority guard refuses non-fixture schema identifiers', () => {
 for (const name of ['public', 'rc_it_bad', schema + '";DROP SCHEMA public']) assert.throws(() => assessmentAuthorityGuardDDL(name));
});
test('authority and parent writes acquire the existing gate before any row lock', () => {
 const plan = assessmentAuthorityGuardDDL(schema);
 assert.equal(plan.targets.length, 11);
 for (const name of plan.targets) {
  assert.ok(plan.statements.includes(`CREATE TRIGGER fixture_authority_gate BEFORE INSERT OR UPDATE OR DELETE ON "${schema}"."${name}" FOR EACH STATEMENT EXECUTE FUNCTION "${schema}"."fixture_lock_source_write"()`));
  assert.ok(plan.statements.includes(`CREATE TRIGGER fixture_authority_no_truncate BEFORE TRUNCATE ON "${schema}"."${name}" FOR EACH STATEMENT EXECUTE FUNCTION "${schema}"."fixture_reject_source_truncate"()`));
 }
});
test('authority ordering introduces no definer privilege, revision policy or live security changes', () => {
 const sql = assessmentAuthorityGuardDDL(schema).statements.join('\n');
 for (const text of ['SECURITY DEFINER', 'GRANT ', 'CREATE ROLE', 'ALTER TABLE', 'public.', 'fixture_mark_source_scope']) assert.equal(sql.includes(text), false);
});
