import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { executeReportTransaction, type ReportTransaction, type TransactionRunner } from './report-card-transaction-port.ts';
import type { ReportRecord } from './report-card-workflow';
import type { ReportCardDraft } from './report-cards';
const record:ReportRecord={schoolId:'school',studentId:'student',classId:'class',sessionId:'session',termId:'term',stage:'draft',version:1,assessmentVersion:5,submittedBy:null,approvedBy:null,publishedAt:null,returnReason:null};
const projection:ReportCardDraft={...record,status:'ready_for_review',publishable:false,subjects:[{subjectId:'math',complete:true,finalized:true,result:{studentId:'student',subjectId:'math',sessionId:'session',termId:'term',state:'finalized',total:86,grade:'A',remark:null,missingComponents:[],componentScores:[]}}]};
const context={membership:{id:'teacher',schoolId:'school',role:'teacher' as const,status:'active' as const},assignments:[{id:'a',schoolId:'school',membershipId:'teacher',classId:'class',sessionId:'session',status:'active' as const}],assessmentRevision:5};
const request={schoolId:'school',reportId:'report',actorMembershipId:'teacher',fingerprint:'a'.repeat(64),command:{action:'submit' as const,expectedVersion:1,assessmentVersion:5,idempotencyKey:'op-1'},occurredAt:'2026-10-19T12:00:00Z'};
function fake(failAt?:'audit'|'update') {
 let data={record:structuredClone(record),audits:0,receipts:0,releases:0};
 const runner:TransactionRunner={async run<T>(callback:(tx:ReportTransaction)=>Promise<T>):Promise<T>{
  const draft=structuredClone(data);
  const tx:ReportTransaction={
   async lockReport(schoolId,reportId,actorId){return schoolId==='school'&&reportId==='report'&&actorId==='teacher'?{id:'report',record:draft.record,projection,context}:null;},
   async findReceipts(){return [];},
   async updateReport(_id,version,next){if(failAt==='update'||draft.record.version!==version)return false;draft.record=next;return true;},
   async appendAudit(){if(failAt==='audit')throw Error('injected');draft.audits++;},
   async appendReceipt(){draft.receipts++;},
   async appendRelease(){draft.releases++;},
  };
  const result=await callback(tx);
  data=draft;
  return result;
 }};
 return {runner,snapshot:()=>structuredClone(data)};
}
test('transaction port applies report and audit/receipt together',async()=>{
 const store=fake();
 assert.deepEqual(await executeReportTransaction(store.runner,request),{ok:true,kind:'applied',version:2});
 assert.equal(store.snapshot().record.stage,'submitted');
 assert.equal(store.snapshot().audits,1);
 assert.equal(store.snapshot().receipts,1);
});
test('failed append rolls back all writes in fake transaction',async()=>{
 const store=fake('audit');const before=store.snapshot();
 const result=await executeReportTransaction(store.runner,request);
 assert.equal(result.ok,false);assert.deepEqual(store.snapshot(),before);
});
test('stale update and forged school fail without changes',async()=>{
 const store=fake('update');
 assert.equal((await executeReportTransaction(store.runner,request)).ok,false);
 assert.deepEqual(store.snapshot().record,record);
 assert.equal((await executeReportTransaction(store.runner,{...request,schoolId:'other'})).ok,false);
});
