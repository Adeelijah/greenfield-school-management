import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit TS extension for Node offline runner.
import { createCanonicalWriterFixture } from './report-card-canonical-test-fixtures.ts';
// @ts-expect-error Explicit TS extension for Node offline runner.
import { executeFixtureReportRevocation } from './report-card-postgres-revoke-writer.ts';
const schema='rc_it_0123456789abcdef';
async function fixture(){
 const f=createCanonicalWriterFixture();assert.equal((await f.run()).ok,true);
 assert.equal((await f.run({action:'publish',reportId:'report',expectedVersion:3,operationKey:'publish-before-revoke'})).ok,true);
 const command={action:'revoke',reportId:'report',releaseId:f.tables.report_card_releases![0]!.id,expectedVersion:4,operationKey:'withdraw-report',reason:'Correct subject score'};
 return{...f,command,revoke:(raw:unknown=command,auth='auth-admin')=>executeFixtureReportRevocation(f.db,schema,raw,async()=>({authUserId:auth}))};
}
test('actual revoke adapter writes draft, one-way release, exact reason audit and receipt atomically',async()=>{
 const f=await fixture(),snapshot=structuredClone(f.tables.report_card_snapshots),release=structuredClone(f.tables.report_card_releases![0]!);
 const result=await f.revoke();assert.equal(result.ok,true,JSON.stringify(result));if(!result.ok)return;
 assert.equal(result.kind,'applied');assert.equal(result.version,5);assert.equal(result.releaseId,release.id);assert.equal(result.snapshotId,release.snapshotId);
 assert.equal(f.tables.report_cards![0]!.stage,'draft');assert.equal(f.tables.report_cards![0]!.submittedBy,null);
 assert.equal(f.tables.report_card_releases![0]!.revokedAt,result.revokedAt);assert.deepEqual(f.tables.report_card_snapshots,snapshot);
 const audit=f.tables.report_card_audit!.find(r=>r.action==='revoke');assert.equal(audit?.releaseId,release.id);assert.equal(audit?.reason,f.command.reason);
});
test('identical keys replay historical revocation after later report and source changes',async()=>{
 const f=await fixture();const first=await f.revoke();assert.equal(first.ok,true);
 Object.assign(f.tables.report_cards![0]!,{stage:'published',version:8,assessmentSourceVersionId:'new-source',assessmentRevision:9});f.tables.assessment_source_versions=[];
 const before=structuredClone(f.tables),again=await f.revoke();assert.equal(again.ok,true,JSON.stringify(again));if(again.ok)assert.equal(again.kind,'replay');assert.deepEqual(f.tables,before);
});
test('reused operation key with changed reason, release or expected version conflicts',async()=>{
 const f=await fixture();assert.equal((await f.revoke()).ok,true);
 for(const patch of [{reason:'Different reason'},{releaseId:'other-release'},{expectedVersion:5}])assert.deepEqual(await f.revoke({...f.command,...patch}),{ok:false,code:'idempotency_conflict'});
});
test('teacher, bursar, suspended actor and foreign school report are denied without writes',async()=>{
 const f=await fixture(),before=structuredClone(f.tables);assert.deepEqual(await f.revoke(f.command,'auth'),{ok:false,code:'forbidden'});assert.deepEqual(f.tables,before);
 for(const patch of [{role:'bursar'},{status:'suspended'}]){const admin=f.tables.memberships!.find(r=>r.id==='admin')!,saved={...admin};Object.assign(admin,patch);const state=structuredClone(f.tables);assert.deepEqual(await f.revoke(),{ok:false,code:'forbidden'});assert.deepEqual(f.tables,state);Object.assign(f.tables.memberships!.find(r=>r.id==='admin')!,saved);}
 f.tables.report_cards![0]!.schoolId='foreign';assert.deepEqual(await f.revoke(),{ok:false,code:'not_found'});
});
test('stale report version, wrong release and nonpublished transitions fail closed',async()=>{
 const f=await fixture();assert.deepEqual(await f.revoke({...f.command,expectedVersion:3}),{ok:false,code:'stale_version'});
 assert.deepEqual(await f.revoke({...f.command,releaseId:'other'}),{ok:false,code:'invalid_release'});
 f.tables.report_cards![0]!.stage='approved';assert.deepEqual(await f.revoke(),{ok:false,code:'invalid_transition'});
});
test('substituted snapshot and ambiguous active releases cannot be revoked',async()=>{
 const f=await fixture();f.tables.report_card_snapshots![0]!.enrollmentId='other';assert.deepEqual(await f.revoke(),{ok:false,code:'invalid_snapshot'});
 const g=await fixture();g.tables.report_card_releases!.push({...g.tables.report_card_releases![0]!,id:'other'});assert.deepEqual(await g.revoke(),{ok:false,code:'invalid_release'});
});
test('release/report/audit/receipt failures roll back every write and allow same-key retry then replay',async()=>{
 for(const name of ['report_card_releases','report_cards','report_card_audit','report_card_operation_receipts']){
  const f=await fixture(),before=structuredClone(f.tables);f.fail(name);
  assert.deepEqual(await f.revoke(),{ok:false,code:'transaction_failed'});assert.deepEqual(f.tables,before);
  f.fail(null);const retry=await f.revoke();assert.equal(retry.ok,true,JSON.stringify(retry));if(retry.ok)assert.equal(retry.kind,'applied');
  const replay=await f.revoke();assert.equal(replay.ok,true);if(replay.ok)assert.equal(replay.kind,'replay');
 }
});
test('revocation does not need fresh sources or currently active original publisher and teacher',async()=>{
 const f=await fixture();f.tables.assessment_source_versions=[];f.tables.teacher_class_assignments=[];
 f.tables.memberships!.find(r=>r.id==='teacher')!.status='suspended';
 f.tables.memberships!.push({id:'former-publisher',schoolId:'school',userId:'former-user',role:'admin',status:'suspended'});
 f.tables.report_card_releases![0]!.publishedBy='former-publisher';
 const result=await f.revoke();assert.equal(result.ok,true,JSON.stringify(result));
});
test('malformed replay receipts and missing immutable revoke audit are refused',async()=>{
 const f=await fixture();assert.equal((await f.revoke()).ok,true);
 const receipt=f.tables.report_card_operation_receipts!.find(r=>r.operationKey===f.command.operationKey)!;
 const outcome=receipt.outcome as Record<string,unknown>;outcome.snapshotId='forged';assert.deepEqual(await f.revoke(),{ok:false,code:'invalid_receipt'});
 const g=await fixture();assert.equal((await g.revoke()).ok,true);g.tables.report_card_audit=g.tables.report_card_audit!.filter(r=>r.action!=='revoke');assert.deepEqual(await g.revoke(),{ok:false,code:'invalid_receipt'});
 const h=await fixture();assert.equal((await h.revoke()).ok,true);h.tables.report_card_audit!.find(r=>r.action==='revoke')!.occurredAt='2000-01-01T00:00:00.000Z';assert.deepEqual(await h.revoke(),{ok:false,code:'invalid_receipt'});
});
test('invalid raw commands stop before verified identity and suspended actors cannot replay',async()=>{
 let called=false;const f=await fixture();
 assert.deepEqual(await executeFixtureReportRevocation(f.db,schema,{...f.command,schoolId:'forged'},async()=>{called=true;return null;}),{ok:false,code:'invalid'});assert.equal(called,false);
 assert.equal((await f.revoke()).ok,true);f.tables.memberships!.find(r=>r.id==='admin')!.status='suspended';assert.deepEqual(await f.revoke(),{ok:false,code:'forbidden'});
});
