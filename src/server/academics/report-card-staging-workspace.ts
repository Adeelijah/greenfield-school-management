import 'server-only';
import { resolveVerifiedReportCardIdentity } from '@/server/auth/report-card-identity';
import { getLocalStagingDatabase, localStagingRuntimeConfig } from '@/server/academics/report-card-staging-connection';
import { createStagingReportRuntime } from '@/lib/academics/report-card-staging-runtime';
import { executeStagingReportBoundary } from '@/lib/academics/report-card-staging-command-boundary';
import { stagingReportSqlScope } from '@/lib/academics/report-card-sql-scope';
import { readVerifiedCanonicalAssessmentInScope } from '@/lib/academics/assessment-postgres-canonical-reader';
import { stagingSchoolId, stagingUiEnabled, stagingSelector } from '@/lib/academics/report-card-staging-ui';
import type { StagingWorkspace, StagingReportRow } from '@/lib/academics/report-card-staging-ui';
import { isReportCardUuid } from '@/lib/academics/report-card-request-command';

type Failure = { ok: false; code: 'forbidden' | 'unavailable' };
type Success = { ok: true; workspace: StagingWorkspace };

/** No cached authority or application connection. Reads recheck the complete
 * actor and assignment on the same restricted transaction as source/report rows. */
export async function readLocalStagingWorkspace(choice: string): Promise<Success | Failure> {
  if (!stagingUiEnabled(process.env)) return { ok: false, code: 'forbidden' };
  const selector = stagingSelector(choice);
  if (!selector) return { ok: false, code: 'forbidden' };
  try {
    const identity = await resolveVerifiedReportCardIdentity();
    if (!identity || identity.schoolId !== stagingSchoolId) return { ok: false, code: 'forbidden' };
    const runtime = createStagingReportRuntime(getLocalStagingDatabase(), localStagingRuntimeConfig);
    const sqlScope = stagingReportSqlScope(localStagingRuntimeConfig);
    const outcome = await executeStagingReportBoundary(runtime, identity, (db, verified, authority) => db.begin(async tx => {
      const source = await readVerifiedCanonicalAssessmentInScope(tx, sqlScope, selector, verified);
      if (!source.ok) return { ok: false, code: 'unavailable' } as const;
      const enrollments = source.input.enrollments.filter(e => e.classId === selector.classId && e.status === 'active');
      const pupils = [];
      for (const enrollment of enrollments) {
        const rows = await tx.unsafe('SELECT first_name AS "firstName",last_name AS "lastName" FROM public.students WHERE school_id=$1::uuid AND id=$2::uuid FOR SHARE', [stagingSchoolId, enrollment.studentId]);
        if (rows.length !== 1 || typeof rows[0]!.firstName !== 'string' || typeof rows[0]!.lastName !== 'string') return { ok: false, code: 'unavailable' } as const;
        pupils.push({ studentId: enrollment.studentId, enrollmentId: enrollment.id, label: rows[0]!.firstName + ' ' + rows[0]!.lastName });
      }
      const rows = await tx.unsafe('SELECT id AS "reportId",student_id AS "studentId",enrollment_id AS "enrollmentId",version,stage,return_reason AS "returnReason" FROM public.report_cards WHERE school_id=$1::uuid AND class_id=$2::uuid AND session_id=$3::uuid AND term_id=$4::uuid ORDER BY id FOR SHARE', [stagingSchoolId, selector.classId, selector.sessionId, selector.termId]);
      const reports: StagingReportRow[] = [];
      for (const row of rows) {
        if (![row.reportId, row.studentId, row.enrollmentId].every(isReportCardUuid) ||
          !Number.isSafeInteger(row.version) || Number(row.version) < 1 ||
          !['draft', 'submitted', 'returned', 'approved', 'published'].includes(String(row.stage)) ||
          !(row.returnReason === null || typeof row.returnReason === 'string') ||
          !pupils.some(p => p.studentId === row.studentId && p.enrollmentId === row.enrollmentId)) return { ok: false, code: 'unavailable' } as const;
        const releases = await tx.unsafe('SELECT id FROM public.report_card_releases WHERE school_id=$1::uuid AND report_id=$2::uuid AND revoked_at IS NULL FOR SHARE', [stagingSchoolId, row.reportId]);
        if (releases.length > 1 || (row.stage === 'published' ? releases.length !== 1 : releases.length !== 0) ||
          releases.some(r => !isReportCardUuid(r.id))) return { ok: false, code: 'unavailable' } as const;
        reports.push({ reportId: row.reportId as string, studentId: row.studentId as string, enrollmentId: row.enrollmentId as string,
          version: row.version as number, stage: row.stage as StagingReportRow['stage'], returnReason: row.returnReason as string | null,
          releaseId: releases.length ? releases[0]!.id as string : null });
      }
      if (new Set(reports.map(r => r.enrollmentId)).size !== reports.length) return { ok: false, code: 'unavailable' } as const;
      return { ok: true, workspace: { role: authority.role, pupils, reports,
        assessmentRevision: source.input.scope.revision, subjectCount: source.input.roster.length } } as const;
    }));
    return outcome.ok ? outcome : { ok: false, code: outcome.code === 'forbidden' ? 'forbidden' : 'unavailable' };
  } catch { return { ok: false, code: 'unavailable' }; }
}
