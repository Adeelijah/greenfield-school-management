import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node type stripping needs the source extension.
import { preflightReportTransition, type ReportTrustedContext } from './report-card-preflight.ts';
import type { ReportRecord, ReportCommand } from './report-card-workflow.ts';
import type { ReportCardDraft } from './report-cards.ts';

const record:ReportRecord={schoolId:'school',studentId:'student',classId:'class',sessionId:'session',termId:'term',stage:'draft',version:1,assessmentVersion:8,submittedBy:null,approvedBy:null,publishedAt:null,returnReason:null};
const projection:ReportCardDraft={schoolId:'school',studentId:'student',classId:'class',sessionId:'session',termId:'term',status:'incomplete',publishable:false,subjects:[]};
const command:ReportCommand={action:'submit',expectedVersion:1,assessmentVersion:8,idempotencyKey:'key'};
const context:ReportTrustedContext={membership:{id:'teacher',schoolId:'school',role:'teacher',status:'active'},assessmentRevision:8,assignments:[{id:'assignment',schoolId:'school',membershipId:'teacher',classId:'class',sessionId:'session',status:'active'}]};
test('derives teacher scope from active server-resolved assignment',()=>{
 const result=preflightReportTransition(context,record,projection,command);
 assert.equal(result.ok,true);if(result.ok)assert.deepEqual(result.actor.assignedClassIds,['class']);
});
test('fails closed on missing membership, suspended membership and bursar',()=>{
 for(const membership of [null,{...context.membership!,status:'suspended' as const},{...context.membership!,role:'bursar' as const}]){
  const result=preflightReportTransition({...context,membership},record,projection,command);
  assert.equal(result.ok,false);
 }
});
test('rejects forged school and mixed-school assignment rows',()=>{
 assert.equal(preflightReportTransition(context,{...record,schoolId:'other'},projection,command).ok,false);
 assert.equal(preflightReportTransition({...context,assignments:[...context.assignments,{...context.assignments[0]!,schoolId:'other'}]},record,projection,command).ok,false);
});
test('rejects missing, inactive, duplicate or wrong-session teacher assignment',()=>{
 for(const assignments of [[],[{...context.assignments[0]!,status:'inactive' as const}],[context.assignments[0]!,{...context.assignments[0]!,id:'duplicate'}],[{...context.assignments[0]!,sessionId:'other'}]]){
  const result=preflightReportTransition({...context,assignments},record,projection,command);
  assert.equal(result.ok,false);
 }
});
test('rejects stale trusted assessment revision or mismatched report identity',()=>{
 assert.equal(preflightReportTransition({...context,assessmentRevision:9},record,projection,command).ok,false);
 assert.equal(preflightReportTransition(context,record,{...projection,studentId:'other'},command).ok,false);
});
test('active admin requires no class assignment',()=>{
 const result=preflightReportTransition({...context,membership:{id:'admin',schoolId:'school',role:'admin',status:'active'},assignments:[]},record,projection,command);
 assert.equal(result.ok,true);if(result.ok)assert.deepEqual(result.actor.assignedClassIds,[]);
});
