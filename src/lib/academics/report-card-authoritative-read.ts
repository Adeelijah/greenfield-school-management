// Isolated read coordinator. No database driver, auth SDK, route or live wiring.
import type { VerifiedAcademicActor, TeacherClassAssignment } from './assignments.ts';
import type { AssessmentSnapshot } from './calendar-assessments.ts';
import type { ReportRecord } from './report-card-workflow.ts';
import type { SnapshotSourceBinding } from './report-card-snapshot-readiness.ts';
import type { TrustedSourceRows } from './report-card-trusted-source.ts';
import type { LockedReport } from './report-card-transaction-port.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { prepareReportCard } from './report-cards.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { preflightReportTransition } from './report-card-preflight.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { verifyReportSnapshotSource } from './report-card-trusted-source.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { inspectSnapshotSource } from './report-card-snapshot-readiness.ts';

export type AuthBoundMembership = VerifiedAcademicActor & { authUserId: string };
export type AcademicReadBundle = {
  academic: Omit<AssessmentSnapshot, 'enrollments'>;
  sources: TrustedSourceRows;
};
/** Every method must use the SAME transaction. Adapters must lock membership,
 * report and source revision in that order, then hold locks through any write.
 * Identity comes from verified server auth, never the report request body.
 */
export type AuthoritativeReportReadPort = {
  verifiedIdentity(): Promise<{ authUserId: string } | null>;
  lockMemberships(authUserId: string): Promise<readonly AuthBoundMembership[]>;
  lockReport(schoolId: string, reportId: string): Promise<{ id: string; enrollmentId: string; record: ReportRecord } | null>;
  readAssignments(schoolId: string, membershipId: string): Promise<readonly TeacherClassAssignment[]>;
  readAcademicSources(record: ReportRecord): Promise<AcademicReadBundle>;
  readCurrentRevision(record: ReportRecord): Promise<number>;
};
export type AuthoritativeReadOutcome =
  | { ok: true; locked: LockedReport; binding: SnapshotSourceBinding }
  | { ok: false; code: 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid_source' | 'stale_assessment' | 'read_failed' };

/** Only report ID is a request selector. School, actor, roles, enrollment,
 * revision, subject roster and grades are derived from the trusted port.
 * Returning ok does not authenticate the port or prove SQL locking/RLS.
 */
export async function readAuthoritativeReport(port: AuthoritativeReportReadPort, reportId: string): Promise<AuthoritativeReadOutcome> {
  try {
    const identity = await port.verifiedIdentity();
    if (!identity?.authUserId?.trim()) return { ok: false, code: 'unauthenticated' };
    const memberships = await port.lockMemberships(identity.authUserId);
    if (memberships.length !== 1) return { ok: false, code: 'forbidden' };
    const membership = memberships[0]!;
    if (membership.authUserId !== identity.authUserId || !membership.id?.trim() || !membership.schoolId?.trim() || membership.status !== 'active' || !['teacher', 'admin'].includes(membership.role)) return { ok: false, code: 'forbidden' };
    if (!reportId?.trim()) return { ok: false, code: 'not_found' };
    const report = await port.lockReport(membership.schoolId, reportId);
    if (!report || report.id !== reportId || report.record.schoolId !== membership.schoolId) return { ok: false, code: 'not_found' };
    const assignments = await port.readAssignments(membership.schoolId, membership.id);
    if (assignments.some(a => a.schoolId !== membership.schoolId) || (membership.role === 'teacher' && assignments.filter(a => a.membershipId === membership.id && a.classId === report.record.classId && a.sessionId === report.record.sessionId && a.status === 'active').length !== 1)) return { ok: false, code: 'forbidden' };
    const { academic, sources } = await port.readAcademicSources(report.record);
    if (academic.schoolId !== membership.schoolId || academic.version !== sources.assessmentRevision || sources.assessmentRevision !== report.record.assessmentVersion) return { ok: false, code: 'stale_assessment' };
    const projection = prepareReportCard({ ...academic, enrollments: sources.enrollments }, report.record);
    if (!projection.ok || projection.card.status !== 'ready_for_review') return { ok: false, code: 'invalid_source' };
    const binding: SnapshotSourceBinding = {
      schoolId: membership.schoolId, reportId, enrollmentId: report.enrollmentId,
      studentId: report.record.studentId, classId: report.record.classId,
      sessionId: report.record.sessionId, termId: report.record.termId,
      assessmentRevision: sources.assessmentRevision,
      subjectIds: projection.card.subjects.map(s => s.subjectId),
      finalizedSubjectIds: sources.subjects.filter(s => s.finalized).map(s => s.subjectId),
      sourceVersionKeys: sources.subjects.map(s => s.sourceVersionKey),
    };
    if (!inspectSnapshotSource(binding).ready || !verifyReportSnapshotSource(binding, sources).ok) return { ok: false, code: 'invalid_source' };
    const context = { membership, assignments, assessmentRevision: sources.assessmentRevision };
    const preflight = preflightReportTransition(context, report.record, projection.card, {
      action: membership.role === 'teacher' ? 'submit' : 'approve',
      expectedVersion: report.record.version, assessmentVersion: sources.assessmentRevision,
      idempotencyKey: 'authoritative-read-only',
    });
    if (!preflight.ok) return { ok: false, code: preflight.code === 'stale_assessment' ? 'stale_assessment' : 'invalid_source' };
    if (await port.readCurrentRevision(report.record) !== sources.assessmentRevision) return { ok: false, code: 'stale_assessment' };
    return { ok: true, locked: { id: reportId, record: report.record, projection: projection.card, context }, binding };
  } catch {
    return { ok: false, code: 'read_failed' };
  }
}
