// Fictional unit-test data only. Never import into application routes.
import assert from 'node:assert/strict';
import type { SqlClient } from './report-card-postgres-disposable-adapter';
import type { CompleteAssessmentSource, StoredAssessmentSource, StoredAssessmentFinalization, StoredAssessmentReview } from './assessment-canonical-source';
import type { ApprovedReportBinding, CanonicalAssessmentDocuments } from './report-card-approved-snapshot';
// @ts-expect-error Node type stripping requires explicit source extension.
import { materializeAssessmentSource } from './assessment-canonical-source.ts';
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
export function createCanonicalReaderFixture() {
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
export function createApprovedSnapshotFixture(stage: 'primary' | 'creche' | 'nursery' = 'primary'): { docs: CanonicalAssessmentDocuments; binding: ApprovedReportBinding } {
 const input = fixture();
 if (stage !== 'primary') {
  input.level.stage = stage; input.level.primaryYear = null;
  input.configs[0]!.config.grading = { mode: 'observational', levels: [{ id:'emerging',label:'Emerging' },{ id:'consistent',label:'Consistent' }] };
  input.scores = input.scores.map(s => ({ ...s,numericScore:null,observationKey:'consistent' }));
 }
 const built = materializeAssessmentSource(input); assert.ok(built.ok);
 const source: StoredAssessmentSource = { id: 'source', schoolId: 'school', scopeId: 'scope', revision: 4, sourceManifest: JSON.parse(built.materialized.manifest.canonicalJson), contentHash: built.materialized.manifest.sha256 };
 const finals: StoredAssessmentFinalization[] = built.materialized.subjects.map(s => ({ id: 'final', schoolId: 'school', scopeId: 'scope', rosterId: s.rosterId, sourceVersionId: 'source', teacherReviewId: 'review', finalizedBy: 'admin', results: JSON.parse(s.results.canonicalJson), contentHash: s.results.sha256 }));
 const reviews: StoredAssessmentReview[] = [{ id: 'review', schoolId: 'school', scopeId: 'scope', rosterId: 'roster', sourceVersionId: 'source', reviewerMembershipId: 'teacher' }];
 return { docs: { input, source, finals, reviews }, binding: { id: 'report', schoolId: 'school', enrollmentId: 'enroll-a', studentId: 'a', classId: 'class', sessionId: 'session', termId: 'term', assessmentScopeId: 'scope', assessmentSourceVersionId: 'source', assessmentRevision: 4, approvedVersion: 3, submittedBy: 'teacher', approvedBy: 'admin', approvedAt: '2026-10-19T15:00:00.000Z' } };
}
