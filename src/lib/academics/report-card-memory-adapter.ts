// Offline-only transaction simulator. No database, authentication, network or parent portal.
// @ts-expect-error Node's type-stripping runner requires the explicit source extension.
import { preflightReportTransition, type ReportTrustedContext } from './report-card-preflight.ts';
// @ts-expect-error Node's type-stripping runner requires the explicit source extension.
import { planReportTransition, type ReportAudit, type ReportCommand, type ReportRecord } from './report-card-workflow.ts';
// @ts-expect-error Node's type-stripping runner requires the explicit source extension.
import { planReportWrite, type ReportStoredReceipt } from './report-card-persistence-policy.ts';
import type { ReportCardDraft } from './report-cards';

export type MemoryReport = { id:string; record:ReportRecord; projection:ReportCardDraft; contexts:ReportTrustedContext[] };
export type MemoryRelease = {schoolId:string;reportId:string;version:number;publishedAt:string};
export type MemoryState = {reports:MemoryReport[];audits:ReportAudit[];receipts:ReportStoredReceipt[];releases:MemoryRelease[]};
export type MemoryOperation = {schoolId:string;reportId:string;actorMembershipId:string;fingerprint:string;command:ReportCommand;occurredAt:string};
export type MemoryResult = {ok:true;kind:'applied'|'replay';version:number} | {ok:false;code:string;message:string};
export type MemoryFault = 'after_record'|'after_audit'|'after_receipt'|'after_release';
const clone = <T>(value:T):T=>structuredClone(value);
const fail = (code:string,message:string):MemoryResult=>({ok:false,code,message});

/** Fictional trusted inputs are supplied at construction; callers cannot override roles or assessment rows per operation. */
export class ReportMemoryStore {
 private state:MemoryState;
 constructor(initial:MemoryState){this.state=clone(initial);}
 snapshot():MemoryState{return clone(this.state);}
 apply(operation:MemoryOperation,injectFault?:MemoryFault):MemoryResult {
  const draft=clone(this.state);
  if (!operation || !operation.schoolId || !operation.reportId || !operation.actorMembershipId || !operation.command) return fail('invalid','Complete operation required.');
  const matches=draft.reports.filter(r=>r.id===operation.reportId && r.record.schoolId===operation.schoolId);
  if(matches.length!==1)return fail('not_found','School-scoped report not found or ambiguous.');
  const report=matches[0]!;
  const contexts=report.contexts.filter(c=>c.membership?.id===operation.actorMembershipId && c.membership.schoolId===operation.schoolId);
  if(contexts.length!==1)return fail('forbidden','Exactly one stored verified membership context is required.');
  const context=contexts[0]!;
  const write=planReportWrite({
   schoolId:operation.schoolId,reportId:operation.reportId,actorMembershipId:operation.actorMembershipId,
   operationKey:operation.command.idempotencyKey,fingerprint:operation.fingerprint,expectedVersion:operation.command.expectedVersion
  },{schoolId:report.record.schoolId,id:report.id,version:report.record.version},draft.receipts);
  if(!write.ok)return fail(write.code,'Idempotency or version precondition failed.');
  if(write.kind==='replay')return {ok:true,kind:'replay',version:write.resultingVersion};
  const preflight=preflightReportTransition(context,report.record,report.projection,operation.command);
  if(!preflight.ok)return fail(preflight.code,preflight.message);
  const decision=planReportTransition(report.record,report.projection,preflight.actor,operation.command,operation.occurredAt);
  if(!decision.ok)return fail(decision.code,decision.message);
  try {
   report.record=decision.record;
   if(injectFault==='after_record')throw Error('injected record failure');
   draft.audits.push(decision.audit);
   if(injectFault==='after_audit')throw Error('injected audit failure');
   draft.receipts.push({schoolId:operation.schoolId,reportId:operation.reportId,actorMembershipId:operation.actorMembershipId,operationKey:operation.command.idempotencyKey,fingerprint:operation.fingerprint,resultingVersion:decision.record.version});
   if(injectFault==='after_receipt')throw Error('injected receipt failure');
   if(operation.command.action==='publish')draft.releases.push({schoolId:operation.schoolId,reportId:operation.reportId,version:decision.record.version,publishedAt:operation.occurredAt});
   if(injectFault==='after_release')throw Error('injected release failure');
  }catch{return fail('transaction_failed','The simulated transaction was rolled back.');}
  this.state=draft;
  return {ok:true,kind:'applied',version:decision.record.version};
 }
}
