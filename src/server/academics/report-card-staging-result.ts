import 'server-only';
import { resolveVerifiedReportCardIdentity } from '@/server/auth/report-card-identity';
import { getLocalStagingDatabase, localStagingRuntimeConfig } from '@/server/academics/report-card-staging-connection';
import { createStagingReportRuntime } from '@/lib/academics/report-card-staging-runtime';
import { executeStagingReportBoundary } from '@/lib/academics/report-card-staging-command-boundary';
import { stagingUiEnabled, stagingSchoolId, stagingClassChoices, stagingSelector } from '@/lib/academics/report-card-staging-ui';
import { isReportCardUuid } from '@/lib/academics/report-card-request-command';
import { fixtureAssessmentDecoders as d } from '@/lib/academics/assessment-postgres-fixture-source-reader';
import { verifyApprovedResultView } from '@/lib/academics/report-card-approved-view';
import type { ApprovedResultView, ViewReport, ViewSnapshot, ViewRelease } from '@/lib/academics/report-card-approved-view';
import type { CanonicalAssessmentDocuments } from '@/lib/academics/report-card-approved-snapshot';
type Failure = { ok: false; code: 'forbidden' | 'unavailable' };
type Result = { ok: true; view: ApprovedResultView; directoryName: string; classLabel: string } | Failure;
const one = (rows: Record<string, unknown>[]) => { if (rows.length !== 1) throw Error('Expected one pinned row'); return rows[0]!; };

/** Current complete authority/assignment first, then the immutable approved
 * source, never today's academic totals. No draft, withdrawn or old release view. */
export async function readLocalStagingResult(reportId: unknown): Promise<Result> {
  if (!stagingUiEnabled(process.env) || !isReportCardUuid(reportId)) return { ok: false, code: 'forbidden' };
  try {
    const identity = await resolveVerifiedReportCardIdentity();
    if (!identity || identity.schoolId !== stagingSchoolId) return { ok: false, code: 'forbidden' };
    const runtime = createStagingReportRuntime(getLocalStagingDatabase(), localStagingRuntimeConfig);
    const outcome = await executeStagingReportBoundary(runtime, identity, (db, _verified, authority) => db.begin(async tx => {
      const rows = await tx.unsafe('SELECT id,school_id AS "schoolId",student_id AS "studentId",enrollment_id AS "enrollmentId",class_id AS "classId",session_id AS "sessionId",term_id AS "termId",assessment_scope_id AS "assessmentScopeId",assessment_source_version_id AS "assessmentSourceVersionId",assessment_revision AS "assessmentRevision",version,stage,submitted_by AS "submittedBy",approved_by AS "approvedBy" FROM public.report_cards WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [stagingSchoolId, reportId]);
      if (rows.length !== 1 || !['approved', 'published'].includes(String(rows[0]!.stage))) return { ok: false, code: 'forbidden' } as const;
      const r = rows[0]!;
      const report: ViewReport = { id: d.textField(r.id), schoolId: d.textField(r.schoolId), studentId: d.textField(r.studentId), enrollmentId: d.textField(r.enrollmentId),
        classId: d.textField(r.classId), sessionId: d.textField(r.sessionId), termId: d.textField(r.termId), assessmentScopeId: d.textField(r.assessmentScopeId),
        assessmentSourceVersionId: d.textField(r.assessmentSourceVersionId), assessmentRevision: d.integerField(r.assessmentRevision), version: d.integerField(r.version),
        stage: d.enumField(r.stage, ['approved', 'published'] as const), submittedBy: d.textField(r.submittedBy), approvedBy: d.textField(r.approvedBy) };
      const choice = stagingClassChoices.find(c => c.classId === report.classId);
      const selector = choice && stagingSelector(choice.key);
      if (!selector || report.schoolId !== stagingSchoolId || report.sessionId !== selector.sessionId || report.termId !== selector.termId) return { ok: false, code: 'forbidden' } as const;
      if (authority.role === 'teacher') {
        const assigned = await tx.unsafe('SELECT id FROM public.teacher_class_assignments WHERE school_id=$1::uuid AND teacher_membership_id=$2::uuid AND class_id=$3::uuid AND session_id=$4::uuid AND ended_at IS NULL FOR SHARE', [stagingSchoolId, authority.membershipId, report.classId, report.sessionId]);
        if (assigned.length !== 1) return { ok: false, code: 'forbidden' } as const;
      }
      const approvedVersion = report.stage === 'published' ? report.version - 1 : report.version;
      const s = one(await tx.unsafe('SELECT id,school_id AS "schoolId",report_id AS "reportId",report_version AS "reportVersion",enrollment_id AS "enrollmentId",assessment_scope_id AS "assessmentScopeId",assessment_source_version_id AS "assessmentSourceVersionId",assessment_revision AS "assessmentRevision",canonical_payload AS "canonicalPayload",content_hash AS "contentHash",source_versions AS "sourceVersions" FROM public.report_card_snapshots WHERE school_id=$1::uuid AND report_id=$2::uuid AND report_version=$3 FOR SHARE', [stagingSchoolId, report.id, approvedVersion]));
      const snapshot: ViewSnapshot = { id: d.textField(s.id), schoolId: d.textField(s.schoolId), reportId: d.textField(s.reportId), reportVersion: d.integerField(s.reportVersion), enrollmentId: d.textField(s.enrollmentId),
        assessmentScopeId: d.textField(s.assessmentScopeId), assessmentSourceVersionId: d.textField(s.assessmentSourceVersionId), assessmentRevision: d.integerField(s.assessmentRevision), canonicalPayload: s.canonicalPayload, contentHash: d.textField(s.contentHash), sourceVersions: s.sourceVersions };
      if (authority.role === 'teacher') {
        if (!Array.isArray(snapshot.sourceVersions) || !snapshot.sourceVersions.length) return { ok: false, code: 'unavailable' } as const;
        const rosterIds = snapshot.sourceVersions.map(v => v && typeof v === 'object' && 'rosterId' in v ? v.rosterId : null);
        if (!rosterIds.every(isReportCardUuid) || new Set(rosterIds).size !== rosterIds.length) return { ok: false, code: 'unavailable' } as const;
        const links = await tx.unsafe('SELECT l.roster_id AS "rosterId" FROM public.assessment_teacher_subjects l JOIN public.teacher_class_assignments a ON a.school_id=l.school_id AND a.id=l.class_assignment_id WHERE l.school_id=$1::uuid AND l.roster_id=ANY($2::uuid[]) AND l.is_active=true AND a.teacher_membership_id=$3::uuid AND a.class_id=$4::uuid AND a.session_id=$5::uuid AND a.ended_at IS NULL FOR SHARE OF l,a', [stagingSchoolId, rosterIds, authority.membershipId, report.classId, report.sessionId]);
        if (links.length !== rosterIds.length || new Set(links.map(l => l.rosterId)).size !== rosterIds.length || links.some(l => !isReportCardUuid(l.rosterId) || !rosterIds.includes(l.rosterId))) return { ok: false, code: 'forbidden' } as const;
      }
      const sourceRow = one(await tx.unsafe('SELECT id,school_id AS "schoolId",scope_id AS "scopeId",revision,source_manifest AS "sourceManifest",content_hash AS "contentHash" FROM public.assessment_source_versions WHERE school_id=$1::uuid AND id=$2::uuid AND scope_id=$3::uuid AND revision=$4 FOR SHARE', [stagingSchoolId, report.assessmentSourceVersionId, report.assessmentScopeId, report.assessmentRevision]));
      const sourceManifest = d.decoded<Record<string, unknown>>(sourceRow.sourceManifest);
      if (sourceManifest.format !== 'greenfield.assessment.source.v1') return { ok: false, code: 'unavailable' } as const;
      const { scope, school, klass, level, section, session, term, students, enrollments, roster, catalog, configs, scores } = sourceManifest;
      // decoded() only checks JSONB shape; the content verifier below validates
      // every nested field, full roster, hash, source version and calculation.
      const input = d.decoded<CanonicalAssessmentDocuments['input']>({ scope, school, klass, level, section, session, term, students, enrollments, roster, catalog, configs, scores });
      const source = { id: d.textField(sourceRow.id), schoolId: d.textField(sourceRow.schoolId), scopeId: d.textField(sourceRow.scopeId), revision: d.integerField(sourceRow.revision), sourceManifest, contentHash: d.textField(sourceRow.contentHash) };
      // Independent evidence shares one round trip; each CTE locks its base
      // rows before aggregation. No aggregate-level FOR SHARE or unlocked join.
      const evidence = one(await tx.unsafe(`WITH
        locked_finals AS MATERIALIZED (
          SELECT id,school_id AS "schoolId",scope_id AS "scopeId",roster_id AS "rosterId",source_version_id AS "sourceVersionId",teacher_review_id AS "teacherReviewId",finalized_by AS "finalizedBy",results,content_hash AS "contentHash"
          FROM public.assessment_finalizations WHERE school_id=$1::uuid AND scope_id=$2::uuid AND source_version_id=$3::uuid ORDER BY id FOR SHARE),
        locked_reviews AS MATERIALIZED (
          SELECT id,school_id AS "schoolId",scope_id AS "scopeId",roster_id AS "rosterId",source_version_id AS "sourceVersionId",reviewer_membership_id AS "reviewerMembershipId"
          FROM public.assessment_teacher_reviews WHERE school_id=$1::uuid AND scope_id=$2::uuid AND source_version_id=$3::uuid ORDER BY id FOR SHARE),
        locked_audits AS MATERIALIZED (
          SELECT actor_membership_id AS "actorMembershipId",snapshot_id AS "snapshotId",snapshot_report_version AS "snapshotReportVersion",after_version AS "afterVersion",occurred_at::text AS "occurredAt"
          FROM public.report_card_audit WHERE school_id=$1::uuid AND report_id=$4::uuid AND action='approve' AND snapshot_id=$5::uuid AND snapshot_report_version=$6 FOR SHARE),
        locked_releases AS MATERIALIZED (
          SELECT id,school_id AS "schoolId",report_id AS "reportId",report_version AS "reportVersion",snapshot_id AS "snapshotId",snapshot_report_version AS "snapshotReportVersion",revoked_at::text AS "revokedAt"
          FROM public.report_card_releases WHERE school_id=$1::uuid AND report_id=$4::uuid AND revoked_at IS NULL FOR SHARE),
        locked_pupils AS MATERIALIZED (
          SELECT first_name AS "firstName",last_name AS "lastName" FROM public.students WHERE school_id=$1::uuid AND id=$7::uuid FOR SHARE)
        SELECT (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM locked_finals f) AS finals,
          (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM locked_reviews r) AS reviews,
          (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM locked_audits a) AS audits,
          (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM locked_releases r) AS releases,
          (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM locked_pupils p) AS pupils`,
        [stagingSchoolId, report.assessmentScopeId, report.assessmentSourceVersionId, report.id, snapshot.id, approvedVersion, report.studentId]));
      const evidenceRows = (key: string): Record<string, unknown>[] => {
        const rows = evidence[key];
        if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('Malformed approved evidence');
        return rows;
      };
      const finals = evidenceRows('finals').map(f => ({ id: d.textField(f.id), schoolId: d.textField(f.schoolId), scopeId: d.textField(f.scopeId), rosterId: d.textField(f.rosterId), sourceVersionId: d.textField(f.sourceVersionId), teacherReviewId: d.textField(f.teacherReviewId), finalizedBy: d.textField(f.finalizedBy), results: f.results, contentHash: d.textField(f.contentHash) }));
      const reviews = evidenceRows('reviews').map(v => ({ id: d.textField(v.id), schoolId: d.textField(v.schoolId), scopeId: d.textField(v.scopeId), rosterId: d.textField(v.rosterId), sourceVersionId: d.textField(v.sourceVersionId), reviewerMembershipId: d.textField(v.reviewerMembershipId) }));
      const a = one(evidenceRows('audits'));
      const audit = { actorMembershipId: d.textField(a.actorMembershipId), snapshotId: d.textField(a.snapshotId), snapshotReportVersion: d.integerField(a.snapshotReportVersion), afterVersion: d.integerField(a.afterVersion), occurredAt: new Date(d.textField(a.occurredAt)).toISOString() };
      const releases: ViewRelease[] = evidenceRows('releases').map(v => ({ id: d.textField(v.id), schoolId: d.textField(v.schoolId), reportId: d.textField(v.reportId), reportVersion: d.integerField(v.reportVersion), snapshotId: d.textField(v.snapshotId), snapshotReportVersion: d.integerField(v.snapshotReportVersion), revokedAt: d.nullableText(v.revokedAt) }));
      const checked = verifyApprovedResultView(report, snapshot, audit, releases, { input, source, finals, reviews });
      if (!checked.ok) return { ok: false, code: 'unavailable' } as const;
      const pupil = one(evidenceRows('pupils'));
      return { ok: true, view: checked.view, directoryName: d.textField(pupil.firstName) + ' ' + d.textField(pupil.lastName), classLabel: choice!.label } as const;
    }));
    return outcome.ok ? outcome : { ok: false, code: outcome.code === 'forbidden' ? 'forbidden' : 'unavailable' };
  } catch { return { ok: false, code: 'unavailable' }; }
}
