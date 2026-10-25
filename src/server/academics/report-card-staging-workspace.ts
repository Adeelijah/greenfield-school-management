import 'server-only';
import { resolveVerifiedReportCardIdentity } from '@/server/auth/report-card-identity';
import { getLocalStagingDatabase, localStagingRuntimeConfig } from '@/server/academics/report-card-staging-connection';
import { createStagingReportRuntime } from '@/lib/academics/report-card-staging-runtime';
import { executeStagingReportBoundary } from '@/lib/academics/report-card-staging-command-boundary';
import { stagingSchoolId, stagingUiEnabled, stagingSelector } from '@/lib/academics/report-card-staging-ui';
import type { StagingWorkspace, StagingReportRow } from '@/lib/academics/report-card-staging-ui';
import { isReportCardUuid } from '@/lib/academics/report-card-request-command';

type Failure = { ok: false; code: 'forbidden' | 'unavailable' };
type Success = { ok: true; workspace: StagingWorkspace };
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
function diagnostic(phase: string, code: unknown) {
  // Local server terminal only. Never log SDK errors, SQL, rows or actor IDs.
  if (!stagingUiEnabled(process.env)) return;
  const safe = typeof code === 'string' && /^[a-zA-Z0-9_]{1,64}$/.test(code) ? code : 'unavailable';
  console.warn(`Greenfield staging read: phase=${phase}; code=${safe}`);
}

/** Workflow INDEX only, not proof that results are finalized or publishable.
 * Current complete authority/placement is locked here; actual commands and the
 * approved-result reader independently retain complete content verification. */
export async function readLocalStagingWorkspace(choice: string): Promise<Success | Failure> {
  if (!stagingUiEnabled(process.env)) return { ok: false, code: 'forbidden' };
  const selector = stagingSelector(choice);
  if (!selector) return { ok: false, code: 'forbidden' };
  try {
    const identity = await resolveVerifiedReportCardIdentity();
    if (!identity || identity.schoolId !== stagingSchoolId) return { ok: false, code: 'forbidden' };
    const runtime = createStagingReportRuntime(getLocalStagingDatabase(), localStagingRuntimeConfig);
    const outcome = await executeStagingReportBoundary(runtime, identity, (db, _verified, authority) => db.begin(async tx => {
      if (authority.role === 'teacher') {
        const assignments = await tx.unsafe('SELECT id FROM public.teacher_class_assignments WHERE school_id=$1::uuid AND teacher_membership_id=$2::uuid AND class_id=$3::uuid AND session_id=$4::uuid AND ended_at IS NULL FOR SHARE', [stagingSchoolId, authority.membershipId, selector.classId, selector.sessionId]);
        if (assignments.length !== 1) return { ok: false, code: 'forbidden' } as const;
      }
      const scopes = await tx.unsafe('SELECT sc.id AS "scopeId",sc.school_id AS "schoolId",sc.class_id AS "classId",sc.session_id AS "sessionId",sc.term_id AS "termId",sc.revision,l.stage,l.primary_year AS "primaryYear",l.is_active AS "levelActive",sec.is_active AS "sectionActive",sess.starts_on::text AS "sessionStartsOn",sess.ends_on::text AS "sessionEndsOn",t.starts_on::text AS "termStartsOn",t.ends_on::text AS "termEndsOn" FROM public.assessment_scopes sc JOIN public.classes c ON c.school_id=sc.school_id AND c.id=sc.class_id JOIN public.academic_levels l ON l.school_id=c.school_id AND l.id=c.level_id JOIN public.academic_sections sec ON sec.school_id=c.school_id AND sec.id=c.section_id AND sec.level_id=l.id JOIN public.academic_sessions sess ON sess.school_id=sc.school_id AND sess.id=sc.session_id JOIN public.terms t ON t.school_id=sc.school_id AND t.id=sc.term_id AND t.session_id=sess.id WHERE sc.school_id=$1::uuid AND sc.class_id=$2::uuid AND sc.session_id=$3::uuid AND sc.term_id=$4::uuid FOR SHARE OF sc,c,l,sec,sess,t', [stagingSchoolId, selector.classId, selector.sessionId, selector.termId]);
      if (scopes.length !== 1) return { ok: false, code: 'unavailable' } as const;
      const scope = scopes[0]!;
      if (!isReportCardUuid(scope.scopeId) || scope.schoolId !== stagingSchoolId || scope.classId !== selector.classId || scope.sessionId !== selector.sessionId || scope.termId !== selector.termId ||
        !Number.isSafeInteger(scope.revision) || Number(scope.revision) < 1 || scope.levelActive !== true || scope.sectionActive !== true || !['creche', 'nursery', 'primary'].includes(String(scope.stage)) ||
        (scope.stage === 'primary' ? !Number.isSafeInteger(scope.primaryYear) || Number(scope.primaryYear) < 1 || Number(scope.primaryYear) > authority.finalPrimaryYear : scope.primaryYear !== null) ||
        !date(scope.sessionStartsOn) || !date(scope.sessionEndsOn) || !date(scope.termStartsOn) || !date(scope.termEndsOn) ||
        scope.sessionStartsOn > scope.sessionEndsOn || scope.termStartsOn > scope.termEndsOn || scope.termStartsOn < scope.sessionStartsOn || scope.termEndsOn > scope.sessionEndsOn) {
        diagnostic('index_scope', 'invalid_binding'); return { ok: false, code: 'unavailable' } as const;
      }
      // ALL active session enrollments for the discovered class pupils, including
      // conflicting placements in another class. Never hide duplicate enrollments.
      const enrollments = await tx.unsafe("SELECT id,school_id AS \"schoolId\",student_id AS \"studentId\",class_id AS \"classId\",session_id AS \"sessionId\",status FROM public.enrollments WHERE school_id=$1::uuid AND session_id=$3::uuid AND status='active' AND student_id IN (SELECT student_id FROM public.enrollments WHERE school_id=$1::uuid AND class_id=$2::uuid AND session_id=$3::uuid AND status='active') ORDER BY id FOR SHARE", [stagingSchoolId, selector.classId, selector.sessionId]);
      if (enrollments.some(e => ![e.id, e.studentId].every(isReportCardUuid) || e.schoolId !== stagingSchoolId || e.classId !== selector.classId || e.sessionId !== selector.sessionId || e.status !== 'active') ||
        new Set(enrollments.map(e => e.id)).size !== enrollments.length || new Set(enrollments.map(e => e.studentId)).size !== enrollments.length) return { ok: false, code: 'unavailable' } as const;
      const roster = await tx.unsafe('SELECT id,subject_id AS "subjectId" FROM public.assessment_subject_roster WHERE school_id=$1::uuid AND scope_id=$2::uuid AND is_active=true ORDER BY id FOR SHARE', [stagingSchoolId, scope.scopeId]);
      if (roster.some(r => ![r.id, r.subjectId].every(isReportCardUuid)) || new Set(roster.map(r => r.id)).size !== roster.length || new Set(roster.map(r => r.subjectId)).size !== roster.length) return { ok: false, code: 'unavailable' } as const;
      const labels = enrollments.length ? await tx.unsafe('SELECT id,school_id AS "schoolId",status,first_name AS "firstName",last_name AS "lastName" FROM public.students WHERE school_id=$1::uuid AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE', [stagingSchoolId, enrollments.map(e => e.studentId)]) : [];
      if (labels.length !== enrollments.length || new Set(labels.map(r => r.id)).size !== labels.length) { diagnostic('pupil_labels', 'invalid_row'); return { ok: false, code: 'unavailable' } as const; }
      const pupils = [];
      for (const enrollment of enrollments) {
        const rows = labels.filter(r => r.id === enrollment.studentId);
        if (rows.length !== 1 || rows[0]!.schoolId !== stagingSchoolId || rows[0]!.status !== 'active' || typeof rows[0]!.firstName !== 'string' || typeof rows[0]!.lastName !== 'string') { diagnostic('pupil_labels', 'invalid_row'); return { ok: false, code: 'unavailable' } as const; }
        pupils.push({ studentId: enrollment.studentId as string, enrollmentId: enrollment.id as string, label: rows[0]!.firstName + ' ' + rows[0]!.lastName });
      }
      const rows = await tx.unsafe('SELECT id AS "reportId",student_id AS "studentId",enrollment_id AS "enrollmentId",version,stage,return_reason AS "returnReason" FROM public.report_cards WHERE school_id=$1::uuid AND class_id=$2::uuid AND session_id=$3::uuid AND term_id=$4::uuid ORDER BY id FOR SHARE', [stagingSchoolId, selector.classId, selector.sessionId, selector.termId]);
      const activeReleases = rows.length ? await tx.unsafe('SELECT id,report_id AS "reportId" FROM public.report_card_releases WHERE school_id=$1::uuid AND report_id=ANY($2::uuid[]) AND revoked_at IS NULL ORDER BY id FOR SHARE', [stagingSchoolId, rows.map(r => r.reportId)]) : [];
      if (activeReleases.some(r => !rows.some(report => report.reportId === r.reportId))) { diagnostic('release_rows', 'invalid_binding'); return { ok: false, code: 'unavailable' } as const; }
      const reports: StagingReportRow[] = [];
      for (const row of rows) {
        if (![row.reportId, row.studentId, row.enrollmentId].every(isReportCardUuid) ||
          !Number.isSafeInteger(row.version) || Number(row.version) < 1 ||
          !['draft', 'submitted', 'returned', 'approved', 'published'].includes(String(row.stage)) ||
          !(row.returnReason === null || typeof row.returnReason === 'string') ||
          !pupils.some(p => p.studentId === row.studentId && p.enrollmentId === row.enrollmentId)) { diagnostic('report_rows', 'invalid_binding'); return { ok: false, code: 'unavailable' } as const; }
        const releases = activeReleases.filter(r => r.reportId === row.reportId);
        if (releases.length > 1 || (row.stage === 'published' ? releases.length !== 1 : releases.length !== 0) ||
          releases.some(r => !isReportCardUuid(r.id))) { diagnostic('release_rows', 'invalid_binding'); return { ok: false, code: 'unavailable' } as const; }
        reports.push({ reportId: row.reportId as string, studentId: row.studentId as string, enrollmentId: row.enrollmentId as string,
          version: row.version as number, stage: row.stage as StagingReportRow['stage'], returnReason: row.returnReason as string | null,
          releaseId: releases.length ? releases[0]!.id as string : null });
      }
      if (new Set(reports.map(r => r.enrollmentId)).size !== reports.length) return { ok: false, code: 'unavailable' } as const;
      return { ok: true, workspace: { role: authority.role, pupils, reports,
        assessmentRevision: scope.revision as number, subjectCount: roster.length } } as const;
    }));
    if (!outcome.ok && outcome.code !== 'forbidden') diagnostic('boundary', outcome.code);
    return outcome.ok ? outcome : { ok: false, code: outcome.code === 'forbidden' ? 'forbidden' : 'unavailable' };
  } catch (error) { diagnostic('workspace', error instanceof Error ? error.name : 'unavailable'); return { ok: false, code: 'unavailable' }; }
}
