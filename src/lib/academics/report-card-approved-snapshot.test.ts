import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// @ts-expect-error Node type stripping requires explicit source extension.
import { buildApprovedReportSnapshot, matchesApprovedReportSnapshot } from './report-card-approved-snapshot.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { createApprovedSnapshotFixture } from './report-card-canonical-test-fixtures.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
test('approved snapshot selects one pupil and pins every subject source reference', () => {
 const f = createApprovedSnapshotFixture(); const result = buildApprovedReportSnapshot(f.binding, f.docs); assert.ok(result.ok);
 const payload = JSON.parse(result.snapshot.canonicalJson);
 assert.equal(payload.subjects[0].result.total, '86.13'); assert.equal(payload.binding.approvedVersion, 3);
 assert.equal(result.snapshot.sourceVersions[0]!.finalizationId, 'final');
 assert.equal(result.snapshot.canonicalJson.includes('score-b'), false); assert.equal(result.snapshot.canonicalJson.includes('enroll-b'), false);
 for (const stage of ['creche','nursery'] as const) {
  const early = createApprovedSnapshotFixture(stage); const built = buildApprovedReportSnapshot(early.binding,early.docs); assert.ok(built.ok);
  const observation = JSON.parse(built.snapshot.canonicalJson).subjects[0].result;
  assert.equal(observation.mode,'observational'); assert.equal('total' in observation,false);
 }
 assert.equal('sourceManifest' in payload, false); assert.equal('number' in payload.placement.term, false); assert.equal('version' in payload.placement.session, false);
});
test('deterministic snapshot ignores source set ordering and leaves input unchanged', () => {
 const f = createApprovedSnapshotFixture(); const before = structuredClone(f);
 const a = buildApprovedReportSnapshot(f.binding, f.docs); f.docs.input.scores = [...f.docs.input.scores].reverse();
 assert.deepEqual(a, buildApprovedReportSnapshot(f.binding, f.docs));
 f.docs.input.scores = [...f.docs.input.scores].reverse(); assert.deepEqual(f, before);
});
test('wrong pupil, source revision, school or enrollment cannot be snapshotted', () => {
 for (const patch of [{ studentId: 'b' }, { assessmentRevision: 3 }, { schoolId: 'foreign' }, { enrollmentId: 'enroll-b' }, { assessmentSourceVersionId: 'other' }]) {
  const f = createApprovedSnapshotFixture(); Object.assign(f.binding, patch); assert.deepEqual(buildApprovedReportSnapshot(f.binding, f.docs), { ok: false, code: 'invalid_binding' });
 }
});
test('approval needs independent identities, a real workflow version and canonical timestamp', () => {
 for (const patch of [{ approvedBy: 'teacher' }, { approvedVersion: 1 }, { approvedVersion: 2 }, { approvedAt: 'yesterday' }, { approvedAt: '2026-10-19' }, { submittedBy: '' }]) {
  const f = createApprovedSnapshotFixture(); Object.assign(f.binding, patch); assert.deepEqual(buildApprovedReportSnapshot(f.binding, f.docs), { ok: false, code: 'invalid_binding' });
 }
});
test('malformed or forged complete source fails even when selected pupil scores are intact', () => {
 const f = createApprovedSnapshotFixture(); f.docs.input.scores = f.docs.input.scores.slice(0, 1);
 assert.deepEqual(buildApprovedReportSnapshot(f.binding, f.docs), { ok: false, code: 'invalid_source' });
 const g = createApprovedSnapshotFixture(); g.docs.source.sourceManifest = { fake: true };
 assert.deepEqual(buildApprovedReportSnapshot(g.binding, g.docs), { ok: false, code: 'invalid_source' });
});
test('stored snapshot requires both canonical payload and independent expected hash', () => {
 const f = createApprovedSnapshotFixture(); const built = buildApprovedReportSnapshot(f.binding, f.docs); assert.ok(built.ok); const snapshot = built.snapshot;
 const payload = JSON.parse(snapshot.canonicalJson);
 assert.equal(matchesApprovedReportSnapshot(snapshot, { canonicalPayload: payload, contentHash: snapshot.sha256, sourceVersions: snapshot.sourceVersions }), true);
 payload.subjects[0].result.total = '100.00';
 assert.equal(matchesApprovedReportSnapshot(snapshot, { canonicalPayload: payload, contentHash: createHash('sha256').update(canonicalizeSnapshotValue(payload)).digest('hex'), sourceVersions: snapshot.sourceVersions }), false);
 assert.equal(matchesApprovedReportSnapshot(snapshot, { canonicalPayload: snapshot.canonicalJson, contentHash: snapshot.sha256, sourceVersions: snapshot.sourceVersions }), false);
});
test('changed approval or source list cannot reuse the approved document digest', () => {
 const f = createApprovedSnapshotFixture(); const built = buildApprovedReportSnapshot(f.binding, f.docs); assert.ok(built.ok);
 f.binding.approvedBy = 'other-admin'; const other = buildApprovedReportSnapshot(f.binding, f.docs); assert.ok(other.ok); assert.notEqual(other.snapshot.sha256, built.snapshot.sha256);
 assert.equal(matchesApprovedReportSnapshot(built.snapshot, { canonicalPayload: JSON.parse(built.snapshot.canonicalJson), contentHash: built.snapshot.sha256, sourceVersions: [] }), false);
});
test('accessor binding is refused before execution', () => {
 const f = createApprovedSnapshotFixture(); let invoked = false;
 Object.defineProperty(f.binding, 'approvedVersion', { enumerable: true, get() { invoked = true; return 3; } });
 assert.deepEqual(buildApprovedReportSnapshot(f.binding, f.docs), { ok: false, code: 'invalid_source' }); assert.equal(invoked, false);
});
