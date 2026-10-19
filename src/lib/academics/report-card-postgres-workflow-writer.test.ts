import test from 'node:test';
import assert from 'node:assert/strict';
import type { PersistedReportWorkflowCommand } from './report-card-postgres-workflow-writer';
// @ts-expect-error Node type stripping requires explicit source extension.
import { executeFixtureReportWorkflow } from './report-card-postgres-workflow-writer.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { createCanonicalWriterFixture } from './report-card-canonical-test-fixtures.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { materializeAssessmentSource } from './assessment-canonical-source.ts';
const schema='rc_it_0123456789abcdef';
const create:PersistedReportWorkflowCommand={action:'create',operationKey:'create-b',studentId:'b',enrollmentId:'enroll-b',classId:'class',sessionId:'session',termId:'term'};
function fixture(){const f=createCanonicalWriterFixture();return{...f,workflow:(command:PersistedReportWorkflowCommand,auth='auth')=>executeFixtureReportWorkflow(f.db,schema,command,async()=>({authUserId:auth}))};}
function refreshSource(f:ReturnType<typeof fixture>){
 const input=structuredClone(f.input);input.scope.revision=5;input.scores=input.scores.map(s=>({...s,numericScore:'95.0000',version:3}));
 const built=materializeAssessmentSource(input);assert.ok(built.ok);
 f.tables.assessment_scopes=[input.scope];f.tables.assessment_scores=[...input.scores];
 f.tables.assessment_source_versions=[{id:'source-2',schoolId:'school',scopeId:'scope',revision:5,sourceManifest:JSON.parse(built.materialized.manifest.canonicalJson),contentHash:built.materialized.manifest.sha256}];
 f.tables.assessment_teacher_reviews=[{id:'review-2',schoolId:'school',scopeId:'scope',rosterId:'roster',sourceVersionId:'source-2',reviewerMembershipId:'teacher'}];
 f.tables.assessment_finalizations=[{id:'final-2',reviewId:'review-2',teacherReviewId:'review-2',schoolId:'school',scopeId:'scope',rosterId:'roster',sourceVersionId:'source-2',finalizedBy:'admin',results:JSON.parse(built.materialized.subjects[0]!.results.canonicalJson),contentHash:built.materialized.subjects[0]!.results.sha256}];
}
test('teacher creates a server-ID draft and submits with atomic versioned audit/receipts',async()=>{
 const f=fixture();const made=await f.workflow(create);assert.ok(made.ok,JSON.stringify(made));assert.equal(made.version,1);assert.notEqual(made.reportId,'b');
 const submitted=await f.workflow({action:'submit',reportId:made.reportId,expectedVersion:1,operationKey:'submit-b'});assert.ok(submitted.ok,JSON.stringify(submitted));assert.equal(submitted.version,2);
 const events=f.tables.report_card_audit!;assert.equal(events[0]!.beforeVersion,0);assert.equal(events[0]!.afterVersion,1);assert.equal(events[1]!.action,'submit');
 assert.equal(f.tables.report_card_snapshots!.length,0);assert.equal(f.tables.report_card_operation_receipts!.length,2);
});
test('admin may create but cannot submit; assigned teacher can submit that draft',async()=>{
 const f=fixture();const made=await f.workflow(create,'auth-admin');assert.ok(made.ok);
 const cmd={action:'submit' as const,reportId:made.reportId,expectedVersion:1,operationKey:'submit-admin-created'};
 assert.deepEqual(await f.workflow(cmd,'auth-admin'),{ok:false,code:'forbidden'});assert.ok((await f.workflow(cmd)).ok);
});
test('duplicate identity and changed creation selector key fail without extra reports',async()=>{
 const f=fixture();const made=await f.workflow(create);assert.ok(made.ok);
 assert.deepEqual(await f.workflow({...create,operationKey:'new-key'}),{ok:false,code:'duplicate_report'});
 assert.deepEqual(await f.workflow({...create,enrollmentId:'foreign'}),{ok:false,code:'idempotency_conflict'});
 assert.equal(f.tables.report_cards!.length,2);assert.equal(f.tables.report_card_audit!.length,1);
});
test('return reason is retained in audit after resubmission clears the current reason',async()=>{
 const f=fixture();const returned=await f.workflow({action:'return',reportId:'report',expectedVersion:2,operationKey:'return-a',reason:'  Review the result  '},'auth-admin');assert.ok(returned.ok);
 assert.equal(f.tables.report_cards![0]!.returnReason,'Review the result');
 assert.ok((await f.workflow({action:'submit',reportId:'report',expectedVersion:3,operationKey:'resubmit-a'})).ok);
 assert.equal(f.tables.report_cards![0]!.returnReason,null);
 assert.equal(f.tables.report_card_audit!.find(a=>a.action==='return')!.reason,'Review the result');
});
test('approved reopen preserves old snapshots and later submit pins the newest source',async()=>{
 const f=fixture();const approved=await f.run();assert.ok(approved.ok);const old=structuredClone(f.tables.report_card_snapshots);
 refreshSource(f);
 assert.ok((await f.workflow({action:'reopen',reportId:'report',expectedVersion:3,operationKey:'reopen-a'},'auth-admin')).ok);
 assert.equal(f.tables.report_cards![0]!.assessmentSourceVersionId,'source');
 assert.ok((await f.workflow({action:'submit',reportId:'report',expectedVersion:4,operationKey:'submit-refreshed'})).ok);
 assert.equal(f.tables.report_cards![0]!.assessmentSourceVersionId,'source-2');assert.equal(f.tables.report_cards![0]!.assessmentRevision,5);
 assert.deepEqual(f.tables.report_card_snapshots,old);
});
test('stale or incomplete sources permit return but never incomplete resubmission',async()=>{
 const f=fixture();f.tables.assessment_scopes![0]!.revision=5;
 assert.ok((await f.workflow({action:'return',reportId:'report',expectedVersion:2,operationKey:'return-stale',reason:'Recheck source'},'auth-admin')).ok);
 const result=await f.workflow({action:'submit',reportId:'report',expectedVersion:3,operationKey:'submit-incomplete'});assert.equal(result.ok,false);
 assert.equal(f.tables.report_cards![0]!.stage,'returned');assert.equal(f.tables.report_cards![0]!.version,3);
});
test('historical creation/submission replay survives approval/publication and detects reuse',async()=>{
 const f=fixture();const made=await f.workflow(create);assert.ok(made.ok);
 const cmd={action:'submit' as const,reportId:made.reportId,expectedVersion:1,operationKey:'submit-b'};const submitted=await f.workflow(cmd);assert.ok(submitted.ok);
 assert.ok((await f.run({reportId:made.reportId,action:'approve',expectedVersion:2,operationKey:'approve-b'})).ok);
 assert.ok((await f.run({reportId:made.reportId,action:'publish',expectedVersion:3,operationKey:'publish-b'})).ok);
 assert.deepEqual(await f.workflow(create),{...made,kind:'replay'});assert.deepEqual(await f.workflow(cmd),{...submitted,kind:'replay'});
 assert.deepEqual(await f.workflow({...cmd,expectedVersion:2}),{ok:false,code:'idempotency_conflict'});
});
test('creation report/audit/receipt failures leave no orphan and same-key retry works',async()=>{
 for(const name of ['report_cards','report_card_audit','report_card_operation_receipts']){
  const f=fixture();const before=structuredClone(f.tables);f.fail(name);
  assert.deepEqual(await f.workflow(create),{ok:false,code:'transaction_failed'});assert.deepEqual(f.tables,before);
  f.fail(null);assert.ok((await f.workflow(create)).ok);assert.equal((await f.workflow(create)).ok,true);
 }
});
test('submit/return/reopen audit or receipt failure rolls back source pin and workflow state',async()=>{
 for(const action of ['submit','return','reopen'] as const)for(const failure of ['report_card_audit','report_card_operation_receipts']){
  const f=fixture();if(action==='submit')f.tables.report_cards![0]!.stage='draft';if(action==='reopen')assert.ok((await f.run()).ok);
  const command:PersistedReportWorkflowCommand={action,reportId:'report',expectedVersion:action==='reopen'?3:2,operationKey:'rollback-'+action,...action==='return'?{reason:'Review'}:{}};
  const before=structuredClone(f.tables);f.fail(failure);assert.deepEqual(await f.workflow(command,action==='submit'?'auth':'auth-admin'),{ok:false,code:'transaction_failed'});assert.deepEqual(f.tables,before);
  f.fail(null);assert.ok((await f.workflow(command,action==='submit'?'auth':'auth-admin')).ok);
 }
});
test('role, assignment, foreign enrollment and published reopen guards deny without writes',async()=>{
 const f=fixture();assert.deepEqual(await f.workflow({action:'return',reportId:'report',expectedVersion:2,operationKey:'teacher-return',reason:'Review'}),{ok:false,code:'forbidden'});
 const noAssignment=fixture();noAssignment.tables.teacher_class_assignments=[];assert.deepEqual(await noAssignment.workflow(create),{ok:false,code:'forbidden'});
 const foreign=fixture();assert.deepEqual(await foreign.workflow({...create,enrollmentId:'foreign'}),{ok:false,code:'invalid_reference'});
 const published=fixture();assert.ok((await published.run()).ok);assert.ok((await published.run({reportId:'report',action:'publish',expectedVersion:3,operationKey:'publish-a'})).ok);
 assert.deepEqual(await published.workflow({action:'reopen',reportId:'report',expectedVersion:4,operationKey:'reopen-published'},'auth-admin'),{ok:false,code:'invalid_transition'});
});
test('blank return reason and stale versions cannot append audit or receipt',async()=>{
 const f=fixture();assert.deepEqual(await f.workflow({action:'return',reportId:'report',expectedVersion:2,operationKey:'blank',reason:' '},'auth-admin'),{ok:false,code:'invalid'});
 assert.deepEqual(await f.workflow({action:'return',reportId:'report',expectedVersion:1,operationKey:'stale',reason:'Review'},'auth-admin'),{ok:false,code:'stale_version'});assert.equal(f.tables.report_card_audit!.length,0);
});
test('shared actor keys conflict across command families and revoked class access blocks replay',async()=>{
 const f=fixture();const made=await f.workflow(create,'auth-admin');assert.ok(made.ok);
 assert.ok((await f.workflow({action:'submit',reportId:made.reportId,expectedVersion:1,operationKey:'submit-b'})).ok);
 assert.deepEqual(await f.run({reportId:made.reportId,action:'approve',expectedVersion:2,operationKey:'create-b'}),{ok:false,code:'idempotency_conflict'});
 const g=fixture();assert.ok((await g.workflow(create)).ok);g.tables.teacher_class_assignments![0]!.endedAt=new Date();assert.deepEqual(await g.workflow(create),{ok:false,code:'forbidden'});
});
