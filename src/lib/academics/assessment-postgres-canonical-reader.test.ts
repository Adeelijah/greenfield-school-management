import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { SqlClient } from './report-card-postgres-disposable-adapter';
import type { CompleteAssessmentSource } from './assessment-canonical-source';
// @ts-expect-error Node type stripping requires explicit source extension.
import { materializeAssessmentSource } from './assessment-canonical-source.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { loadFixtureCompleteAssessment, readFixtureVerifiedCanonicalAssessment } from './assessment-postgres-canonical-reader.ts';
const schema = 'rc_it_0123456789abcdef';
const selector = { classId: 'class', sessionId: 'session', termId: 'term' };
function fixture(): CompleteAssessmentSource {
 return {
  scope: { id: 'scope', schoolId: 'school', classId: 'class', sessionId: 'session', termId: 'term', revision: 4 }, school: { id: 'school', finalPrimaryYear: 5 },
  klass: { id: 'class', schoolId: 'school', levelId: 'level', sectionId: 'section' }, level: { id: 'level', schoolId: 'school', stage: 'primary', primaryYear: 5, isActive: true }, section: { id: 'section', schoolId: 'school', levelId: 'level', isActive: true },
  session: { id: 'session', schoolId: 'school', startsOn: '2026-09-01', endsOn: '2027-07-31', isCurrent: false }, term: { id: 'term', schoolId: 'school', sessionId: 'session', startsOn: '2026-09-01', endsOn: '2026-12-18', isCurrent: false },
  students: ['a', 'b'].map(id => ({ id, schoolId: 'school', status: 'active' })), enrollments: ['a', 'b'].map(id => ({ id: 'enroll-' + id, schoolId: 'school', studentId: id, classId: 'class', sessionId: 'session', status: 'active' })),
  roster: [{ id: 'roster', schoolId: 'school', scopeId: 'scope', subjectId: 'math', rosterVersion: 2, configVersionId: 'config', isActive: true }], catalog: [{ id: 'math', schoolId: 'school', code: 'MAT', name: 'Mathematics', version: 1, isActive: true }],
  configs: [{ sessionId: 'session', config: { id: 'config', schoolId: 'school', levelId: 'level', subjectId: 'math', termId: 'term', version: 3, status: 'finalized', components: [{ id: 'exam', label: 'Exam', category: 'exam', weight: 100, maximumScore: 100, required: true }], grading: { mode: 'numeric', bands: [{ min: 0, max: 70, label: 'B' }, { min: 70, max: 100, label: 'A' }] } } }],
  scores: ['a', 'b'].map((id, i) => ({ id: 'score-' + id, schoolId: 'school', rosterId: 'roster', configVersionId: 'config', enrollmentId: 'enroll-' + id, studentId: id, componentKey: 'exam', numericScore: i ? '69.9950' : '86.1250', observationKey: null, version: 2, updatedBy: 'teacher' })),
 };
}
function mock() {
 const input = fixture(); const built = materializeAssessmentSource(input); assert.ok(built.ok);
 const c = input.configs[0]!.config;
 const tables: Record<string, Record<string, unknown>[]> = {
  fixture_source_write_gate: [{ id: 1 }], school_users: [{ id: 'user', authUserId: 'auth' }], memberships: [{ id: 'teacher', schoolId: 'school', userId: 'user', role: 'teacher', status: 'active' }], schools: [{ id: 'school', finalPrimaryYear: 5 }],
  assessment_scopes: [input.scope], classes: [input.klass], academic_levels: [input.level], academic_sections: [input.section], academic_sessions: [input.session], terms: [input.term], students: [...input.students], enrollments: [...input.enrollments],
  teacher_class_assignments: [{ id: 'assignment', schoolId: 'school', teacherMembershipId: 'teacher', classId: 'class', sessionId: 'session', endedAt: null }],
  assessment_subject_roster: input.roster.map(r => ({ ...r, subject_id: r.subjectId, config_version_id: r.configVersionId })), assessment_subjects: [...input.catalog],
  assessment_config_versions: [{ ...c, sessionId: 'session', revision: c.version, state: c.status, mode: c.grading.mode }], assessment_teacher_subjects: [{ id: 'link' }],
  assessment_scores: [...input.scores],
  assessment_source_versions: [{ id: 'source', schoolId: 'school', scopeId: 'scope', revision: 4, sourceManifest: JSON.parse(built.materialized.manifest.canonicalJson), contentHash: built.materialized.manifest.sha256 }],
  assessment_teacher_reviews: [{ id: 'review', schoolId: 'school', scopeId: 'scope', rosterId: 'roster', sourceVersionId: 'source', reviewerMembershipId: 'teacher' }],
  assessment_finalizations: [{ id: 'final', schoolId: 'school', scopeId: 'scope', rosterId: 'roster', sourceVersionId: 'source', teacherReviewId: 'review', reviewId: 'review', finalizedBy: 'admin', results: JSON.parse(built.materialized.subjects[0]!.results.canonicalJson), contentHash: built.materialized.subjects[0]!.results.sha256 }],
 };
 const calls: { query: string; params: unknown[] }[] = [];
 const tx: SqlClient = { async unsafe(query, params = []) {
  calls.push({ query, params }); const table = query.match(/FROM "rc_it_[a-f0-9]+"\."([a-z_]+)"/)?.[1]; assert.ok(table); assert.ok(tables[table]);
  const rows = tables[table];
  if (table === 'assessment_scores' && query.includes('AND student_id=$3::uuid')) return structuredClone(rows.filter(r => r.studentId === params[2]));
  return structuredClone(rows);
 } };
 return { input, tables, calls, tx, load: () => loadFixtureCompleteAssessment(tx, schema, selector, async () => ({ authUserId: 'auth' })), read: () => readFixtureVerifiedCanonicalAssessment(tx, schema, selector, async () => ({ authUserId: 'auth' })) };
}
test('complete reader discovers both students, verifies JSONB documents and only reads', async () => {
 const f = mock(); const result = await f.read(); assert.ok(result.ok, JSON.stringify(result));
 assert.equal(result.input.students.length, 2); assert.equal(result.sourceVersionId, 'source');
 assert.equal(f.calls[0]!.query.includes('fixture_source_write_gate'), true);
 assert.ok(f.calls.every(c => c.query.startsWith('SELECT') && c.query.includes('FOR SHARE')));
 assert.ok(f.calls.some(c => c.query.includes('FOR SHARE OF f,r,m,rm,ra,rl')));
});
test('candidate loader works before source version or finalization exists', async () => {
 const f = mock(); f.tables.assessment_source_versions = []; f.tables.assessment_finalizations = [];
 assert.ok((await f.load()).ok); assert.deepEqual(await f.read(), { ok: false, code: 'incomplete_source' });
});
test('missing identity, unsafe schema and client school fields cannot supply authority', async () => {
 const f = mock(); assert.deepEqual(await loadFixtureCompleteAssessment(f.tx, schema, selector, async () => null), { ok: false, code: 'unauthenticated' });
 assert.deepEqual(await loadFixtureCompleteAssessment(f.tx, 'public', selector, async () => ({ authUserId: 'auth' })), { ok: false, code: 'invalid_reference' }); assert.equal(f.calls.length, 0);
 const forged = { ...selector, schoolId: 'foreign', role: 'admin', studentIds: ['a'] };
 const read = await loadFixtureCompleteAssessment(f.tx, schema, forged, async () => ({ authUserId: 'auth' })); assert.ok(read.ok); assert.equal(read.input.scope.schoolId, 'school'); assert.equal(read.input.students.length, 2);
});
test('conflicting active enrollment in another class stays visible and rejects completeness', async () => {
 const f = mock(); f.tables.enrollments!.push({ ...f.tables.enrollments![0]!, id: 'conflict', classId: 'other' });
 assert.deepEqual(await f.load(), { ok: false, code: 'incomplete_source' });
 const query = f.calls.find(c => c.query.includes('FROM "' + schema + '"."enrollments"'))!.query;
 assert.ok(query.includes("session_id=$3::uuid AND status='active' AND student_id IN (SELECT"));
});
test('score omission for the second student and wrong enrollment cannot hide behind a valid first student', async () => {
 const f = mock(); f.tables.assessment_scores = f.tables.assessment_scores!.slice(0, 1); assert.deepEqual(await f.read(), { ok: false, code: 'incomplete_source' });
 const g = mock(); g.tables.assessment_scores![1]!.enrollmentId = 'foreign'; assert.deepEqual(await g.read(), { ok: false, code: 'incomplete_source' });
});
test('class/subject permission denies before score data is loaded', async () => {
 for (const table of ['teacher_class_assignments', 'assessment_teacher_subjects']) {
  const f = mock(); f.tables[table] = []; assert.deepEqual(await f.load(), { ok: false, code: 'forbidden' });
  assert.equal(f.calls.some(c => c.query.includes('FROM "' + schema + '"."assessment_scores"')), false);
 }
});
test('selected-column decoding rejects coerced versions, booleans, dates and config modes', async () => {
 for (const [table, key, value] of [['assessment_scopes', 'revision', '4'], ['academic_levels', 'isActive', 'true'], ['academic_sessions', 'isCurrent', 0], ['assessment_scores', 'version', '2'], ['assessment_config_versions', 'mode', 'observational']]) {
  const f = mock(); f.tables[table as string]![0]![key as string] = value; assert.deepEqual(await f.load(), { ok: false, code: 'read_failed' });
 }
});
test('legacy minimal or encoded manifests and forged recalculated results are rejected', async () => {
 for (const value of [{ fixture: true }, JSON.stringify({ fixture: true })]) {
  const f = mock(); f.tables.assessment_source_versions![0]!.sourceManifest = value; assert.deepEqual(await f.read(), { ok: false, code: 'source_mismatch' });
 }
 const f = mock(); const row = f.tables.assessment_finalizations![0]!; const changed = structuredClone(row.results) as { students: { result: { total: string } }[] }; changed.students[1]!.result.total = '100.00';
 row.results = changed; row.contentHash = createHash('sha256').update(canonicalizeSnapshotValue(changed)).digest('hex');
 assert.deepEqual(await f.read(), { ok: false, code: 'finalization_mismatch' });
});
test('wrong source or review identity cannot reuse correct content', async () => {
 const f = mock(); f.tables.assessment_finalizations![0]!.sourceVersionId = 'other'; assert.deepEqual(await f.read(), { ok: false, code: 'finalization_mismatch' });
 const g = mock(); g.tables.assessment_teacher_reviews![0]!.reviewerMembershipId = 'admin'; assert.deepEqual(await g.read(), { ok: false, code: 'finalization_mismatch' });
});
test('database errors are generic and no write is attempted', async () => {
 const tx: SqlClient = { async unsafe() { throw Error('private connection data'); } };
 assert.deepEqual(await loadFixtureCompleteAssessment(tx, schema, selector, async () => ({ authUserId: 'auth' })), { ok: false, code: 'read_failed' });
});
