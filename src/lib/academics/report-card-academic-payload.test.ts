import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 22 type stripping requires explicit source extension.
import { validateAcademicSnapshotPayload, type AcademicSnapshotPayload } from './report-card-academic-payload.ts';
const primary: AcademicSnapshotPayload = {
 stage: 'primary', subjects: [{ kind: 'numeric', subjectId: 'math', finalized: true, total: 86, grade: 'A', remark: null, components: [{ componentId: 'ca', score: 26, maximum: 30, weight: 30 }, { componentId: 'task', score: 18, maximum: 20, weight: 20 }, { componentId: 'exam', score: 84, maximum: 100, weight: 50 }] }],
 attendance: { present: 60, possible: 65 }, teacherRemark: 'Strong progress', principalRemark: null,
};
const early: AcademicSnapshotPayload = { stage: 'creche', subjects: [{ kind: 'observational', subjectId: 'discovery', finalized: true, observation: 'Explores confidently', level: 'developing' }], attendance: null, teacherRemark: null, principalRemark: null };
test('accepts primary numeric and creche observational results', () => {
 assert.deepEqual(validateAcademicSnapshotPayload(primary, ['math']), { valid: true });
 assert.deepEqual(validateAcademicSnapshotPayload(early, ['discovery']), { valid: true });
});
test('rejects missing, duplicate and mismatched subjects', () => {
 assert.equal(validateAcademicSnapshotPayload(primary, ['math', 'english']).valid, false);
 assert.equal(validateAcademicSnapshotPayload({ ...primary, subjects: [primary.subjects[0], primary.subjects[0]] }, ['math', 'english']).valid, false);
});
test('rejects observational results for primary and numeric results for creche', () => {
 assert.equal(validateAcademicSnapshotPayload({ ...early, stage: 'primary' }, ['discovery']).valid, false);
 assert.equal(validateAcademicSnapshotPayload({ ...primary, stage: 'creche' }, ['math']).valid, false);
});
test('rejects invalid attendance and incomplete component weights', () => {
 assert.equal(validateAcademicSnapshotPayload({ ...primary, attendance: { present: 66, possible: 65 } }, ['math']).valid, false);
 const numeric = primary.subjects[0];
 if (numeric.kind !== 'numeric') throw new Error('fixture invalid');
 assert.equal(validateAcademicSnapshotPayload({ ...primary, subjects: [{ ...numeric, components: numeric.components.slice(0, 2) }] }, ['math']).valid, false);
});
test('rejects unfinalized, malformed grades and negative scores', () => {
 const numeric = primary.subjects[0];
 if (numeric.kind !== 'numeric') throw new Error('fixture invalid');
 assert.equal(validateAcademicSnapshotPayload({ ...primary, subjects: [{ ...numeric, finalized: false }] as unknown as AcademicSnapshotPayload['subjects'] }, ['math']).valid, false);
 assert.equal(validateAcademicSnapshotPayload({ ...primary, subjects: [{ ...numeric, grade: '' }] }, ['math']).valid, false);
 assert.equal(validateAcademicSnapshotPayload({ ...primary, subjects: [{ ...numeric, components: [{ ...numeric.components[0], score: -1 }, ...numeric.components.slice(1)] }] }, ['math']).valid, false);
});
