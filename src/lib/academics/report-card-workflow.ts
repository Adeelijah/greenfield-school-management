// Pure, offline state-machine proposal. This module does not authenticate, persist or publish.
import type { ReportCardDraft, ReportCardRequest } from './report-cards.ts';

export type ReportActor = { membershipId: string; schoolId: string; role: 'admin' | 'teacher' | 'bursar'; status: 'active' | 'suspended'; assignedClassIds: readonly string[] };
export type ReportStage = 'draft' | 'submitted' | 'returned' | 'approved' | 'published';
export type ReportRecord = ReportCardRequest & { stage: ReportStage; version: number; assessmentVersion: number; submittedBy: string | null; approvedBy: string | null; publishedAt: string | null; returnReason: string | null };
export type ReportAction = 'submit' | 'return' | 'approve' | 'publish' | 'reopen';
export type ReportCommand = { action: ReportAction; expectedVersion: number; assessmentVersion: number; idempotencyKey: string; reason?: string };
export type ReportAudit = { action: ReportAction; schoolId: string; studentId: string; actorMembershipId: string; before: ReportStage; after: ReportStage; version: number; occurredAt: string; idempotencyKey: string };
export type ReportDecision = { ok: true; record: ReportRecord; audit: ReportAudit } | { ok: false; code: 'invalid_context' | 'forbidden' | 'stale_version' | 'stale_assessment' | 'incomplete' | 'invalid_transition' | 'reason_required'; message: string };
const deny = (code: Extract<ReportDecision,{ok:false}>['code'],message:string):ReportDecision => ({ok:false,code,message});

export function planReportTransition(record: ReportRecord, card: ReportCardDraft, actor: ReportActor, command: ReportCommand, occurredAt: string): ReportDecision {
  if (!record || !card || !actor || !command || !actor.membershipId?.trim() || !command.idempotencyKey?.trim() || !/^\d{4}-\d{2}-\d{2}T/.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt)) ||
      !Number.isSafeInteger(record.version) || record.version < 1 || !Number.isSafeInteger(record.assessmentVersion) || !Number.isSafeInteger(command.expectedVersion) || !Number.isSafeInteger(command.assessmentVersion) ||
      !['draft','submitted','returned','approved','published'].includes(record.stage) || !['submit','return','approve','publish','reopen'].includes(command.action) ||
      !record.schoolId || !record.studentId || !record.classId || !record.sessionId || !record.termId ||
      record.schoolId !== card.schoolId || record.studentId !== card.studentId || record.classId !== card.classId || record.sessionId !== card.sessionId || record.termId !== card.termId)
    return deny('invalid_context','A valid report, projection, actor and command are required.');
  if (actor.status !== 'active' || actor.schoolId !== record.schoolId || actor.role === 'bursar' ||
      (actor.role === 'teacher' && !actor.assignedClassIds.includes(record.classId))) return deny('forbidden','Active, school-scoped and class-scoped membership is required.');
  if (command.expectedVersion !== record.version) return deny('stale_version','The report has changed since it was loaded.');
  if (command.assessmentVersion !== record.assessmentVersion) return deny('stale_assessment','The assessment projection must be refreshed.');
  const allowed: Record<ReportAction, readonly ReportStage[]> = {
    submit:['draft','returned'],return:['submitted'],approve:['submitted'],publish:['approved'],reopen:['approved']
  };
  if (!allowed[command.action].includes(record.stage)) return deny('invalid_transition','This transition is not permitted from the current stage.');
  if (command.action === 'submit' && actor.role !== 'teacher') return deny('forbidden','Only an assigned teacher may submit.');
  if (command.action !== 'submit' && actor.role !== 'admin') return deny('forbidden','Only an active school administrator may review or publish.');
  if ((command.action === 'submit' || command.action === 'approve' || command.action === 'publish') &&
      (card.status !== 'ready_for_review' || !card.subjects.length || !card.subjects.every(s => s.complete && s.finalized)))
    return deny('incomplete','Every subject must be complete and finalized.');
  if (command.action === 'return' && !command.reason?.trim()) return deny('reason_required','A reason is required when returning a report.');
  if ((command.action === 'approve' || command.action === 'publish') && (!record.submittedBy || record.submittedBy === actor.membershipId && command.action === 'approve'))
    return deny('forbidden','Submission and independent administrator approval are required.');
  if (command.action === 'publish' && !record.approvedBy) return deny('forbidden','An approved report is required.');
  const next: Record<ReportAction,ReportStage> = {submit:'submitted',return:'returned',approve:'approved',publish:'published',reopen:'draft'};
  const stage=next[command.action];
  const updated: ReportRecord = {...record,stage,version:record.version+1,
    submittedBy:command.action==='submit'?actor.membershipId:command.action==='reopen'?null:record.submittedBy,
    approvedBy:command.action==='approve'?actor.membershipId:command.action==='return'||command.action==='reopen'||command.action==='submit'?null:record.approvedBy,
    publishedAt:command.action==='publish'?occurredAt:null,
    returnReason:command.action==='return'?command.reason!.trim():command.action==='submit'||command.action==='reopen'?null:record.returnReason};
  return {ok:true,record:updated,audit:{action:command.action,schoolId:record.schoolId,studentId:record.studentId,actorMembershipId:actor.membershipId,before:record.stage,after:stage,version:updated.version,occurredAt,idempotencyKey:command.idempotencyKey}};
}
