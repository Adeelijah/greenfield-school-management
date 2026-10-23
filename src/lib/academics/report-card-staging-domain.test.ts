import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlClient, SqlDatabase } from './report-card-postgres-disposable-adapter';
import type { PersistedReportWorkflowCommand } from './report-card-postgres-workflow-writer';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { stagingReportSqlScope, fixtureReportSqlScope, isReportSqlScope } from './report-card-sql-scope.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { createCanonicalWriterFixture } from './report-card-canonical-test-fixtures.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { materializeAssessmentSource } from './assessment-canonical-source.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { executeReportWorkflowInScope, executeFixtureReportWorkflow } from './report-card-postgres-workflow-writer.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { executeCanonicalReportCommandInScope, executeFixtureCanonicalReportCommand } from './report-card-postgres-canonical-writer.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { executeReportRevocationInScope, executeFixtureReportRevocation } from './report-card-postgres-revoke-writer.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { loadCompleteAssessmentInScope, readVerifiedCanonicalAssessmentInScope, loadFixtureCompleteAssessment, readFixtureVerifiedCanonicalAssessment } from './assessment-postgres-canonical-reader.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { readRelationalAssessmentInScope, readFixtureRelationalAssessment } from './assessment-postgres-fixture-source-reader.ts';

const schoolId = '00000000-0000-0000-0000-000000000090';
const config = { mode: 'isolated-staging-review', schema: 'public', schoolId, loginRole: 'greenfield_app', commandRole: 'greenfield_report_card_runtime' } as const;
const selector = { classId: 'class', sessionId: 'session', termId: 'term' };
function fixture() {
  const f = createCanonicalWriterFixture();
  const replaceSchool = <T>(value: T): T => JSON.parse(JSON.stringify(value), (_key, selected) => selected === 'school' ? schoolId : selected);
  Object.assign(f.input, replaceSchool(f.input));
  Object.assign(f.tables, replaceSchool(f.tables));
  const built = materializeAssessmentSource(f.input); assert.ok(built.ok);
  Object.assign(f.tables.assessment_source_versions![0]!, { sourceManifest: JSON.parse(built.materialized.manifest.canonicalJson), contentHash: built.materialized.manifest.sha256 });
  Object.assign(f.tables.assessment_finalizations![0]!, { results: JSON.parse(built.materialized.subjects[0]!.results.canonicalJson), contentHash: built.materialized.subjects[0]!.results.sha256 });
  const calls: string[] = [];
  let loginRole = 'greenfield_app', executionRole = 'greenfield_report_card_runtime', ambiguous = false;
  const scope = stagingReportSqlScope(config);
  const connect = (tx: SqlClient): SqlClient => ({ async unsafe(query, params = []) {
    calls.push(query);
    if (query.startsWith('SELECT session_user')) return [{ loginRole, executionRole }];
    if (query.includes('assessment_source_write_gate')) return [{ id: 1 }];
    if (query.includes('public.lock_report_card_actor')) {
      const user = f.tables.school_users!.find(r => r.authUserId === params[0]);
      const membership = f.tables.memberships!.find(r => r.userId === user?.id && r.status === 'active');
      return user && membership ? [{ auth_user_id: params[0], school_user_id: user.id, membership_id: membership.id, school_id: schoolId,
        role: membership.role, status: membership.status, final_primary_year: 5, school_user_count: 1, active_membership_count: ambiguous ? 2 : 1 }] : [];
    }
    assert.doesNotMatch(query, /rc_it_|fixture_source_write_gate/);
    // Recorder transport only: reuse the established fictional row engine.
    return tx.unsafe(query.replaceAll('"public".', '"rc_it_0123456789abcdef".'), params);
  } });
  const db: SqlDatabase = { unsafe() { throw Error('Transaction required'); }, begin: work => f.db.begin(tx => work(connect(tx))) };
  const workflow = (command: PersistedReportWorkflowCommand, authUserId = 'auth') => executeReportWorkflowInScope(db, scope, command, async () => ({ authUserId }));
  const canonical = (action: 'approve' | 'publish', expectedVersion: number, operationKey: string = action) => executeCanonicalReportCommandInScope(db, scope, { action, expectedVersion, operationKey, reportId: 'report' }, async () => ({ authUserId: 'auth-admin' }));
  return { ...f, calls, scope, db, workflow, canonical, connect,
    setRoles(login: string, execution: string) { loginRole = login; executionRole = execution; },
    setAmbiguous() { ambiguous = true; } };
}

test('issued scope captures fixed configuration and rejects public fixture or reconstructed capabilities', () => {
  const scope = stagingReportSqlScope(config);
  assert.ok(Object.isFrozen(scope)); assert.ok(isReportSqlScope(scope));
  assert.equal(isReportSqlScope({ ...scope }), false);
  assert.equal(fixtureReportSqlScope('public'), null);
  for (const change of [{ schema: 'other' }, { mode: 'production' }, { schoolId: 'school' }, { loginRole: 'postgres' }]) {
    assert.throws(() => stagingReportSqlScope({ ...config, ...change } as typeof config));
  }
});

test('all original fixture entries reject public before authentication or SQL', async () => {
  const db = { unsafe() { throw Error('Unexpected SQL'); }, async begin() { throw Error('Unexpected begin'); } };
  const identity = async (): Promise<never> => { throw Error('Unexpected identity'); };
  const results = await Promise.all([
    executeFixtureReportWorkflow(db, 'public', { action: 'reopen', reportId: 'report', expectedVersion: 3, operationKey: 'x' }, identity),
    executeFixtureCanonicalReportCommand(db, 'public', { action: 'approve', reportId: 'report', expectedVersion: 2, operationKey: 'x' }, identity),
    executeFixtureReportRevocation(db, 'public', {}, identity),
    loadFixtureCompleteAssessment(db, 'public', selector, identity), readFixtureVerifiedCanonicalAssessment(db, 'public', selector, identity),
    readFixtureRelationalAssessment(db, 'public', { ...selector, studentId: 'a', enrollmentId: 'enroll-a' }, identity),
  ]);
  assert.ok(results.every(result => !result.ok));
});

test('public complete and relational readers recompute full source under complete fixed-school authority', async () => {
  const f = fixture();
  const results = await f.db.begin(async tx => [
    await loadCompleteAssessmentInScope(tx, f.scope, selector, async () => ({ authUserId: 'auth' })),
    await readVerifiedCanonicalAssessmentInScope(tx, f.scope, selector, async () => ({ authUserId: 'auth' })),
    await readRelationalAssessmentInScope(tx, f.scope, { ...selector, studentId: 'a', enrollmentId: 'enroll-a' }, async () => ({ authUserId: 'auth' })),
  ]);
  assert.ok(results.every(result => result.ok), JSON.stringify(results));
  assert.ok(f.calls.findIndex(q => q.includes('assessment_source_write_gate')) < f.calls.findIndex(q => q.includes('lock_report_card_actor')));
  assert.equal(f.calls.some(q => /^(INSERT|UPDATE|DELETE)/.test(q)), false);
});

test('public workflow, independent approval, reopen and withdrawal preserve snapshots and historical replay', async () => {
  const f = fixture();
  const returned = await f.workflow({ action: 'return', reportId: 'report', expectedVersion: 2, operationKey: 'return', reason: 'Review' }, 'auth-admin'); assert.ok(returned.ok);
  assert.ok((await f.workflow({ action: 'submit', reportId: 'report', expectedVersion: 3, operationKey: 'resubmit' })).ok);
  assert.ok((await f.canonical('approve', 4)).ok);
  assert.ok((await f.workflow({ action: 'reopen', reportId: 'report', expectedVersion: 5, operationKey: 'reopen' }, 'auth-admin')).ok);
  assert.ok((await f.workflow({ action: 'submit', reportId: 'report', expectedVersion: 6, operationKey: 'submit-again' })).ok);
  const approved = await f.canonical('approve', 7, 'approve-again'); assert.ok(approved.ok);
  assert.ok((await f.canonical('publish', 8)).ok);
  const release = f.tables.report_card_releases![0]!;
  const command = { action: 'revoke', reportId: 'report', releaseId: release.id, expectedVersion: 9, operationKey: 'withdraw', reason: 'Correct result' };
  const withdrawn = await executeReportRevocationInScope(f.db, f.scope, command, async () => ({ authUserId: 'auth-admin' })); assert.ok(withdrawn.ok, JSON.stringify(withdrawn));
  const before = structuredClone(f.tables);
  assert.deepEqual(await executeReportRevocationInScope(f.db, f.scope, command, async () => ({ authUserId: 'auth-admin' })), { ...withdrawn, kind: 'replay' });
  assert.deepEqual(f.tables, before); assert.equal(f.tables.report_card_snapshots!.length, 2);
  assert.equal(release.snapshotId, approved.snapshotId);
  const made = await f.workflow({ action: 'create', studentId: 'b', enrollmentId: 'enroll-b', ...selector, operationKey: 'create-b' }); assert.ok(made.ok, JSON.stringify(made));
});

test('public domain denies owner fallback and hidden membership ambiguity before report discovery', async () => {
  for (const mutation of ['login', 'role', 'ambiguity']) {
    const f = fixture();
    if (mutation === 'login') f.setRoles('postgres', 'greenfield_report_card_runtime');
    if (mutation === 'role') f.setRoles('greenfield_app', 'postgres');
    if (mutation === 'ambiguity') f.setAmbiguous();
    const before = structuredClone(f.tables);
    assert.deepEqual(await f.canonical('approve', 2), { ok: false, code: 'forbidden' });
    assert.equal(f.calls.some(q => q.includes('"report_cards"')), false); assert.deepEqual(f.tables, before);
  }
});

test('public post-write persistence failure rolls back every effect and same key retries once', async () => {
  const f = fixture(), before = structuredClone(f.tables);
  f.fail('report_card_operation_receipts');
  assert.deepEqual(await f.canonical('approve', 2), { ok: false, code: 'transaction_failed' }); assert.deepEqual(f.tables, before);
  f.fail(null); const applied = await f.canonical('approve', 2); assert.ok(applied.ok);
  assert.deepEqual(await f.canonical('approve', 2), { ...applied, kind: 'replay' });
  assert.equal(f.tables.report_card_snapshots!.length, 1);
});
