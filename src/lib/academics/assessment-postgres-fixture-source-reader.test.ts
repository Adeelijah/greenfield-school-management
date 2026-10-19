import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { readFixtureRelationalAssessment } from './assessment-postgres-fixture-source-reader.ts';
import type { SqlClient } from './report-card-postgres-disposable-adapter';
const schema = 'rc_it_0123456789abcdef';
const selector = { studentId: 'student', enrollmentId: 'enrollment', classId: 'class', sessionId: 'session', termId: 'term' };
function fixture() {
 const tables: Record<string, Record<string, unknown>[]> = {
  fixture_source_write_gate: [{ id: 1 }], school_users: [{ id: 'user', authUserId: 'auth' }], memberships: [{ id: 'teacher', schoolId: 'school', userId: 'user', role: 'teacher', status: 'active' }], schools: [{ id: 'school', finalPrimaryYear: 5 }],
  assessment_scopes: [{ id: 'scope', revision: 4 }], students: [{ id: 'student', schoolId: 'school', status: 'active' }], enrollments: [{ id: 'enrollment', schoolId: 'school', studentId: 'student', classId: 'class', sessionId: 'session', status: 'active' }],
  classes: [{ id: 'class', schoolId: 'school', levelId: 'level', sectionId: 'section' }], academic_levels: [{ id: 'level', schoolId: 'school', stage: 'primary', primaryYear: 5, isActive: true }], academic_sections: [{ id: 'section', schoolId: 'school', levelId: 'level', isActive: true }],
  academic_sessions: [{ id: 'session', schoolId: 'school', startsOn: '2026-09-01', endsOn: '2027-07-31', isCurrent: false }], terms: [{ id: 'term', schoolId: 'school', sessionId: 'session', startsOn: '2026-09-01', endsOn: '2026-12-18', isCurrent: false }],
  teacher_class_assignments: [{ id: 'assignment', schoolId: 'school', teacherMembershipId: 'teacher', classId: 'class', sessionId: 'session', endedAt: null }],
  assessment_subject_roster: [{ id: 'roster', subject_id: 'math', config_version_id: 'config' }], assessment_source_versions: [{ id: 'source' }], assessment_subjects: [{ id: 'math' }],
  assessment_config_versions: [{ id: 'config', schoolId: 'school', levelId: 'level', sessionId: 'session', termId: 'term', subjectId: 'math', revision: 1, mode: 'numeric', state: 'finalized', components: [{ id: 'exam', label: 'Exam', category: 'exam', weight: 100, maximumScore: 100, required: true }], grading: { mode: 'numeric', bands: [{ min: 0, max: 100, label: 'A' }] } }],
  assessment_teacher_subjects: [{ id: 'link' }], assessment_scores: [{ componentKey: 'exam', numericScore: '86.0000', observationKey: null, version: 2, configVersionId: 'config', enrollmentId: 'enrollment' }], assessment_finalizations: [{ id: 'final', reviewId: 'review' }],
 };
 const calls: { query: string; params: unknown[] }[] = [];
 const tx: SqlClient = { async unsafe(query, params = []) { calls.push({ query, params }); const table = query.match(/FROM "rc_it_[a-f0-9]+"\."([a-z_]+)"/)?.[1]; assert.ok(table); assert.ok(tables[table]); return structuredClone(tables[table]); } };
 return { tables, calls, tx, read: () => readFixtureRelationalAssessment(tx, schema, selector, async () => ({ authUserId: 'auth' })) };
}
test('loads joined source rows with discovery gate first and preserves decimal text', async () => {
 const f = fixture(); const result = await f.read(); assert.ok(result.ok);
 assert.equal(result.source.identity.membership.id, 'teacher'); assert.equal(result.source.revision, 4);
 assert.equal(result.source.subjects[0]!.scores[0]!.numericScore, '86.0000');
 assert.ok(f.calls[0]!.query.includes('fixture_source_write_gate'));
 assert.ok(f.calls.every(c => !c.query.startsWith('UPDATE') && !c.query.startsWith('INSERT')));
 const enroll = f.calls.find(c => c.query.includes('FROM "' + schema + '"."enrollments"'))!;
 assert.equal(enroll.query.includes('class_id=$'), false); assert.deepEqual(enroll.params, ['school', 'student', 'session']);
});
test('missing identity and unsafe schema fail before relational queries', async () => {
 const f = fixture(); assert.deepEqual(await readFixtureRelationalAssessment(f.tx, schema, selector, async () => null), { ok: false, code: 'unauthenticated' });
 assert.deepEqual(await readFixtureRelationalAssessment(f.tx, 'public', selector, async () => ({ authUserId: 'auth' })), { ok: false, code: 'invalid_reference' });
 assert.deepEqual(f.calls, []);
});
test('pinned config must match class level, subject, term/session, mode and finalized state', async () => {
 for (const patch of [{ sessionId: 'other' }, { levelId: 'other' }, { subjectId: 'other' }, { state: 'draft' }, { mode: 'observational' }]) {
  const f = fixture(); Object.assign(f.tables.assessment_config_versions![0]!, patch);
  assert.deepEqual(await f.read(), { ok: false, code: 'incomplete_source' });
 }
});
test('scores must match enrollment/config and required components with valid decimal bounds', async () => {
 for (const patch of [{ configVersionId: 'other' }, { enrollmentId: 'other' }, { numericScore: '100.0001' }, { numericScore: '1e2' }]) {
  const f = fixture(); Object.assign(f.tables.assessment_scores![0]!, patch); assert.deepEqual(await f.read(), { ok: false, code: 'incomplete_source' });
 }
 const f = fixture(); f.tables.assessment_scores = []; assert.deepEqual(await f.read(), { ok: false, code: 'incomplete_source' });
});
test('missing teacher subject link, current source or finalization denies the read', async () => {
 const f = fixture(); f.tables.assessment_teacher_subjects = []; assert.deepEqual(await f.read(), { ok: false, code: 'forbidden' });
 for (const table of ['assessment_source_versions', 'assessment_finalizations']) { const g = fixture(); g.tables[table] = []; assert.deepEqual(await g.read(), { ok: false, code: 'incomplete_source' }); }
});
test('early-years text rubric keys remain text and are validated without engine coercion', async () => {
 const f = fixture(); Object.assign(f.tables.academic_levels![0]!, { stage: 'creche', primaryYear: null });
 Object.assign(f.tables.assessment_config_versions![0]!, { mode: 'observational', grading: { mode: 'observational', levels: [{ id: 'emerging', label: 'Emerging' }, { id: 'consistent', label: 'Consistent' }] } });
 Object.assign(f.tables.assessment_scores![0]!, { numericScore: null, observationKey: 'consistent' });
 const result = await f.read(); assert.ok(result.ok); assert.equal(result.source.subjects[0]!.scores[0]!.observationKey, 'consistent');
});
test('database errors remain generic and disclose no source or credential detail', async () => {
 const f = fixture(); f.tx.unsafe = async () => { throw Error('sensitive source detail'); };
 assert.deepEqual(await f.read(), { ok: false, code: 'read_failed' });
});
