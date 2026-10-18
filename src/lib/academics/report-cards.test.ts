import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's type-stripping runner requires the explicit source extension.
import { initialAssessment, previewSchoolId } from '../../components/academics/calendar-assessment-fixtures.ts';
// @ts-expect-error Node's type-stripping runner requires the explicit source extension.
import { prepareReportCard, type ReportCardRequest } from './report-cards.ts';

// The shared demo fixture intentionally enrolls the early-years learner twice in one session.
// Use a valid school-scoped roster for report-card eligibility tests.
const validAssessment = {
  ...initialAssessment,
  enrollments: initialAssessment.enrollments.filter(e => !(e.studentId === 'student-early-years' && e.classId === 'class-primary-5-cedar')),
};

const request: ReportCardRequest = {
  schoolId: previewSchoolId, studentId: 'student-amina',
  classId: 'class-primary-5-cedar', sessionId: 'session-2026-27', termId: 'term-26-1',
};

test('rejects a request for a different school', () => {
  assert.deepEqual(prepareReportCard(validAssessment, { ...request, schoolId: 'another-school' }), { ok: false, reason: 'school_mismatch' });
});

test('rejects mismatched term/session and inactive enrollments', () => {
  assert.deepEqual(prepareReportCard(validAssessment, { ...request, termId: 'term-27-1' }), { ok: false, reason: 'invalid_reference' });
  const snapshot = { ...validAssessment, enrollments: validAssessment.enrollments.map(e => e.studentId === request.studentId ? { ...e, status: 'withdrawn' as const } : e) };
  assert.deepEqual(prepareReportCard(snapshot, request), { ok: false, reason: 'ineligible_student' });
});

test('incomplete subject is never ready for review or publishable', () => {
  const outcome = prepareReportCard(validAssessment, request);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.card.publishable, false);
  assert.equal(outcome.card.status, 'incomplete');
  assert.ok(outcome.card.subjects.some(s => !s.complete));
});

test('finalized numeric results still cannot be published', () => {
  const snapshot = { ...validAssessment, subjects: validAssessment.subjects.filter(s => s.id === 'subject-math'), finalizedKeys: ['class-primary-5-cedar:session-2026-27:term-26-1:subject-math'] };
  const outcome = prepareReportCard(snapshot, request);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.card.status, 'ready_for_review');
  assert.equal(outcome.card.publishable, false);
  assert.equal(outcome.card.subjects[0]?.result.total, 86);
});

test('Creche observations remain descriptive rather than numeric totals', () => {
  const outcome = prepareReportCard(validAssessment, { ...request, studentId: 'student-early-years', classId: 'class-creche-green' });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.card.subjects[0]?.result.total, null);
  assert.match(outcome.card.subjects[0]?.result.grade ?? '', /Consistent/);
});

test('duplicate active enrollment in a session fails closed rather than producing a grade', () => {
  const outcome = prepareReportCard(initialAssessment, request);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.card.status, 'incomplete');
  assert.ok(outcome.card.subjects.every(s => !s.complete));
});
