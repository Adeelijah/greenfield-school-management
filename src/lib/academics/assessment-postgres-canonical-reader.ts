import type { ReportSqlScope } from './report-card-sql-scope';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { fixtureReportSqlScope, isReportSqlScope, lockReportSqlScopeAuthority, matchesReportSqlAuthority } from './report-card-sql-scope.ts';
// Shared complete-scope reads. Caller supplies one already-open transaction.
import type { SqlClient } from './report-card-postgres-disposable-adapter';
import type { AssessmentConfig } from './calendar-assessments';
import type { MappedReportIdentity } from './report-card-persisted-model-map';
import type { CompleteAssessmentSource, MaterializedAssessment, StoredAssessmentSource, StoredAssessmentFinalization, StoredAssessmentReview } from './assessment-canonical-source';
// @ts-expect-error Node type stripping requires explicit source extension.
import { fixtureAssessmentDecoders as d, readRelationalAssessmentInScope } from './assessment-postgres-fixture-source-reader.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { mapPersistedReportIdentity } from './report-card-persisted-model-map.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { materializeAssessmentSource, verifyAssessmentSourceContent } from './assessment-canonical-source.ts';

type Selector = { classId: string; sessionId: string; termId: string };
type VerifiedIdentity = () => Promise<{ authUserId: string } | null>;
type Failure = { ok: false; code: 'unauthenticated' | 'forbidden' | 'invalid_reference' | 'incomplete_source' | 'read_failed' | 'source_mismatch' | 'finalization_mismatch' };
type Candidate = { ok: true; identity: MappedReportIdentity; input: CompleteAssessmentSource; materialized: MaterializedAssessment };
const one = (rows: Record<string, unknown>[]) => { if (rows.length !== 1) throw Error('Expected exactly one selected row'); return rows[0]!; };
const scoped = (r: Record<string, unknown>) => ({ id: d.textField(r.id), schoolId: d.textField(r.schoolId) });
/** Returns a validated candidate for materialization, not proof of review or
 * finalization. No source writes or lock upgrades are performed. A future writer
 * must take the exclusive discovery gate BEFORE invoking any shared read path.
 */
export async function loadCompleteAssessmentInScope(tx: SqlClient, sqlScope: ReportSqlScope, selected: Selector, verifiedIdentity: VerifiedIdentity): Promise<Candidate | Failure> {
 if (!isReportSqlScope(sqlScope) || !selected) return { ok: false, code: 'invalid_reference' };
 const selector = { classId: selected.classId, sessionId: selected.sessionId, termId: selected.termId };
 if (Object.values(selector).some(v => typeof v !== 'string' || !v.trim())) return { ok: false, code: 'invalid_reference' };
 const table = (name: string) => '"' + sqlScope.schema + '"."' + name + '"';
 try {
  const auth = await verifiedIdentity();
  if (!auth?.authUserId?.trim()) return { ok: false, code: 'unauthenticated' };
  const authority = await lockReportSqlScopeAuthority(tx, sqlScope, auth.authUserId);
  if (authority === false) return { ok: false, code: 'forbidden' };
  if ((await tx.unsafe('SELECT id FROM ' + table(sqlScope.sourceGate) + ' WHERE id=1 FOR SHARE')).length !== 1) return { ok: false, code: 'read_failed' };
  const users = await tx.unsafe('SELECT id,auth_user_id AS "authUserId" FROM ' + table('school_users') + ' WHERE auth_user_id=$1::uuid FOR SHARE', [auth.authUserId]);
  if (users.length !== 1) return { ok: false, code: 'forbidden' };
  const memberships = await tx.unsafe('SELECT id,school_id AS "schoolId",user_id AS "userId",role,status FROM ' + table('memberships') + ' WHERE user_id=$1::uuid ORDER BY id FOR SHARE', [users[0]!.id]);
  const schools = await tx.unsafe('SELECT id,final_primary_year AS "finalPrimaryYear" FROM ' + table('schools') + ' WHERE id IN (SELECT school_id FROM ' + table('memberships') + ' WHERE user_id=$1::uuid) ORDER BY id FOR SHARE', [users[0]!.id]);
  const mapped = mapPersistedReportIdentity(auth.authUserId, d.decodeIdentityRows({ users, memberships, schools }));
  if (!mapped.ok || !matchesReportSqlAuthority(authority, mapped.identity, users[0]!.id)) return { ok: false, code: 'forbidden' };
  const { identity } = mapped; const schoolId = identity.school.id;
  const scopeRows = await tx.unsafe('SELECT id,school_id AS "schoolId",class_id AS "classId",session_id AS "sessionId",term_id AS "termId",revision FROM ' + table('assessment_scopes') + ' WHERE school_id=$1::uuid AND class_id=$2::uuid AND session_id=$3::uuid AND term_id=$4::uuid FOR SHARE', [schoolId, selector.classId, selector.sessionId, selector.termId]);
  if (scopeRows.length !== 1) return { ok: false, code: 'invalid_reference' };
  const scopeRow = scopeRows[0]!;
  const scope = { ...scoped(scopeRow), classId: d.textField(scopeRow.classId), sessionId: d.textField(scopeRow.sessionId), termId: d.textField(scopeRow.termId), revision: d.integerField(scopeRow.revision) };
  if (scope.schoolId !== schoolId || scope.classId !== selector.classId || scope.sessionId !== selector.sessionId || scope.termId !== selector.termId) return { ok: false, code: 'invalid_reference' };
  if (identity.membership.role === 'teacher') {
   const assignments = await tx.unsafe('SELECT id FROM ' + table('teacher_class_assignments') + ' WHERE school_id=$1::uuid AND teacher_membership_id=$2::uuid AND class_id=$3::uuid AND session_id=$4::uuid AND ended_at IS NULL FOR SHARE', [schoolId, identity.membership.id, selector.classId, selector.sessionId]);
   if (assignments.length !== 1) return { ok: false, code: 'forbidden' };
  }
  const classes = await tx.unsafe('SELECT id,school_id AS "schoolId",level_id AS "levelId",section_id AS "sectionId" FROM ' + table('classes') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, selector.classId]);
  const klass = one(classes);
  const levels = await tx.unsafe('SELECT id,school_id AS "schoolId",stage,primary_year AS "primaryYear",is_active AS "isActive" FROM ' + table('academic_levels') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, klass.levelId]);
  const sections = await tx.unsafe('SELECT id,school_id AS "schoolId",level_id AS "levelId",is_active AS "isActive" FROM ' + table('academic_sections') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, klass.sectionId]);
  const sessions = await tx.unsafe('SELECT id,school_id AS "schoolId",starts_on::text AS "startsOn",ends_on::text AS "endsOn",is_current AS "isCurrent" FROM ' + table('academic_sessions') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, selector.sessionId]);
  const terms = await tx.unsafe('SELECT id,school_id AS "schoolId",session_id AS "sessionId",starts_on::text AS "startsOn",ends_on::text AS "endsOn",is_current AS "isCurrent" FROM ' + table('terms') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [schoolId, selector.termId]);
  // Discover the class roster server-side, then load ALL active session
  // enrollments for its students so another-class duplicates remain visible.
  const pupilQuery = 'SELECT student_id FROM ' + table('enrollments') + " WHERE school_id=$1::uuid AND class_id=$2::uuid AND session_id=$3::uuid AND status='active'";
  const params = [schoolId, selector.classId, selector.sessionId];
  const enrollments = await tx.unsafe('SELECT id,school_id AS "schoolId",student_id AS "studentId",class_id AS "classId",session_id AS "sessionId",status FROM ' + table('enrollments') + " WHERE school_id=$1::uuid AND session_id=$3::uuid AND status='active' AND student_id IN (" + pupilQuery + ') ORDER BY id FOR SHARE', params);
  const students = await tx.unsafe('SELECT id,school_id AS "schoolId",status FROM ' + table('students') + ' WHERE school_id=$1::uuid AND id IN (' + pupilQuery + ') ORDER BY id FOR SHARE', params);
  const placement = d.decodePlacementRows({ classes, levels, sections, sessions, terms, enrollments, students, assignments: [] });
  if (placement.classes.length !== 1 || placement.levels.length !== 1 || placement.sections.length !== 1 || placement.sessions.length !== 1 || placement.terms.length !== 1) return { ok: false, code: 'invalid_reference' };
  const rosterRows = await tx.unsafe('SELECT id,school_id AS "schoolId",scope_id AS "scopeId",subject_id AS "subjectId",roster_version AS "rosterVersion",config_version_id AS "configVersionId",is_active AS "isActive" FROM ' + table('assessment_subject_roster') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND is_active=true ORDER BY id FOR SHARE', [schoolId, scope.id]);
  const roster = rosterRows.map(r => ({ ...scoped(r), scopeId: d.textField(r.scopeId), subjectId: d.textField(r.subjectId), rosterVersion: d.integerField(r.rosterVersion), configVersionId: d.textField(r.configVersionId), isActive: d.booleanField(r.isActive) }));
  for (const row of roster) {
   if (identity.membership.role === 'teacher') {
    const links = await tx.unsafe('SELECT l.id FROM ' + table('assessment_teacher_subjects') + ' l JOIN ' + table('teacher_class_assignments') + ' a ON a.school_id=l.school_id AND a.id=l.class_assignment_id WHERE l.school_id=$1::uuid AND l.roster_id=$2::uuid AND l.is_active=true AND a.teacher_membership_id=$3::uuid AND a.class_id=$4::uuid AND a.session_id=$5::uuid AND a.ended_at IS NULL FOR SHARE OF l,a', [schoolId, row.id, identity.membership.id, selector.classId, selector.sessionId]);
    if (links.length !== 1) return { ok: false, code: 'forbidden' };
   }
  }
  const activeRoster = 'SELECT id FROM ' + table('assessment_subject_roster') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND is_active=true';
  const catalogRows = await tx.unsafe('SELECT id,school_id AS "schoolId",code,name,version,is_active AS "isActive" FROM ' + table('assessment_subjects') + ' WHERE school_id=$1::uuid AND id IN (SELECT subject_id FROM ' + table('assessment_subject_roster') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND is_active=true) ORDER BY id FOR SHARE', [schoolId, scope.id]);
  const catalog = catalogRows.map(r => ({ ...scoped(r), code: d.textField(r.code), name: d.textField(r.name), version: d.integerField(r.version), isActive: d.booleanField(r.isActive) }));
  const configRows = await tx.unsafe('SELECT id,school_id AS "schoolId",level_id AS "levelId",session_id AS "sessionId",term_id AS "termId",subject_id AS "subjectId",revision,mode,state,components,grading FROM ' + table('assessment_config_versions') + ' WHERE school_id=$1::uuid AND id IN (SELECT config_version_id FROM ' + table('assessment_subject_roster') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND is_active=true) ORDER BY id FOR SHARE', [schoolId, scope.id]);
  const configs = configRows.map(r => {
   const config: AssessmentConfig = { ...scoped(r), levelId: d.textField(r.levelId), termId: d.textField(r.termId), subjectId: d.nullableText(r.subjectId), version: d.integerField(r.revision), status: d.enumField(r.state, ['draft', 'finalized'] as const), components: r.components as AssessmentConfig['components'], grading: d.decoded<AssessmentConfig['grading']>(r.grading) };
   if (r.mode !== config.grading.mode) throw Error('Mismatched selected config mode');
   return { sessionId: d.textField(r.sessionId), config };
  });
  // Do not hide malformed enrollment/config bindings by filtering score rows on
  // the expected enrollment ID; the materializer must reject those substitutions.
  const scoreRows = await tx.unsafe('SELECT id,school_id AS "schoolId",roster_id AS "rosterId",config_version_id AS "configVersionId",enrollment_id AS "enrollmentId",student_id AS "studentId",component_key AS "componentKey",numeric_score::text AS "numericScore",observation_key AS "observationKey",version,updated_by AS "updatedBy" FROM ' + table('assessment_scores') + ' WHERE school_id=$1::uuid AND roster_id IN (' + activeRoster + ') AND student_id IN (SELECT student_id FROM ' + table('enrollments') + " WHERE school_id=$1::uuid AND class_id=$3::uuid AND session_id=$4::uuid AND status='active') ORDER BY id FOR SHARE", [schoolId, scope.id, selector.classId, selector.sessionId]);
  const scores = scoreRows.map(r => ({ ...scoped(r), rosterId: d.textField(r.rosterId), configVersionId: d.textField(r.configVersionId), enrollmentId: d.textField(r.enrollmentId), studentId: d.textField(r.studentId), componentKey: d.textField(r.componentKey), numericScore: d.nullableText(r.numericScore), observationKey: d.nullableText(r.observationKey), version: d.integerField(r.version), updatedBy: d.textField(r.updatedBy) }));
  const input: CompleteAssessmentSource = { scope, school: identity.school, klass: placement.classes[0]!, level: placement.levels[0]!, section: placement.sections[0]!, session: placement.sessions[0]!, term: placement.terms[0]!, students: placement.students, enrollments: placement.enrollments, roster, catalog, configs, scores };
  const result = materializeAssessmentSource(input);
  if (!result.ok) return { ok: false, code: 'incomplete_source' };
  return { ok: true, identity, input, materialized: result.materialized };
 } catch { return { ok: false, code: 'read_failed' }; }
}

/** Complete source content AND the existing active reviewer/admin policy, under
 * the same caller-owned transaction and discovery lock. No workflow writes.
 */
export async function readVerifiedCanonicalAssessmentInScope(tx: SqlClient, sqlScope: ReportSqlScope, selector: Selector, verifiedIdentity: VerifiedIdentity): Promise<(Candidate & { sourceVersionId: string; documents: { input: CompleteAssessmentSource; source: StoredAssessmentSource; finals: readonly StoredAssessmentFinalization[]; reviews: readonly StoredAssessmentReview[] } }) | Failure> {
 const loaded = await loadCompleteAssessmentInScope(tx, sqlScope, selector, verifiedIdentity);
 if (!loaded.ok) return loaded;
 try {
  const enrollment = loaded.input.enrollments[0]!;
  const authority = await readRelationalAssessmentInScope(tx, sqlScope, { classId: loaded.input.scope.classId, sessionId: loaded.input.scope.sessionId, termId: loaded.input.scope.termId, studentId: enrollment.studentId, enrollmentId: enrollment.id }, async () => ({ authUserId: loaded.identity.membership.authUserId }));
  if (!authority.ok) return authority;
  if (authority.source.identity.membership.id !== loaded.identity.membership.id || authority.source.scopeId !== loaded.input.scope.id || authority.source.revision !== loaded.input.scope.revision) return { ok: false, code: 'source_mismatch' };
  const table = (name: string) => '"' + sqlScope.schema + '"."' + name + '"';
  const { schoolId, id: scopeId, revision } = loaded.input.scope;
  const sourceRow = one(await tx.unsafe('SELECT id,school_id AS "schoolId",scope_id AS "scopeId",revision,source_manifest AS "sourceManifest",content_hash AS "contentHash" FROM ' + table('assessment_source_versions') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND revision=$3 FOR SHARE', [schoolId, scopeId, revision]));
  const source: StoredAssessmentSource = { ...scoped(sourceRow), scopeId: d.textField(sourceRow.scopeId), revision: d.integerField(sourceRow.revision), sourceManifest: sourceRow.sourceManifest, contentHash: d.textField(sourceRow.contentHash) };
  if (source.id !== authority.source.sourceVersionId) return { ok: false, code: 'source_mismatch' };
  const finalRows = await tx.unsafe('SELECT id,school_id AS "schoolId",scope_id AS "scopeId",roster_id AS "rosterId",source_version_id AS "sourceVersionId",teacher_review_id AS "teacherReviewId",finalized_by AS "finalizedBy",results,content_hash AS "contentHash" FROM ' + table('assessment_finalizations') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND source_version_id=$3::uuid ORDER BY id FOR SHARE', [schoolId, scopeId, source.id]);
  const finals: StoredAssessmentFinalization[] = finalRows.map(r => ({ ...scoped(r), scopeId: d.textField(r.scopeId), rosterId: d.textField(r.rosterId), sourceVersionId: d.textField(r.sourceVersionId), teacherReviewId: d.textField(r.teacherReviewId), finalizedBy: d.textField(r.finalizedBy), results: r.results, contentHash: d.textField(r.contentHash) }));
  const reviewRows = await tx.unsafe('SELECT id,school_id AS "schoolId",scope_id AS "scopeId",roster_id AS "rosterId",source_version_id AS "sourceVersionId",reviewer_membership_id AS "reviewerMembershipId" FROM ' + table('assessment_teacher_reviews') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND source_version_id=$3::uuid AND id IN (SELECT teacher_review_id FROM ' + table('assessment_finalizations') + ' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND source_version_id=$3::uuid) ORDER BY id FOR SHARE', [schoolId, scopeId, source.id]);
  const reviews: StoredAssessmentReview[] = reviewRows.map(r => ({ ...scoped(r), scopeId: d.textField(r.scopeId), rosterId: d.textField(r.rosterId), sourceVersionId: d.textField(r.sourceVersionId), reviewerMembershipId: d.textField(r.reviewerMembershipId) }));
  const verified = verifyAssessmentSourceContent(loaded.input, source, finals, reviews);
  if (!verified.ok) return { ok: false, code: verified.code === 'invalid_source' ? 'incomplete_source' : verified.code };
  return { ...loaded, sourceVersionId: source.id, documents: { input: loaded.input, source, finals, reviews } };
 } catch { return { ok: false, code: 'read_failed' }; }
}


/** Disposable compatibility entry: public remains invalid. */
export async function loadFixtureCompleteAssessment(tx: SqlClient, schema: string, selected: Selector, verifiedIdentity: VerifiedIdentity): Promise<Candidate | Failure> { const scope = fixtureReportSqlScope(schema); return scope ? loadCompleteAssessmentInScope(tx, scope, selected, verifiedIdentity) : {ok:false,code:'invalid_reference'}; }

/** Disposable compatibility entry: public remains invalid. */
export async function readFixtureVerifiedCanonicalAssessment(tx: SqlClient, schema: string, selected: Selector, verifiedIdentity: VerifiedIdentity) { const scope = fixtureReportSqlScope(schema); return scope ? readVerifiedCanonicalAssessmentInScope(tx, scope, selected, verifiedIdentity) : {ok:false,code:'invalid_reference'} as const; }
