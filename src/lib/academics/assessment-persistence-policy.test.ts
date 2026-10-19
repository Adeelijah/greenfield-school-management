import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { validateConfigForPersistence, validatePersistedScore, planAssessmentSourceRevision, type AssessmentSourceScope, type AssessmentRevisionIntent } from './assessment-persistence-policy.ts';
import type { AssessmentConfig } from './calendar-assessments';
const config: AssessmentConfig = { id: 'config', schoolId: 'school', levelId: 'level', subjectId: 'math', termId: 'term', status: 'finalized', version: 1,
 components: [{ id: 'exam', label: 'Exam', category: 'exam', weight: 100, maximumScore: 100, required: true }],
 grading: { mode: 'numeric', bands: [{ min: 0, max: 50, label: 'B' }, { min: 50, max: 100, label: 'A' }] } };
const admin = { id: 'admin', schoolId: 'school', role: 'admin' as const, status: 'active' as const };
const teacher = { ...admin, id: 'teacher', role: 'teacher' as const };
const scopes: AssessmentSourceScope[] = [{ id: 'scope-z', schoolId: 'school', classId: 'class-z', sessionId: 'session', termId: 'term', revision: 4 }, { id: 'scope-a', schoolId: 'school', classId: 'class-a', sessionId: 'session', termId: 'term', revision: 7 }];
const expected = scopes.map(s => ({ scopeId: s.id, revision: s.revision }));
const assignments = scopes.map(s => ({ schoolId: 'school', membershipId: 'teacher', classId: s.classId, sessionId: s.sessionId, subjectIds: ['math'], status: 'active' as const }));
const versions = expected.map(e => ({ ...e }));
const intent = (kind: AssessmentRevisionIntent['kind']): AssessmentRevisionIntent => ({ kind, subjectId: 'math', expected });

test('numeric configuration validates exact weights, maxima and stage', () => {
 assert.equal(validateConfigForPersistence(config, 'primary'), true);
 assert.equal(validateConfigForPersistence(config, 'nursery'), false);
 const inaccurate = { ...config, components: [{ ...config.components[0]!, weight: 100.0001 }] };
 assert.equal(validateConfigForPersistence(inaccurate, 'primary'), false);
 assert.equal(validateConfigForPersistence({ ...config, components: [{ ...config.components[0]!, maximumScore: 0.00001 }] }, 'primary'), false);
});
test('numeric score text is bounded exactly with four-decimal precision', () => {
 for (const numericScore of ['0', '100', '100.0000', '99.9999']) assert.equal(validatePersistedScore(config, 'primary', 'exam', { numericScore, observationKey: null }), true, numericScore);
 for (const numericScore of ['100.0001', '1e2', '-1', ' 10', '01', 'NaN', 'Infinity', '0.00001', '100000000']) assert.equal(validatePersistedScore(config, 'primary', 'exam', { numericScore, observationKey: null }), false, numericScore);
 assert.equal(validatePersistedScore(config, 'primary', 'exam', { numericScore: '10', observationKey: 'label' }), false);
 assert.equal(validatePersistedScore(config, 'primary', 'missing', { numericScore: '10', observationKey: null }), false);
});
test('observational text keys are preserved rather than converted to numeric scores', () => {
 const observation: AssessmentConfig = { ...config, grading: { mode: 'observational', levels: [{ id: 'emerging', label: 'Emerging' }, { id: 'consistent', label: 'Consistent' }] } };
 assert.equal(validateConfigForPersistence(observation, 'creche'), true);
 assert.equal(validatePersistedScore(observation, 'nursery', 'exam', { numericScore: null, observationKey: 'consistent' }), true);
 assert.equal(validatePersistedScore(observation, 'nursery', 'exam', { numericScore: '1', observationKey: null }), false);
 assert.equal(validatePersistedScore(observation, 'nursery', 'exam', { numericScore: null, observationKey: 'unknown' }), false);
 assert.equal(validatePersistedScore({ ...observation, status: 'draft' }, 'creche', 'exam', { numericScore: null, observationKey: 'emerging' }), false);
});
test('all source mutations advance every affected scope exactly once in stable lock order', () => {
 for (const kind of ['score_change', 'roster_change', 'enrollment_change', 'config_change'] as const) {
  const result = planAssessmentSourceRevision(admin, intent(kind), scopes, assignments, []); assert.ok(result.ok);
  assert.equal(result.changesSource, true); assert.deepEqual(result.locks.map(s => s.scopeId), ['scope-a', 'scope-z']);
  assert.ok(result.locks.every(s => s.afterRevision === s.beforeRevision + 1));
 }
});
test('review and finalization pin immutable source revisions without advancing them', () => {
 for (const [actor, kind] of [[teacher, 'teacher_review'], [admin, 'finalize']] as const) {
  const result = planAssessmentSourceRevision(actor, intent(kind), scopes, assignments, versions); assert.ok(result.ok);
  assert.equal(result.changesSource, false); assert.ok(result.locks.every(s => s.afterRevision === s.beforeRevision));
 }
});
test('missing or duplicate current source versions deny review/finalization', () => {
 assert.deepEqual(planAssessmentSourceRevision(teacher, intent('teacher_review'), scopes, assignments, []), { ok: false, code: 'missing_source_version' });
 assert.deepEqual(planAssessmentSourceRevision(admin, intent('finalize'), scopes, assignments, [...versions, versions[0]!]), { ok: false, code: 'missing_source_version' });
});
test('complete expected scope set and exact current revisions are mandatory', () => {
 assert.deepEqual(planAssessmentSourceRevision(admin, { ...intent('config_change'), expected: expected.slice(0, 1) }, scopes, [], []), { ok: false, code: 'scope_mismatch' });
 assert.deepEqual(planAssessmentSourceRevision(admin, { ...intent('config_change'), expected: expected.map(e => ({ ...e, revision: 1 })) }, scopes, [], []), { ok: false, code: 'stale_revision' });
 assert.equal(planAssessmentSourceRevision(admin, intent('config_change'), [...scopes, scopes[0]!], [], []).ok, false);
});
test('teachers need one active class/session/subject assignment for every scope', () => {
 assert.equal(planAssessmentSourceRevision(teacher, intent('score_change'), scopes, assignments, []).ok, true);
 assert.equal(planAssessmentSourceRevision(teacher, intent('score_change'), scopes, assignments.slice(0, 1), []).ok, false);
 assert.equal(planAssessmentSourceRevision(teacher, intent('score_change'), scopes, [...assignments, assignments[0]!], []).ok, false);
 assert.equal(planAssessmentSourceRevision(teacher, intent('score_change'), scopes, assignments.map(a => ({ ...a, subjectIds: ['english'] })), []).ok, false);
});
test('role boundaries and mixed-school scopes fail closed', () => {
 assert.equal(planAssessmentSourceRevision(teacher, intent('finalize'), scopes, assignments, versions).ok, false);
 assert.equal(planAssessmentSourceRevision(admin, intent('teacher_review'), scopes, assignments, versions).ok, false);
 assert.equal(planAssessmentSourceRevision({ ...admin, role: 'bursar' }, intent('score_change'), scopes, [], []).ok, false);
 assert.equal(planAssessmentSourceRevision({ ...admin, status: 'suspended' }, intent('config_change'), scopes, [], []).ok, false);
 assert.deepEqual(planAssessmentSourceRevision(admin, intent('config_change'), [{ ...scopes[0]!, schoolId: 'other' }], [], []), { ok: false, code: 'school_mismatch' });
});
test('revision overflow is refused and plans do not mutate source rows or configuration', () => {
 const before = structuredClone({ scopes, config });
 planAssessmentSourceRevision(admin, intent('score_change'), scopes, assignments, []); validateConfigForPersistence(config, 'primary');
 assert.deepEqual({ scopes, config }, before);
 const large = [{ ...scopes[0]!, revision: Number.MAX_SAFE_INTEGER }];
 assert.equal(planAssessmentSourceRevision(admin, { ...intent('config_change'), expected: [{ scopeId: large[0]!.id, revision: large[0]!.revision }] }, large, [], []).ok, false);
});
