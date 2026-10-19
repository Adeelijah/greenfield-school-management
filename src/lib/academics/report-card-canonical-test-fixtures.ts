// Fictional unit-test data only. Never import into application routes.
import assert from 'node:assert/strict';
import type { SqlClient, SqlDatabase } from './report-card-postgres-disposable-adapter';
import type { CompleteAssessmentSource, StoredAssessmentSource, StoredAssessmentFinalization, StoredAssessmentReview } from './assessment-canonical-source';
import type { CanonicalReportCommand } from './report-card-postgres-canonical-writer';
import type { ApprovedReportBinding, CanonicalAssessmentDocuments } from './report-card-approved-snapshot';
// @ts-expect-error Node type stripping requires explicit source extension.
import { materializeAssessmentSource } from './assessment-canonical-source.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { loadFixtureCompleteAssessment, readFixtureVerifiedCanonicalAssessment } from './assessment-postgres-canonical-reader.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { executeFixtureCanonicalReportCommand } from './report-card-postgres-canonical-writer.ts';
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

const approve: CanonicalReportCommand = {reportId:'report',action:'approve',expectedVersion:2,operationKey:'approve-1'};
export function createCanonicalWriterFixture() {
 const f = createCanonicalReaderFixture();
 f.tables.school_users!.push({ id: 'admin-user', authUserId: 'auth-admin' });
 f.tables.memberships!.push({ id: 'admin', schoolId: 'school', userId: 'admin-user', role: 'admin', status: 'active' });
 f.tables.report_cards = [{ id: 'report', schoolId: 'school', enrollmentId: 'enroll-a', studentId: 'a', classId: 'class', sessionId: 'session', termId: 'term', assessmentScopeId: 'scope', assessmentSourceVersionId: 'source', assessmentRevision: 4, stage: 'submitted', version: 2, submittedBy: 'teacher', approvedBy: null }];
 for (const name of ['report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases']) f.tables[name] = [];
 let failTable: string | null = null;
 const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
 const unsafe: SqlClient['unsafe'] = async (query, params = []) => {
  if (query.startsWith('SELECT pg_catalog.pg_advisory_xact_lock')) return [];
  const name = query.match(/(?:FROM|INTO|UPDATE) "rc_it_[a-f0-9]+"\."([a-z_]+)"/)?.[1]; assert.ok(name);
  if (query.startsWith('INSERT')) {
   if (name === failTable) throw Error('injected fixture persistence failure');
   const keys = query.match(/\(([^)]+)\) VALUES/)![1]!.split(',').map(camel);
   const row = Object.fromEntries(keys.map((key, i) => [key, ['canonicalPayload','sourceVersions','outcome'].includes(key) ? JSON.parse(params[i] as string) : params[i]]));
   if (name === 'report_cards') { Object.assign(row,{stage:'draft',version:1,submittedBy:null,approvedBy:null,returnReason:null}); f.tables[name]!.push(row); return [{id:row.id}]; }
   f.tables[name]!.push(row); return [];
  }
  if (name === 'report_cards' && query.startsWith('UPDATE')) {
   const row = f.tables.report_cards!.find(r => r.id === params[1] && r.schoolId === params[0]);
   const submit=query.includes("SET stage='submitted'"),returned=query.includes("SET stage='returned'"),reopen=query.includes("SET stage='draft'");
   const expected=submit?params[6]:reopen?params[3]:params[4];
   if (!row || row.version !== expected) return [];
   row.version=params[2];
   if(submit){Object.assign(row,{stage:'submitted',submittedBy:params[3],approvedBy:null,publishedAt:null,returnReason:null,assessmentSourceVersionId:params[4],assessmentRevision:params[5]});}
   else if(returned){Object.assign(row,{stage:'returned',approvedBy:null,publishedAt:null,returnReason:params[3]});}
   else if(reopen){Object.assign(row,{stage:'draft',submittedBy:null,approvedBy:null,publishedAt:null,returnReason:null});}
   else{row.stage=query.includes("SET stage='approved'")?'approved':'published';if(row.stage==='approved')row.approvedBy=params[3];else row.publishedAt=params[3];}
   return [{ id: row.id }];
  }
  if(name==='report_cards' && query.includes('AND student_id=$2'))return structuredClone(f.tables[name]!.filter(r=>r.schoolId===params[0]&&r.studentId===params[1]&&r.classId===params[2]&&r.sessionId===params[3]&&r.termId===params[4]));
  if (name === 'report_cards') return structuredClone(f.tables[name]!.filter(r => r.schoolId === params[0] && r.id === params[1]));
  if(name==='report_card_releases')return structuredClone(f.tables[name]!.filter(r=>r.schoolId===params[0]&&r.reportId===params[1]&&r.revokedAt==null));
  if(name==='teacher_class_assignments'&&params.length===4)return structuredClone(f.tables[name]!.filter(r=>r.schoolId===params[0]&&r.teacherMembershipId===params[1]&&r.classId===params[2]&&r.sessionId===params[3]&&r.endedAt===null));
  if (name === 'report_card_operation_receipts') return structuredClone(f.tables[name]!.filter(r => r.schoolId === params[0] && r.actorMembershipId === params[1] && r.operationKey === params[2]));
  if (name === 'report_card_snapshots') return structuredClone(f.tables[name]!.filter(r => r.schoolId === params[0] && r.reportId === params[1] && (query.includes('AND id=$3') ? r.id === params[2] && r.reportVersion === params[3] : r.reportVersion === params[2])));
  if (name === 'school_users') return structuredClone(f.tables[name]!.filter(r => r.authUserId === params[0]));
  if (name === 'memberships') {
   let rows = f.tables[name]!;
   if (query.includes('WHERE user_id=')) rows = rows.filter(r => r.userId === params[0]);
   else rows = rows.filter(r => r.schoolId === params[0] && r.id === params[1] && r.status === 'active' && r.role === (query.includes("role='teacher'") ? 'teacher' : 'admin'));
   if (query.includes('JOIN') && !f.tables.teacher_class_assignments!.some(a => a.teacherMembershipId === params[1] && a.classId === params[2] && a.sessionId === params[3] && a.endedAt === null)) rows = [];
   return structuredClone(rows);
  }
  return f.tx.unsafe(query, params);
 };
 const db: SqlDatabase = { unsafe, async begin(callback) {
  const before = structuredClone(f.tables);
  try { return await callback({ unsafe }); } catch (error) { for (const key of Object.keys(f.tables)) delete f.tables[key]; Object.assign(f.tables, before); throw error; }
 } };
 return { ...f, db, fail: (name: string | null) => { failTable = name; }, run: (command = approve, authUserId = 'auth-admin') => executeFixtureCanonicalReportCommand(db, schema, command, async () => ({ authUserId })) };
}
