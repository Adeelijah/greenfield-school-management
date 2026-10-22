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
 for (const text of ['SECURITY DEFINER', 'GRANT ', 'CREATE ROLE', 'ALTER TABLE', 'public.']) assert.equal(sql.includes(text), false);
});

test('academic parent invalidation uses old and new identities and deterministic scope claims', () => {
 const sql = assessmentAuthorityGuardDDL(schema).statements.join('\n');
 for (const key of ['school_id', 'class_id', 'session_id', 'term_id', 'student_id', 'level_id', 'section_id']) assert.ok(sql.includes(key));
 assert.ok(sql.includes("(before_row->>'id')::uuid,(after_row->>'id')::uuid"));
 assert.match(sql, /ORDER BY s.id/);
 assert.ok(sql.includes('fixture_mark_source_scope"(target)'));
});
test('academic parent triggers discover references before cascade and leave authority changes out of revisions', () => {
 const plan = assessmentAuthorityGuardDDL(schema);
 assert.equal(plan.academicParents.length, 7);
 const invalidate = plan.statements.find(s => s.startsWith('CREATE FUNCTION'));
 assert.match(invalidate, /IF TG_OP='DELETE' THEN RETURN OLD; END IF;\s+RETURN NEW;/);
 assert.doesNotMatch(invalidate, /RETURN NULL/);
 for (const name of plan.academicParents) assert.ok(plan.statements.some(s => s.includes('BEFORE UPDATE OR DELETE ON "'+schema+'"."'+name+'" FOR EACH ROW')));
 for (const name of ['school_users','memberships','teacher_class_assignments','assessment_teacher_subjects']) assert.equal(plan.academicParents.includes(name),false);
});
