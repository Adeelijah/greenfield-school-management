import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { executeTrustedDisposableReport } from './report-card-postgres-disposable-trusted-transaction.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { initialAssessment, previewSchoolId } from '../../components/academics/calendar-assessment-fixtures.ts';
import type { SqlDatabase, SqlClient } from './report-card-postgres-disposable-adapter';
import type { ReportRecord } from './report-card-workflow';
const schema = 'rc_it_0123456789abcdef';
const input = { reportId: 'report', command: { action: 'submit' as const, expectedVersion: 1, assessmentVersion: initialAssessment.version, idempotencyKey: 'submit' } };
const identity = async () => ({ authUserId: 'auth' });
const now = () => '2026-10-19T09:00:00Z';
function fixture(failAudit = false) {
 const school = previewSchoolId;
 const record: ReportRecord = { schoolId: school, studentId: 'student-amina', classId: 'class-primary-5-cedar', sessionId: 'session-2026-27', termId: 'term-26-1', stage: 'draft', version: 1, assessmentVersion: initialAssessment.version, submittedBy: null, approvedBy: null, publishedAt: null, returnReason: null };
 let state = { record, audits: 0, receipts: [] as Record<string, unknown>[] };
 let begins = 0; let commits = 0; let rollbacks = 0;
 const calls: string[] = [];
 const db: SqlDatabase = {
  async unsafe() { throw Error('SQL must be transaction-bound'); },
  async begin<T>(callback: (tx: SqlClient) => Promise<T>): Promise<T> {
   begins++; const pending = structuredClone(state);
   const tx: SqlClient = { async unsafe(query, parameters = []) {
    calls.push(query);
    if (query.startsWith('SELECT')) {
     if (query.includes('"read_identities"')) return [{ auth_user_id: 'auth' }];
     if (query.includes('"read_memberships"')) return [{ id: 'teacher', auth_user_id: 'auth', school_id: school, role: 'teacher', status: 'active' }];
     if (query.includes('"read_reports"')) return [{ id: 'report', enrollment_id: 'enrollment', record: pending.record }];
     if (query.includes('"read_assignments"')) return [{ id: 'assignment', school_id: school, membership_id: 'teacher', class_id: record.classId, session_id: record.sessionId, status: 'active' }];
     if (query.includes('"read_scopes"')) return [{ revision: record.assessmentVersion, academic: { ...initialAssessment, subjects: initialAssessment.subjects.filter(s => s.id === 'subject-math'), finalizedKeys: [`${record.classId}:${record.sessionId}:${record.termId}:subject-math`] } }];
     if (query.includes('"read_enrollments"')) return [{ id: 'enrollment', school_id: school, student_id: record.studentId, class_id: record.classId, session_id: record.sessionId, status: 'active' }];
     if (query.includes('"read_subjects"')) return [{ school_id: school, class_id: record.classId, session_id: record.sessionId, term_id: record.termId, subject_id: 'subject-math', finalized: true, assessment_revision: record.assessmentVersion, config_revision: 1, source_revision: 1 }];
     if (query.includes('"receipts"')) return pending.receipts;
    }
    if (query.startsWith('UPDATE')) { pending.record = JSON.parse(parameters[1] as string); return [{ version: pending.record.version }]; }
    if (query.includes('INSERT INTO') && query.includes('"audits"')) { if (failAudit) throw Error('injected audit failure'); pending.audits++; return []; }
    if (query.includes('INSERT INTO') && query.includes('"receipts"')) { pending.receipts.push({ school_id: parameters[0], actor_id: parameters[1], operation_key: parameters[2], report_id: parameters[3], fingerprint: parameters[4], resulting_version: parameters[5] }); return []; }
    throw Error('Unexpected SQL');
   } };
   try { const result = await callback(tx); state = pending; commits++; return result; }
   catch (error) { rollbacks++; throw error; }
  },
 };
 return { db, state: () => structuredClone(state), counts: () => ({ begins, commits, rollbacks }), calls };
}
test('trusted read and write share exactly one owning transaction and server-derived actor', async () => {
 const f = fixture();
 const forged = { ...input, schoolId: 'forged', actorMembershipId: 'forged', fingerprint: 'forged' };
 assert.deepEqual(await executeTrustedDisposableReport(f.db, schema, forged, identity, now), { ok: true, kind: 'applied', version: 2 });
 assert.deepEqual(f.counts(), { begins: 1, commits: 1, rollbacks: 0 });
 assert.equal(f.state().record.submittedBy, 'teacher'); assert.equal(f.state().audits, 1);
 assert.equal(f.calls[0]!.includes('read_identities'), true);
 assert.ok(f.calls.findIndex(q => q.includes('read_scopes')) < f.calls.findIndex(q => q.startsWith('UPDATE')));
});
test('caught inner audit failure still rolls back outer report write', async () => {
 const f = fixture(true); const before = f.state();
 const result = await executeTrustedDisposableReport(f.db, schema, input, identity, now);
 assert.equal(result.ok, false); assert.equal(!result.ok && result.code, 'transaction_failed');
 assert.deepEqual(f.state(), before); assert.deepEqual(f.counts(), { begins: 1, commits: 0, rollbacks: 1 });
});
test('identical retries replay and a changed payload conflicts without additional writes', async () => {
 const f = fixture(); await executeTrustedDisposableReport(f.db, schema, input, identity, now);
 assert.deepEqual(await executeTrustedDisposableReport(f.db, schema, input, identity, now), { ok: true, kind: 'replay', version: 2 });
 const before = f.state();
 const result = await executeTrustedDisposableReport(f.db, schema, { ...input, command: { ...input.command, expectedVersion: 2 } }, identity, now);
 assert.equal(!result.ok && result.code, 'conflict'); assert.deepEqual(f.state(), before);
});
test('missing verified identity aborts before any SQL writes', async () => {
 const f = fixture();
 const result = await executeTrustedDisposableReport(f.db, schema, input, async () => null, now);
 assert.equal(!result.ok && result.code, 'unauthenticated'); assert.deepEqual(f.calls, []);
 assert.deepEqual(f.counts(), { begins: 1, commits: 0, rollbacks: 1 });
});
