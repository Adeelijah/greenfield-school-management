// Immutable content verification only. Current request authorization belongs to
// the server reader; a digest alone is never proof of permission.
import type { ApprovedReportBinding, CanonicalAssessmentDocuments } from './report-card-approved-snapshot';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { buildApprovedReportSnapshot, matchesApprovedReportSnapshot } from './report-card-approved-snapshot.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { recalculateRelationalSubject } from './assessment-relational-recalculation.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';

export type ViewReport = Omit<ApprovedReportBinding, 'approvedAt' | 'approvedVersion'> & { version: number; stage: 'approved' | 'published' };
export type ViewSnapshot = { id: string; schoolId: string; reportId: string; reportVersion: number; enrollmentId: string; assessmentScopeId: string; assessmentSourceVersionId: string; assessmentRevision: number; canonicalPayload: unknown; contentHash: string; sourceVersions: unknown };
export type ViewRelease = { id: string; schoolId: string; reportId: string; reportVersion: number; snapshotId: string; snapshotReportVersion: number; revokedAt: string | null };
export type ApprovedResultView = {
  reportId: string; reportVersion: number; approvedVersion: number; stage: 'approved' | 'published'; approvedAt: string;
  sourceRevision: number; termStartsOn: string; termEndsOn: string; sessionStartsOn: string; sessionEndsOn: string;
  subjects: { name: string; total: string | null; grade: string | null; observations: string[] }[];
};

export function verifyApprovedResultView(report: ViewReport, snapshot: ViewSnapshot,
  audit: { snapshotId: string; snapshotReportVersion: number; actorMembershipId: string; afterVersion: number; occurredAt: string },
  releases: readonly ViewRelease[], docs: CanonicalAssessmentDocuments,
): { ok: true; view: ApprovedResultView } | { ok: false; code: 'invalid_snapshot' } {
  const fail = { ok: false, code: 'invalid_snapshot' } as const;
  try {
    canonicalizeSnapshotValue({ report, snapshot, audit, releases });
    if (!['approved', 'published'].includes(report.stage) || !Number.isSafeInteger(report.version)) return fail;
    const version = report.stage === 'published' ? report.version - 1 : report.version;
    if (version < 3 || !snapshot.canonicalPayload || typeof snapshot.canonicalPayload !== 'object' || Array.isArray(snapshot.canonicalPayload)) return fail;
    const payload = snapshot.canonicalPayload as Record<string, unknown>;
    if (payload.format !== 'greenfield.report-card.approved-snapshot.v1' || !payload.binding || typeof payload.binding !== 'object' || Array.isArray(payload.binding)) return fail;
    const binding = payload.binding as ApprovedReportBinding;
    // The builder verifies every binding field, canonical complete source,
    // finalization and exact pupil calculations before accepting stored content.
    const built = buildApprovedReportSnapshot({ id: report.id, schoolId: report.schoolId, enrollmentId: report.enrollmentId,
      studentId: report.studentId, classId: report.classId, sessionId: report.sessionId, termId: report.termId,
      assessmentScopeId: report.assessmentScopeId, assessmentSourceVersionId: report.assessmentSourceVersionId,
      assessmentRevision: report.assessmentRevision, submittedBy: report.submittedBy, approvedBy: report.approvedBy,
      approvedVersion: version, approvedAt: binding.approvedAt }, docs);
    if (!built.ok || !matchesApprovedReportSnapshot(built.snapshot, snapshot)) return fail;
    if (snapshot.schoolId !== report.schoolId || snapshot.reportId !== report.id || snapshot.reportVersion !== version ||
      snapshot.enrollmentId !== report.enrollmentId || snapshot.assessmentScopeId !== report.assessmentScopeId ||
      snapshot.assessmentSourceVersionId !== report.assessmentSourceVersionId || snapshot.assessmentRevision !== report.assessmentRevision ||
      audit.snapshotId !== snapshot.id || audit.snapshotReportVersion !== version || audit.afterVersion !== version ||
      audit.actorMembershipId !== report.approvedBy || audit.occurredAt !== binding.approvedAt) return fail;
    if (report.stage === 'published') {
      if (releases.length !== 1) return fail;
      const r = releases[0]!;
      if (!r.id || r.schoolId !== report.schoolId || r.reportId !== report.id || r.reportVersion !== report.version ||
        r.snapshotId !== snapshot.id || r.snapshotReportVersion !== version || r.revokedAt !== null) return fail;
    } else if (releases.length !== 0) return fail;
    const subjects: ApprovedResultView['subjects'] = [];
    for (const roster of docs.input.roster) {
      const config = docs.input.configs.find(c => c.config.id === roster.configVersionId)!.config;
      const scores = docs.input.scores.filter(s => s.rosterId === roster.id && s.enrollmentId === report.enrollmentId);
      const result = recalculateRelationalSubject(config, docs.input.level.stage, scores);
      if (!result.ok) return fail;
      subjects.push({ name: docs.input.catalog.find(c => c.id === roster.subjectId)!.name,
        total: result.result.mode === 'numeric' ? result.result.total : null,
        grade: result.result.mode === 'numeric' ? result.result.grade : null,
        observations: result.result.mode === 'observational' ? result.result.observations.map(o => `${config.components.find(c => c.id === o.componentKey)?.label ?? o.componentKey}: ${o.label}`) : [] });
    }
    return { ok: true, view: { reportId: report.id, reportVersion: report.version, approvedVersion: version,
      stage: report.stage, approvedAt: binding.approvedAt, sourceRevision: report.assessmentRevision,
      termStartsOn: docs.input.term.startsOn, termEndsOn: docs.input.term.endsOn,
      sessionStartsOn: docs.input.session.startsOn, sessionEndsOn: docs.input.session.endsOn, subjects } };
  } catch { return fail; }
}
