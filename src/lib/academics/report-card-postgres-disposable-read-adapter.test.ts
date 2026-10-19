import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { disposableAuthoritativeReadPort } from './report-card-postgres-disposable-read-adapter.ts';
import type { SqlClient } from './report-card-postgres-disposable-adapter';
import type { ReportRecord } from './report-card-workflow';
const schema = 'rc_it_0123456789abcdef';
function fixture() {
 const record: ReportRecord = { schoolId: 'school', studentId: 'student', classId: 'class', sessionId: 'session', termId: 'term', stage: 'draft', version: 1, assessmentVersion: 5, submittedBy: null, approvedBy: null, publishedAt: null, returnReason: null };
 const rows: Record<string, Record<string, unknown>[]> = {
  read_identities: [{ auth_user_id: 'auth' }],
  read_memberships: [{ id: 'teacher', auth_user_id: 'auth', school_id: 'school', role: 'teacher', status: 'active' }],
  read_reports: [{ id: 'report', enrollment_id: 'enrollment', record }],
  read_assignments: [{ id: 'assignment', school_id: 'school', membership_id: 'teacher', class_id: 'class', session_id: 'session', status: 'active' }],
  read_scopes: [{ revision: 5, academic: { schoolId: 'school', version: 5 } }],
  read_enrollments: [{ id: 'enrollment', school_id: 'school', student_id: 'student', class_id: 'class', session_id: 'session', status: 'active' }],
  read_subjects: [{ school_id: 'school', class_id: 'class', session_id: 'session', term_id: 'term', subject_id: 'math', finalized: true, assessment_revision: 5, config_revision: 2, source_revision: 3 }],
 };
 const calls: { query: string; parameters: unknown[] }[] = [];
 const connection: SqlClient = { async unsafe(query, parameters = []) {
  calls.push({ query, parameters });
  const name = Object.keys(rows).find(name => query.includes('"' + name + '"'));
  assert.ok(name, 'unexpected SQL table');
  assert.match(query, /FOR (SHARE|UPDATE)$/);
  return rows[name];
 } };
 const port = disposableAuthoritativeReadPort(connection, schema, async () => ({ authUserId: 'auth' }));
 const lock = async () => { await port.verifiedIdentity(); await port.lockMemberships('auth'); return (await port.lockReport('school', 'report'))!; };
 return { port, lock, record, rows, calls, connection };
}
test('rejects unsafe schema identifiers without issuing SQL', () => {
 const f = fixture(); assert.throws(() => disposableAuthoritativeReadPort(f.connection, 'public', async () => null)); assert.deepEqual(f.calls, []);
});
test('requires verified identity and locked school/report before source reads', async () => {
 const f = fixture(); await assert.rejects(f.port.lockMemberships('auth'));
 await assert.rejects(f.port.readAcademicSources(f.record));
 await f.port.verifiedIdentity(); await f.port.lockMemberships('auth');
 await assert.rejects(f.port.lockReport('foreign', 'report'));
 assert.equal(f.calls.length, 2);
});
test('uses school predicates, full session enrollment and persisted version tuple', async () => {
 const f = fixture(); const report = await f.lock();
 await f.port.readAssignments('school', 'teacher');
 const bundle = await f.port.readAcademicSources(report.record);
 assert.equal(bundle.sources.subjects[0]!.sourceVersionKey, '["math",2,3]');
 assert.equal(bundle.sources.enrollments[0]!.id, 'enrollment');
 assert.equal(await f.port.readCurrentRevision(report.record), 5);
 const enrollment = f.calls.find(c => c.query.includes('"read_enrollments"'))!;
 assert.deepEqual(enrollment.parameters, ['school', 'student', 'session']);
 assert.ok(!enrollment.query.includes('class_id=$'), 'must not hide duplicate active enrollment in another class');
 const scope = f.calls.filter(c => c.query.includes('"read_scopes"'));
 assert.equal(scope.length, 2);
 for (const call of scope) assert.deepEqual(call.parameters, ['school', 'class', 'session', 'term']);
 assert.match(f.calls.find(c => c.query.includes('"read_reports"'))!.query, /school_id=\$1 AND id=\$2 FOR UPDATE$/);
 await assert.rejects(f.port.readCurrentRevision({ ...report.record }));
});
test('fails closed on encoded JSON strings and mismatched report payload school', async () => {
 const f = fixture(); f.rows.read_reports[0]!.record = JSON.stringify(f.record); await assert.rejects(f.lock(), /decoded JSONB object/);
 const g = fixture(); g.record.schoolId = 'foreign'; await assert.rejects(g.lock(), /school mismatch/);
});
test('rejects invalid source revisions and malformed academic JSONB', async () => {
 const f = fixture(); const report = await f.lock();
 f.rows.read_subjects[0]!.source_revision = 0; await assert.rejects(f.port.readAcademicSources(report.record), /persisted subject revisions/);
 f.rows.read_subjects[0]!.source_revision = 3; f.rows.read_scopes[0]!.academic = 'encoded';
 await assert.rejects(f.port.readAcademicSources(report.record), /decoded JSONB object/);
});
