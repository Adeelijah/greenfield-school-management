// Offline-only trusted-context adapter contract. No authentication, database or API side effects.
import type { VerifiedAcademicActor, TeacherClassAssignment } from './assignments.ts';
import type { ReportActor, ReportCommand, ReportRecord } from './report-card-workflow.ts';
import type { ReportCardDraft } from './report-cards.ts';

export type ReportTrustedContext = {
  membership: VerifiedAcademicActor;
  assignments: readonly TeacherClassAssignment[];
  /** A server-resolved immutable revision identifier; never accepted from the browser. */
  assessmentRevision: number;
};
export type ReportPreflight =
  | { ok: true; actor: ReportActor }
  | { ok: false; code: 'unauthenticated' | 'forbidden' | 'school_mismatch' | 'stale_assessment' | 'invalid_context'; message: string };
const reject = (code: Extract<ReportPreflight,{ok:false}>['code'],message:string):ReportPreflight=>({ok:false,code,message});

/** The caller must obtain every argument from a verified, school-scoped server transaction. */
export function preflightReportTransition(
  context: ReportTrustedContext,
  record: ReportRecord,
  projection: ReportCardDraft,
  command: ReportCommand,
): ReportPreflight {
  const membership=context?.membership;
  if (!membership?.id || !membership.schoolId) return reject('unauthenticated','Verified membership is required.');
  if (membership.status!=='active' || !['teacher','admin'].includes(membership.role)) return reject('forbidden','Active teacher or administrator membership is required.');
  if (!record || !projection || !command || !record.schoolId || !record.studentId || !record.classId || !record.sessionId || !record.termId ||
    !Number.isSafeInteger(context.assessmentRevision) || context.assessmentRevision < 0 ||
    !Array.isArray(context.assignments) ||
    record.studentId!==projection.studentId || record.classId!==projection.classId || record.sessionId!==projection.sessionId || record.termId!==projection.termId)
    return reject('invalid_context','A complete report and trusted assessment projection are required.');
  if (membership.schoolId!==record.schoolId || projection.schoolId!==membership.schoolId ||
    context.assignments.some(a=>a.schoolId!==membership.schoolId))
    return reject('school_mismatch','All report and assignment records must belong to the verified school.');
  if (record.assessmentVersion!==context.assessmentRevision || command.assessmentVersion!==context.assessmentRevision)
    return reject('stale_assessment','The verified assessment revision has changed.');
  const activeAssignments=context.assignments.filter(a=>a.membershipId===membership.id && a.classId===record.classId && a.sessionId===record.sessionId && a.status==='active');
  if (membership.role==='teacher' && activeAssignments.length!==1) return reject('forbidden','Exactly one active class and session assignment is required.');
  return {ok:true,actor:{membershipId:membership.id,schoolId:membership.schoolId,role:membership.role,status:'active',assignedClassIds:membership.role==='teacher'?[record.classId]:[]}};
}
