import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { readAuthoritativeReport, type AuthoritativeReportReadPort, type AuthBoundMembership, type AcademicReadBundle } from './report-card-authoritative-read.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { initialAssessment, previewSchoolId } from '../../components/academics/calendar-assessment-fixtures.ts';
import type { ReportRecord } from './report-card-workflow.ts';

function fixture() {
  const schoolId = previewSchoolId;
  const record: ReportRecord = { schoolId, studentId: 'student-amina', classId: 'class-primary-5-cedar', sessionId: 'session-2026-27', termId: 'term-26-1', stage: 'draft', version: 1, assessmentVersion: initialAssessment.version, submittedBy: null, approvedBy: null, publishedAt: null, returnReason: null };
  const membership: AuthBoundMembership = { id: 'teacher', authUserId: 'auth-teacher', schoolId, role: 'teacher', status: 'active' };
  const bundle: AcademicReadBundle = {
    academic: { ...structuredClone(initialAssessment), subjects: initialAssessment.subjects.filter(s => s.id === 'subject-math'), finalizedKeys: [`${record.classId}:${record.sessionId}:${record.termId}:subject-math`] },
    sources: { schoolId, assessmentRevision: record.assessmentVersion,
      enrollments: [{ ...record, id: 'enrollment', status: 'active' }],
      subjects: [{ schoolId, classId: record.classId, sessionId: record.sessionId, termId: record.termId, subjectId: 'subject-math', finalized: true, assessmentRevision: record.assessmentVersion, sourceVersionKey: 'math-config-1-scores-1' }] },
  };
  const calls: string[] = [];
  const port: AuthoritativeReportReadPort = {
    async verifiedIdentity() { calls.push('identity'); return { authUserId: 'auth-teacher' }; },
    async lockMemberships(authUserId) { calls.push('membership'); assert.equal(authUserId, 'auth-teacher'); return [membership]; },
    async lockReport(school, id) { calls.push('report'); assert.equal(school, schoolId); return { id, enrollmentId: 'enrollment', record }; },
    async readAssignments() { calls.push('assignments'); return [{ id: 'assignment', schoolId, membershipId: 'teacher', classId: record.classId, sessionId: record.sessionId, status: 'active' }]; },
    async readAcademicSources() { calls.push('sources'); return bundle; },
    async readCurrentRevision() { calls.push('revision'); return record.assessmentVersion; },
  };
  return { port, record, membership, bundle, calls };
}
const read = (f: ReturnType<typeof fixture>) => readAuthoritativeReport(f.port, 'report');
test('derives trusted scope, recomputes grade and binds enrollment and source revision', async () => {
  const f = fixture(); const result = await read(f);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.locked.projection.subjects[0]!.result.total, 86);
  assert.equal(result.locked.projection.publishable, false);
  assert.equal(result.binding.enrollmentId, 'enrollment');
  assert.deepEqual(f.calls, ['identity', 'membership', 'report', 'assignments', 'sources', 'revision']);
});
test('missing identity stops before membership or academic reads', async () => {
  const f = fixture(); f.port.verifiedIdentity = async () => null;
  assert.deepEqual(await read(f), { ok: false, code: 'unauthenticated' }); assert.deepEqual(f.calls, []);
});
test('suspended, bursar, other-auth identity and ambiguous memberships fail before report read', async () => {
  for (const change of [{ status: 'suspended' as const }, { role: 'bursar' as const }, { authUserId: 'other-auth' }]) {
    const f = fixture(); Object.assign(f.membership, change);
    assert.deepEqual(await read(f), { ok: false, code: 'forbidden' }); assert.ok(!f.calls.includes('report'));
  }
  const f = fixture(); f.port.lockMemberships = async () => [f.membership, f.membership];
  assert.deepEqual(await read(f), { ok: false, code: 'forbidden' });
});
test('missing or foreign-school report fails before source reads', async () => {
  const f = fixture(); f.record.schoolId = 'foreign';
  assert.deepEqual(await read(f), { ok: false, code: 'not_found' }); assert.ok(!f.calls.includes('sources'));
  f.port.lockReport = async () => null;
  assert.deepEqual(await read(f), { ok: false, code: 'not_found' });
});
test('missing teacher assignment denies before academic data loads; admin needs none', async () => {
  const f = fixture(); f.port.readAssignments = async () => [];
  assert.deepEqual(await read(f), { ok: false, code: 'forbidden' }); assert.ok(!f.calls.includes('sources'));
  f.membership.role = 'admin'; assert.equal((await read(f)).ok, true);
});
test('duplicate active enrollment and withdrawn enrollment fail closed', async () => {
  const f = fixture(); const row = f.bundle.sources.enrollments[0]!;
  f.bundle.sources.enrollments = [row, { ...row, id: 'duplicate' }];
  assert.deepEqual(await read(f), { ok: false, code: 'invalid_source' });
  f.bundle.sources.enrollments = [{ ...row, status: 'withdrawn' }];
  assert.deepEqual(await read(f), { ok: false, code: 'invalid_source' });
});
test('wrong session term and missing scores cannot produce trusted reports', async () => {
  const f = fixture(); f.record.termId = 'term-27-1';
  assert.deepEqual(await read(f), { ok: false, code: 'invalid_source' });
  const g = fixture(); g.bundle.academic.scores = [];
  assert.deepEqual(await read(g), { ok: false, code: 'invalid_source' });
});
test('incomplete, unfinalized and cross-school source roster is denied', async () => {
  for (const change of [{ finalized: false }, { schoolId: 'foreign' }, { assessmentRevision: -1 }]) {
    const f = fixture(); f.bundle.sources.subjects = [{ ...f.bundle.sources.subjects[0]!, ...change }];
    assert.deepEqual(await read(f), { ok: false, code: 'invalid_source' });
  }
  const f = fixture(); f.bundle.sources.subjects = [];
  assert.deepEqual(await read(f), { ok: false, code: 'invalid_source' });
});
test('stale stored revision and revision drift during read are denied', async () => {
  const f = fixture(); f.record.assessmentVersion++;
  assert.deepEqual(await read(f), { ok: false, code: 'stale_assessment' });
  const g = fixture(); g.port.readCurrentRevision = async () => g.record.assessmentVersion + 1;
  assert.deepEqual(await read(g), { ok: false, code: 'stale_assessment' });
});
test('read errors expose no database error details', async () => {
  const f = fixture(); f.port.readAcademicSources = async () => { throw Error('sensitive connection detail'); };
  assert.deepEqual(await read(f), { ok: false, code: 'read_failed' });
});
