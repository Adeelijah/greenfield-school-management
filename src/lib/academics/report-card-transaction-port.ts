// Review-only PostgreSQL adapter boundary. No SQL driver, database or network.
// Implementations must supply a REAL atomic transaction and complete trusted reads.
import type { ReportCardDraft } from './report-cards';
import type { ReportTrustedContext } from './report-card-preflight';
import type { ReportRecord, ReportCommand, ReportAudit } from './report-card-workflow';
import type { ReportStoredReceipt } from './report-card-persistence-policy';
// @ts-expect-error Node type stripping requires explicit source extension.
import { preflightReportTransition } from './report-card-preflight.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { planReportTransition } from './report-card-workflow.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { planReportWrite } from './report-card-persistence-policy.ts';

export type TransactionRequest = { schoolId:string; reportId:string; actorMembershipId:string; fingerprint:string; command:ReportCommand; occurredAt:string };
export type LockedReport = { id:string; record:ReportRecord; projection:ReportCardDraft; context:ReportTrustedContext };
export type TransactionOutcome = { ok:true; kind:'applied'|'replay'; version:number } | { ok:false; code:string; message:string };
export type ReportTransaction = {
  // Lock order must be consistent; tenant/actor authorization and full source
  // completeness are obligations of the database implementation.
  lockReport(schoolId:string, reportId:string, actorMembershipId:string):Promise<LockedReport|null>;
  findReceipts(schoolId:string, actorMembershipId:string, operationKey:string):Promise<readonly ReportStoredReceipt[]>;
  updateReport(reportId:string, beforeVersion:number, next:ReportRecord):Promise<boolean>;
  appendAudit(audit:ReportAudit):Promise<void>;
  appendReceipt(receipt:ReportStoredReceipt):Promise<void>;
  appendRelease(release:{schoolId:string;reportId:string;version:number;publishedAt:string}):Promise<void>;
};
export type TransactionRunner = {
  // Must roll back ALL writes if callback throws; serialize conflicting writes.
  run<T>(callback:(tx:ReportTransaction)=>Promise<T>):Promise<T>;
};
class TransactionAbort extends Error {
  constructor(readonly code:string, message:string){super(message);}
}
const abort = (code:string,message:string):never => {throw new TransactionAbort(code,message);};
export async function executeReportTransaction(runner:TransactionRunner, request:TransactionRequest):Promise<TransactionOutcome> {
  if (!request || !request.schoolId?.trim() || !request.reportId?.trim() || !request.actorMembershipId?.trim() || !request.command?.idempotencyKey?.trim()) return {ok:false,code:'invalid',message:'Complete transaction request required.'};
  try {
    return await runner.run(async tx => {
      const locked=await tx.lockReport(request.schoolId,request.reportId,request.actorMembershipId);
      if(!locked || locked.id!==request.reportId || locked.record.schoolId!==request.schoolId) return abort('not_found','School-scoped report unavailable.');
      if(locked.context.membership?.id!==request.actorMembershipId || locked.context.membership.schoolId!==request.schoolId) return abort('forbidden','Trusted actor mismatch.');
      const receipts=await tx.findReceipts(request.schoolId,request.actorMembershipId,request.command.idempotencyKey);
      const write=planReportWrite({schoolId:request.schoolId,reportId:request.reportId,actorMembershipId:request.actorMembershipId,operationKey:request.command.idempotencyKey,fingerprint:request.fingerprint,expectedVersion:request.command.expectedVersion},{schoolId:locked.record.schoolId,id:locked.id,version:locked.record.version},receipts);
      if(!write.ok) return abort(write.code,'Report write precondition failed.');
      if(write.kind==='replay') return {ok:true,kind:'replay',version:write.resultingVersion} as const;
      const preflight=preflightReportTransition(locked.context,locked.record,locked.projection,request.command);
      if(!preflight.ok)return abort(preflight.code,preflight.message);
      const decision=planReportTransition(locked.record,locked.projection,preflight.actor,request.command,request.occurredAt);
      if(!decision.ok)return abort(decision.code,decision.message);
      if(!await tx.updateReport(locked.id,locked.record.version,decision.record)) return abort('stale_version','Concurrent update detected.');
      await tx.appendAudit(decision.audit);
      await tx.appendReceipt({schoolId:request.schoolId,reportId:request.reportId,actorMembershipId:request.actorMembershipId,operationKey:request.command.idempotencyKey,fingerprint:request.fingerprint,resultingVersion:decision.record.version});
      if(request.command.action==='publish')await tx.appendRelease({schoolId:request.schoolId,reportId:request.reportId,version:decision.record.version,publishedAt:request.occurredAt});
      return {ok:true,kind:'applied',version:decision.record.version} as const;
    });
  } catch(error) {
    if(error instanceof TransactionAbort)return {ok:false,code:error.code,message:error.message};
    return {ok:false,code:'transaction_failed',message:'Transaction failed and must be rolled back by the adapter.'};
  }
}
