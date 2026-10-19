import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's type-stripping runner requires the explicit source extension.
import { canonicalizeReportSnapshot } from './report-card-canonical-snapshot.ts';

const binding = {
  schoolId: 'school', reportId: 'report', studentId: 'student', enrollmentId: 'enrollment',
  classId: 'class', sessionId: 'session', termId: 'term', assessmentRevision: 4,
  subjectIds: ['math', 'english'], finalizedSubjectIds: ['math', 'english'],
  sourceVersionKeys: ['grading:2', 'assessment:4'],
};
const assessment = { results: [{ subject: 'math', score: 86 }, { subject: 'english', score: 73 }], remark: 'Good progress' };
test('stable hash despite object key order and roster set order', () => {
  const a = canonicalizeReportSnapshot({ binding, assessment });
  const reordered = canonicalizeReportSnapshot({
    binding: { ...binding, subjectIds: ['english', 'math'], finalizedSubjectIds: ['english', 'math'], sourceVersionKeys: ['assessment:4', 'grading:2'] },
    assessment: { remark: 'Good progress', results: [{ score: 86, subject: 'math' }, { score: 73, subject: 'english' }] },
  });
  assert.equal(a.canonicalJson, reordered.canonicalJson);
  assert.equal(a.sha256, reordered.sha256);
  assert.match(a.sha256, /^[a-f0-9]{64}$/);
});
test('assessment score, revision and source version changes alter digest', () => {
  const base = canonicalizeReportSnapshot({ binding, assessment }).sha256;
  assert.notEqual(base, canonicalizeReportSnapshot({ binding, assessment: { ...assessment, results: [{ subject: 'math', score: 85 }, assessment.results[1]] } }).sha256);
  assert.notEqual(base, canonicalizeReportSnapshot({ binding: { ...binding, assessmentRevision: 5 }, assessment }).sha256);
  assert.notEqual(base, canonicalizeReportSnapshot({ binding: { ...binding, sourceVersionKeys: ['assessment:4', 'grading:3'] }, assessment }).sha256);
});
test('incomplete source roster is rejected before hashing', () => {
  assert.throws(() => canonicalizeReportSnapshot({ binding: { ...binding, finalizedSubjectIds: ['math'] }, assessment }), /not ready/);
});
test('rejects unsupported, nonfinite, sparse, cyclic and accessor values', () => {
  for (const value of [undefined, Number.NaN, Infinity, new Date(), [, 2], { grade: undefined }]) {
    assert.throws(() => canonicalizeReportSnapshot({ binding, assessment: value as never }));
  }
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalizeReportSnapshot({ binding, assessment: cyclic as never }));
  const accessor = Object.defineProperty({}, 'grade', { enumerable: true, get: () => 90 });
  assert.throws(() => canonicalizeReportSnapshot({ binding, assessment: accessor as never }));
});
test('does not mutate original assessment or binding', () => {
  const before = JSON.stringify({ binding, assessment });
  canonicalizeReportSnapshot({ binding, assessment });
  assert.equal(JSON.stringify({ binding, assessment }), before);
});
