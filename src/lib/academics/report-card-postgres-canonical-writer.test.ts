import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { CanonicalReportCommand } from './report-card-postgres-canonical-writer';
// @ts-expect-error Node type stripping requires explicit source extension.
import { executeFixtureCanonicalReportCommand } from './report-card-postgres-canonical-writer.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { createCanonicalWriterFixture as fake } from './report-card-canonical-test-fixtures.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
const schema = 'rc_it_0123456789abcdef';
const approve: CanonicalReportCommand = { reportId: 'report', action: 'approve', expectedVersion: 2, operationKey: 'approve-1' };
const publish: CanonicalReportCommand = { reportId: 'report', action: 'publish', expectedVersion: 3, operationKey: 'publish-1' };

test('approval creates one real snapshot and publication reuses it atomically', async () => {
 const f = fake(); const approved = await f.run(); assert.ok(approved.ok, JSON.stringify(approved));
 assert.equal(approved.version, 3); assert.equal(f.tables.report_card_snapshots!.length, 1); assert.equal(f.tables.report_card_releases!.length, 0);
 const result = await f.run(publish); assert.ok(result.ok, JSON.stringify(result));
 assert.equal(result.snapshotId, approved.snapshotId); assert.equal(result.version, 4);
 assert.equal(f.tables.report_card_snapshots!.length, 1); assert.equal(f.tables.report_card_audit!.length, 2); assert.equal(f.tables.report_card_operation_receipts!.length, 2); assert.equal(f.tables.report_card_releases!.length, 1);
 assert.equal(f.tables.report_card_releases![0]!.snapshotReportVersion, 3);
});
test('durable receipts replay after later state/source changes and conflicting keys fail', async () => {
 const f = fake(); const first = await f.run(); assert.ok(first.ok); assert.ok((await f.run(publish)).ok);
 f.tables.assessment_scopes![0]!.revision = 5;
 assert.deepEqual(await f.run(), { ...first, kind: 'replay' });
 const replay = await f.run(publish); assert.ok(replay.ok); assert.equal(replay.kind, 'replay');
 assert.deepEqual(await f.run({ ...approve, expectedVersion: 3 }), { ok: false, code: 'idempotency_conflict' });
 assert.equal(f.tables.report_card_audit!.length, 2); assert.equal(f.tables.report_card_releases!.length, 1);
});
test('snapshot, audit and receipt failures roll back approval and allow same-key retry', async () => {
 for (const name of ['report_card_snapshots','report_card_audit','report_card_operation_receipts']) {
  const f = fake(); const before = structuredClone(f.tables); f.fail(name);
  assert.deepEqual(await f.run(), { ok: false, code: 'transaction_failed' }); assert.deepEqual(f.tables, before);
  f.fail(null); assert.ok((await f.run()).ok); assert.equal(f.tables.report_card_snapshots!.length, 1);
 }
});
test('release or receipt failure rolls back publication and retry releases once', async () => {
 for (const name of ['report_card_releases','report_card_operation_receipts']) {
  const f = fake(); assert.ok((await f.run()).ok); const before = structuredClone(f.tables); f.fail(name);
  assert.deepEqual(await f.run(publish), { ok: false, code: 'transaction_failed' }); assert.deepEqual(f.tables, before);
  f.fail(null); assert.ok((await f.run(publish)).ok); assert.ok((await f.run(publish)).ok); assert.equal(f.tables.report_card_releases!.length, 1);
 }
});
test('teacher, suspended admin, forged report school and inactive submitter fail without mutation', async () => {
 const teacher = fake(); assert.deepEqual(await teacher.run(approve, 'auth'), { ok: false, code: 'forbidden' });
 const inactive = fake(); inactive.tables.memberships!.find(m => m.id === 'admin')!.status = 'suspended'; assert.deepEqual(await inactive.run(), { ok: false, code: 'forbidden' });
 const foreign = fake(); foreign.tables.report_cards![0]!.schoolId = 'foreign'; assert.deepEqual(await foreign.run(), { ok: false, code: 'not_found' });
 const submitter = fake(); submitter.tables.memberships!.find(m => m.id === 'teacher')!.status = 'suspended'; assert.deepEqual(await submitter.run(), { ok: false, code: 'forbidden' });
 for (const f of [teacher,inactive,foreign,submitter]) assert.equal(f.tables.report_card_snapshots!.length, 0);
});
test('stale report/source and invalid transitions cannot approve or publish', async () => {
 const stale = fake(); assert.deepEqual(await stale.run({ ...approve, expectedVersion: 1 }), { ok: false, code: 'stale_version' });
 const stage = fake(); assert.deepEqual(await stage.run({ ...publish, expectedVersion: 2 }), { ok: false, code: 'invalid_transition' });
 const source = fake(); source.tables.report_cards![0]!.assessmentSourceVersionId = 'other'; assert.deepEqual(await source.run(), { ok: false, code: 'stale_source' });
 assert.equal(source.tables.report_card_snapshots!.length, 0);
});
test('publication rejects modified payload even with attacker recomputed hash', async () => {
 const f = fake(); assert.ok((await f.run()).ok);
 const row = f.tables.report_card_snapshots![0]!; const payload = row.canonicalPayload as { subjects: { result: { total: string } }[] }; payload.subjects[0]!.result.total = '100.00';
 row.contentHash = createHash('sha256').update(canonicalizeSnapshotValue(payload)).digest('hex');
 assert.deepEqual(await f.run(publish), { ok: false, code: 'snapshot_mismatch' }); assert.equal(f.tables.report_card_releases!.length, 0);
});
test('invalid commands refuse before authentication and malformed replay receipts cannot succeed', async () => {
 const f = fake(); let authenticated = false;
 assert.deepEqual(await executeFixtureCanonicalReportCommand(f.db, 'public', approve, async () => { authenticated = true; return null; }), { ok: false, code: 'invalid' }); assert.equal(authenticated, false);
 assert.ok((await f.run()).ok); (f.tables.report_card_operation_receipts![0]!.outcome as { version: number }).version = 999;
 assert.deepEqual(await f.run(), { ok: false, code: 'invalid_receipt' });
});
