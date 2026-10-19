// Schema-faithful fixture source reader. Not a production adapter or report projection.
import type { SqlClient } from './report-card-postgres-disposable-adapter';
import type { PersistedIdentityRows, PersistedPlacementRows, MappedReportIdentity } from './report-card-persisted-model-map';
import type { AssessmentConfig } from './calendar-assessments';
// @ts-expect-error Node type stripping requires explicit source extension.
import { mapPersistedReportIdentity, mapPersistedReportPlacement } from './report-card-persisted-model-map.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { validateConfigForPersistence, validatePersistedScore } from './assessment-persistence-policy.ts';

export type FixtureAssessmentSelector = { studentId: string; enrollmentId: string; classId: string; sessionId: string; termId: string };
export type RelationalSubjectSource = { rosterId: string; subjectId: string; config: AssessmentConfig; scores: readonly { componentKey: string; numericScore: string | null; observationKey: string | null; version: number }[]; finalizationId: string; teacherReviewId: string };
export type RelationalAssessmentSource = { identity: MappedReportIdentity; scopeId: string; revision: number; sourceVersionId: string; subjects: readonly RelationalSubjectSource[] };
export type RelationalSourceOutcome = { ok: true; source: RelationalAssessmentSource } | { ok: false; code: 'unauthenticated' | 'forbidden' | 'invalid_reference' | 'incomplete_source' | 'read_failed' };
const decoded = <T>(value: unknown): T => {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Decoded object required');
 return value as T;
};
/** connection must be one already-open transaction. This is READ-ONLY and takes
 * the shared discovery gate before relational discovery. Never upgrade it into
 * a source write; a future writing adapter must take an exclusive gate first.
 * Caller supplies only selectors, not school/actor/config/score authority.
 */
export async function readFixtureRelationalAssessment(
 connection: SqlClient, schema: string, selector: FixtureAssessmentSelector,
 verifiedIdentity: () => Promise<{ authUserId: string } | null>,
): Promise<RelationalSourceOutcome> {
 if (!/^rc_it_[a-f0-9]{16}$/.test(schema)) return { ok: false, code: 'invalid_reference' };
 if (!selector) return { ok: false, code: 'invalid_reference' };
 selector = { studentId: selector.studentId, enrollmentId: selector.enrollmentId, classId: selector.classId, sessionId: selector.sessionId, termId: selector.termId };
 const table = (name: string) => '"' + schema + '"."' + name + '"';
 try {
  const auth = await verifiedIdentity();
  if (!auth?.authUserId?.trim()) return { ok: false, code: 'unauthenticated' };
  if (!selector || Object.values(selector).some(v => typeof v !== 'string' || !v.trim())) return { ok: false, code: 'invalid_reference' };
  const gate = await connection.unsafe('SELECT id FROM ' + table('fixture_source_write_gate') + ' WHERE id=1 FOR SHARE');
  if (gate.length !== 1) return { ok: false, code: 'read_failed' };
  const users = await connection.unsafe('SELECT id,auth_user_id AS "authUserId" FROM ' + table('school_users') + ' WHERE auth_user_id=$1::uuid FOR SHARE', [auth.authUserId]);
  if (users.length !== 1) return { ok: false, code: 'forbidden' };
  const memberships = await connection.unsafe('SELECT id,school_id AS "schoolId",user_id AS "userId",role,status FROM ' + table('memberships') + ' WHERE user_id=$1::uuid ORDER BY school_id,id FOR SHARE', [users[0].id]);
  const schools = await connection.unsafe('SELECT s.id,s.final_primary_year AS "finalPrimaryYear" FROM ' + table('schools') + ' s WHERE s.id IN (SELECT school_id FROM ' + table('memberships') + ' WHERE user_id=$1::uuid) ORDER BY s.id FOR SHARE', [users[0].id]);
  const mapped = mapPersistedReportIdentity(auth.authUserId, { users, memberships, schools } as PersistedIdentityRows);
  if (!mapped.ok) return { ok: false, code: 'forbidden' };
  const { identity } = mapped; const schoolId = identity.membership.schoolId;
  const params = [schoolId, selector.classId, selector.sessionId, selector.termId];
  const scopes = await connection.unsafe('SELECT id,revision FROM ' + table('assessment_scopes') + ' WHERE school_id=$1::uuid AND class_id=$2::uuid AND session_id=$3::uuid AND term_id=$4::uuid FOR SHARE', params);
  if (scopes.length !== 1) return { ok: false, code: 'invalid_reference' };
  const scope = scopes[0];
  if (!Number.isSafeInteger(scope.revision) || Number(scope.revision) < 1) return { ok: false, code: 'incomplete_source' };
  const students = await connection.unsafe('SELECT id,school_id AS "schoolId",status FROM ' + table('students') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, selector.studentId]);
  const enrollments = await connection.unsafe('SELECT id,school_id AS "schoolId",student_id AS "studentId",class_id AS "classId",session_id AS "sessionId",status FROM ' + table('enrollments') + ' WHERE school_id=$1::uuid AND student_id=$2::uuid AND session_id=$3::uuid ORDER BY id FOR SHARE', [schoolId, selector.studentId, selector.sessionId]);
  const classes = await connection.unsafe('SELECT id,school_id AS "schoolId",level_id AS "levelId",section_id AS "sectionId" FROM ' + table('classes') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, selector.classId]);
  if (classes.length !== 1) return { ok: false, code: 'invalid_reference' };
  const levels = await connection.unsafe('SELECT id,school_id AS "schoolId",stage,primary_year AS "primaryYear",is_active AS "isActive" FROM ' + table('academic_levels') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, classes[0].levelId]);
  const sections = await connection.unsafe('SELECT id,school_id AS "schoolId",level_id AS "levelId",is_active AS "isActive" FROM ' + table('academic_sections') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, classes[0].sectionId]);
  const sessions = await connection.unsafe('SELECT id,school_id AS "schoolId",starts_on::text AS "startsOn",ends_on::text AS "endsOn",is_current AS "isCurrent" FROM ' + table('academic_sessions') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, selector.sessionId]);
  const terms = await connection.unsafe('SELECT id,school_id AS "schoolId",session_id AS "sessionId",starts_on::text AS "startsOn",ends_on::text AS "endsOn",is_current AS "isCurrent" FROM ' + table('terms') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, selector.termId]);
  const assignments = await connection.unsafe('SELECT id,school_id AS "schoolId",teacher_membership_id AS "teacherMembershipId",class_id AS "classId",session_id AS "sessionId",ended_at AS "endedAt" FROM ' + table('teacher_class_assignments') + ' WHERE school_id=$1::uuid AND teacher_membership_id=$2::uuid ORDER BY id FOR SHARE', [schoolId, identity.membership.id]);
  const placement = mapPersistedReportPlacement(identity, { schoolId, ...selector }, selector.enrollmentId, { students, enrollments, classes, levels, sections, sessions, terms, assignments } as PersistedPlacementRows);
  if (!placement.ok) return { ok: false, code: placement.code === 'forbidden' ? 'forbidden' : 'invalid_reference' };
  const roster = await connection.unsafe('SELECT id,subject_id,config_version_id FROM ' + table('assessment_subject_roster') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND is_active=true ORDER BY subject_id FOR SHARE', [schoolId, scope.id]);
  const sourceVersions = await connection.unsafe('SELECT id FROM ' + table('assessment_source_versions') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND revision=$3 FOR SHARE', [schoolId, scope.id, scope.revision]);
  if (!roster.length || sourceVersions.length !== 1) return { ok: false, code: 'incomplete_source' };
  const sourceVersionId = sourceVersions[0].id as string;
  const subjects: RelationalSubjectSource[] = [];
  for (const row of roster) {
   const catalog = await connection.unsafe('SELECT id FROM ' + table('assessment_subjects') + ' WHERE school_id=$1::uuid AND id=$2::uuid AND is_active=true FOR SHARE', [schoolId, row.subject_id]);
   const configs = await connection.unsafe('SELECT id,school_id AS "schoolId",level_id AS "levelId",session_id AS "sessionId",term_id AS "termId",subject_id AS "subjectId",revision,mode,state,components,grading FROM ' + table('assessment_config_versions') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, row.config_version_id]);
   if (catalog.length !== 1 || configs.length !== 1) return { ok: false, code: 'incomplete_source' };
   const stored = configs[0];
   const config: AssessmentConfig = { id: stored.id as string, schoolId, levelId: stored.levelId as string, subjectId: stored.subjectId as string | null, termId: stored.termId as string,
    version: stored.revision as number, status: stored.state as AssessmentConfig['status'], components: stored.components as AssessmentConfig['components'], grading: decoded<AssessmentConfig['grading']>(stored.grading) };
   const stage = placement.placement.level.stage;
   if (stored.sessionId !== selector.sessionId || config.termId !== selector.termId || config.levelId !== placement.placement.level.id || config.subjectId !== null && config.subjectId !== row.subject_id || stored.mode !== config.grading.mode || config.status !== 'finalized' || !validateConfigForPersistence(config, stage)) return { ok: false, code: 'incomplete_source' };
   if (identity.membership.role === 'teacher') {
    const links = await connection.unsafe('SELECT l.id FROM ' + table('assessment_teacher_subjects') + ' l JOIN ' + table('teacher_class_assignments') + ' a ON a.school_id=l.school_id AND a.id=l.class_assignment_id WHERE l.school_id=$1::uuid AND l.roster_id=$2::uuid AND l.is_active=true AND a.teacher_membership_id=$3::uuid AND a.class_id=$4::uuid AND a.session_id=$5::uuid AND a.ended_at IS NULL FOR SHARE OF l,a', [schoolId, row.id, identity.membership.id, selector.classId, selector.sessionId]);
    if (links.length !== 1) return { ok: false, code: 'forbidden' };
   }
   const scores = await connection.unsafe('SELECT component_key AS "componentKey",numeric_score::text AS "numericScore",observation_key AS "observationKey",version,config_version_id AS "configVersionId",enrollment_id AS "enrollmentId" FROM ' + table('assessment_scores') + ' WHERE school_id=$1::uuid AND roster_id=$2::uuid AND student_id=$3::uuid ORDER BY component_key FOR SHARE', [schoolId, row.id, selector.studentId]);
   if (new Set(scores.map(s => s.componentKey)).size !== scores.length || scores.some(s => s.configVersionId !== config.id || s.enrollmentId !== selector.enrollmentId || !Number.isSafeInteger(s.version) || Number(s.version) < 1 || !validatePersistedScore(config, stage, s.componentKey as string, { numericScore: s.numericScore as string | null, observationKey: s.observationKey as string | null })) || config.components.some(c => c.required && !scores.some(s => s.componentKey === c.id))) return { ok: false, code: 'incomplete_source' };
   const finals = await connection.unsafe('SELECT f.id,f.teacher_review_id AS "reviewId" FROM ' + table('assessment_finalizations') + ' f JOIN ' + table('assessment_teacher_reviews') + ' r ON r.school_id=f.school_id AND r.id=f.teacher_review_id AND r.scope_id=f.scope_id AND r.roster_id=f.roster_id AND r.source_version_id=f.source_version_id JOIN ' + table('memberships') + ' m ON m.school_id=f.school_id AND m.id=f.finalized_by JOIN ' + table('memberships') + ' rm ON rm.school_id=r.school_id AND rm.id=r.reviewer_membership_id JOIN ' + table('teacher_class_assignments') + ' ra ON ra.school_id=r.school_id AND ra.teacher_membership_id=r.reviewer_membership_id JOIN ' + table('assessment_teacher_subjects') + " rl ON rl.school_id=ra.school_id AND rl.class_assignment_id=ra.id AND rl.roster_id=f.roster_id WHERE f.school_id=$1::uuid AND f.scope_id=$2::uuid AND f.roster_id=$3::uuid AND f.source_version_id=$4::uuid AND ra.class_id=$5::uuid AND ra.session_id=$6::uuid AND ra.ended_at IS NULL AND rl.is_active=true AND m.role='admin' AND m.status='active' AND rm.role='teacher' AND rm.status='active' FOR SHARE OF f,r,m,rm,ra,rl", [schoolId, scope.id, row.id, sourceVersionId, selector.classId, selector.sessionId]);
   if (finals.length !== 1) return { ok: false, code: 'incomplete_source' };
   subjects.push({ rosterId: row.id as string, subjectId: row.subject_id as string, config, scores: scores.map(s => ({ componentKey: s.componentKey as string, numericScore: s.numericScore as string | null, observationKey: s.observationKey as string | null, version: s.version as number })), finalizationId: finals[0].id as string, teacherReviewId: finals[0].reviewId as string });
  }
  return { ok: true, source: { identity, scopeId: scope.id as string, revision: scope.revision as number, sourceVersionId, subjects } };
 } catch { return { ok: false, code: 'read_failed' }; }
}
