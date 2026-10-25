import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { createApprovedSnapshotFixture } from './report-card-canonical-test-fixtures.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { buildApprovedReportSnapshot } from './report-card-approved-snapshot.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { verifyApprovedResultView } from './report-card-approved-view.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
import type { ViewReport, ViewSnapshot, ViewRelease } from './report-card-approved-view';
function fixture(stage: 'primary' | 'creche' = 'primary') {
  const f = createApprovedSnapshotFixture(stage), built = buildApprovedReportSnapshot(f.binding, f.docs); assert.ok(built.ok);
  const report: ViewReport = { ...f.binding, version: 4, stage: 'published' };
  const snapshot: ViewSnapshot = { id: 'snapshot', schoolId: 'school', reportId: 'report', reportVersion: 3, enrollmentId: f.binding.enrollmentId,
    assessmentScopeId: f.binding.assessmentScopeId, assessmentSourceVersionId: f.binding.assessmentSourceVersionId, assessmentRevision: f.binding.assessmentRevision,
    canonicalPayload: JSON.parse(built.snapshot.canonicalJson), contentHash: built.snapshot.sha256, sourceVersions: built.snapshot.sourceVersions };
  const audit = { snapshotId: 'snapshot', snapshotReportVersion: 3, actorMembershipId: f.binding.approvedBy, afterVersion: 3, occurredAt: f.binding.approvedAt };
  const releases: ViewRelease[] = [{ id: 'release', schoolId: 'school', reportId: 'report', reportVersion: 4, snapshotId: 'snapshot', snapshotReportVersion: 3, revokedAt: null }];
  return { ...f, report, snapshot, audit, releases };
}
const read = (f: ReturnType<typeof fixture>) => verifyApprovedResultView(f.report, f.snapshot, f.audit, f.releases, f.docs);
test('approved view projects only the selected pupil and preserves numeric versus descriptive results', () => {
  for (const stage of ['primary', 'creche'] as const) {
    const f = fixture(stage), result = read(f); assert.ok(result.ok); assert.equal(result.view.subjects.length, 1);
    assert.equal(result.view.sourceRevision, f.binding.assessmentRevision);
    if (stage === 'primary') assert.match(result.view.subjects[0]!.total!, /^\d+\.\d{2}$/);
    else { assert.equal(result.view.subjects[0]!.total, null); assert.ok(result.view.subjects[0]!.observations.length > 0); }
    const text = JSON.stringify(result.view); assert.doesNotMatch(text, /reviewedBy|finalizedBy|sourceManifest|canonicalPayload/);
  }
});
test('approved but unpublished snapshot needs no release and identifies its distinct state', () => {
  const f = fixture(); f.report.stage = 'approved'; f.report.version = 3; f.releases = [];
  const result = read(f); assert.ok(result.ok); assert.equal(result.view.stage, 'approved');
});
test('substituted pupil, school, source, approval actor, version, audit and release fail closed', () => {
  const mutations = [
    (f: ReturnType<typeof fixture>) => { f.report.studentId = 'b'; },
    (f: ReturnType<typeof fixture>) => { f.snapshot.schoolId = 'foreign'; },
    (f: ReturnType<typeof fixture>) => { f.snapshot.assessmentSourceVersionId = 'other'; },
    (f: ReturnType<typeof fixture>) => { f.report.approvedBy = f.report.submittedBy; },
    (f: ReturnType<typeof fixture>) => { f.report.version++; },
    (f: ReturnType<typeof fixture>) => { f.audit.actorMembershipId = 'other'; },
    (f: ReturnType<typeof fixture>) => { f.audit.occurredAt = '2026-10-20T00:00:00.000Z'; },
    (f: ReturnType<typeof fixture>) => { f.releases[0]!.revokedAt = '2026-10-20T00:00:00Z'; },
    (f: ReturnType<typeof fixture>) => { f.releases[0]!.snapshotId = 'old'; },
    (f: ReturnType<typeof fixture>) => { f.releases.push({ ...f.releases[0]! }); },
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); assert.equal(read(f).ok, false); }
});
test('stored hashes alone cannot validate edited payloads or different source documents', () => {
  const f = fixture(); const payload = f.snapshot.canonicalPayload as { subjects: { result: { total: string } }[] };
  payload.subjects[0]!.result.total = '99.00'; assert.equal(read(f).ok, false);
  f.snapshot.contentHash = createHash('sha256').update(canonicalizeSnapshotValue(payload)).digest('hex');
  assert.equal(read(f).ok, false, 'Re-hashing a forged result cannot replace source verification');
  const other = fixture(); other.docs.input.scores[0]!.numericScore = '0.0000'; assert.equal(read(other).ok, false);
});
test('snapshot accessors and encoded JSON are rejected without invoking payload getters', () => {
  const f = fixture(); let touched = false;
  f.snapshot.canonicalPayload = Object.defineProperty({}, 'binding', { enumerable: true, get() { touched = true; return {}; } });
  assert.equal(read(f).ok, false); assert.equal(touched, false);
  f.snapshot.canonicalPayload = '{}'; assert.equal(read(f).ok, false);
});
