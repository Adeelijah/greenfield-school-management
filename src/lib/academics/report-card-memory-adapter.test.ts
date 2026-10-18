import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node type stripping requires the source extension.
import { ReportMemoryStore, type MemoryState, type MemoryOperation } from './report-card-memory-adapter.ts';
import type { ReportRecord } from './report-card-workflow.ts';
import type { ReportCardDraft } from './report-cards.ts';
const record:ReportRecord={schoolId:'school',studentId:'student',classId:'class',sessionId:'session',termId:'term',stage:'draft',version:1,assessmentVersion:5,submittedBy:null,approvedBy:null,publishedAt:null,returnReason:null};
const projection:ReportCardDraft={...record,status:'ready_for_review',publishable:false,subjects:[{subjectId:'math',complete:true,finalized:true,result:{studentId:'student',subjectId:'math',sessionId:'session',termId:'term',state:'finalized',total:85,grade:'A',remark:null,missingComponents:[],componentScores:[]}}]};
const assignment={id:'assignment',schoolId:'school',membershipId:'teacher',classId:'class',sessionId:'session',status:'active' as const};
const state=():MemoryState=>({reports:[{id:'report',record,projection,contexts:[
 {membership:{id:'teacher',schoolId:'school',role:'teacher',status:'active'},assignments:[assignment],assessmentRevision:5},
 {membership:{id:'admin',schoolId:'school',role:'admin',status:'active'},assignments:[],assessmentRevision:5},
 {membership:{id:'bursar',schoolId:'school',role:'bursar',status:'active'},assignments:[],assessmentRevision:5}
]}],audits:[],receipts:[],releases:[]});
const op=(action:MemoryOperation['command']['action'],actorMembershipId:string,expectedVersion:number):MemoryOperation=>({schoolId:'school',reportId:'report',actorMembershipId,fingerprint:action.charCodeAt(0).toString(16).padStart(2,'0').repeat(32),command:{action,expectedVersion,assessmentVersion:5,idempotencyKey:action},occurredAt:'2026-10-19T12:00:00Z'});
test('teacher submits, admin approves and publishes with atomic audit and release',()=>{
 const store=new ReportMemoryStore(state());
 assert.equal(store.apply(op('submit','teacher',1)).ok,true);
 assert.equal(store.apply(op('approve','admin',2)).ok,true);
 assert.equal(store.apply(op('publish','admin',3)).ok,true);
 const snapshot=store.snapshot();
 assert.equal(snapshot.reports[0]!.record.stage,'published');
 assert.equal(snapshot.audits.length,3);
 assert.equal(snapshot.receipts.length,3);
 assert.equal(snapshot.releases.length,1);
 assert.equal(snapshot.releases[0]!.version,4);
});
test('same operation replays but reused key with different fingerprint conflicts',()=>{
 const store=new ReportMemoryStore(state());const command=op('submit','teacher',1);
 assert.equal(store.apply(command).ok,true);
 assert.deepEqual(store.apply(command),{ok:true,kind:'replay',version:2});
 assert.equal(store.apply({...command,fingerprint:'f'.repeat(64)}).ok,false);
 assert.equal(store.snapshot().audits.length,1);
});
test('stale competing action cannot both update report',()=>{
 const store=new ReportMemoryStore(state());
 assert.equal(store.apply(op('submit','teacher',1)).ok,true);
 assert.deepEqual(store.apply(op('submit','teacher',1)),{ok:true,kind:'replay',version:2});
 assert.equal(store.apply({...op('submit','teacher',1),command:{...op('submit','teacher',1).command,idempotencyKey:'new-operation'} }).ok,false);
 assert.equal(store.snapshot().reports[0]!.record.version,2);
});
test('injected failures roll back report, audit, receipt and release together',()=>{
 for(const fault of ['after_record','after_audit','after_receipt','after_release'] as const){
  const store=new ReportMemoryStore(state());
  store.apply(op('submit','teacher',1));
  store.apply(op('approve','admin',2));
  const before=store.snapshot();
  assert.deepEqual(store.apply(op('publish','admin',3),fault),{ok:false,code:'transaction_failed',message:'The simulated transaction was rolled back.'});
  assert.deepEqual(store.snapshot(),before);
 }
});
test('bursar, cross-school and forged actor are rejected without mutation',()=>{
 const store=new ReportMemoryStore(state());const before=store.snapshot();
 assert.equal(store.apply(op('submit','bursar',1)).ok,false);
 assert.equal(store.apply(op('submit','stranger',1)).ok,false);
 assert.equal(store.apply({...op('submit','teacher',1),schoolId:'other'}).ok,false);
 assert.deepEqual(store.snapshot(),before);
});
test('incomplete projection prevents submission',()=>{
 const initial=state();initial.reports[0]!.projection={...projection,status:'incomplete'};
 const store=new ReportMemoryStore(initial);
 assert.equal(store.apply(op('submit','teacher',1)).ok,false);
 assert.deepEqual(store.snapshot(),initial);
});
