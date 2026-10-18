import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node type stripping requires explicit source extension.
import { planReportWrite, canReadReleasedReport } from './report-card-persistence-policy.ts';
const intent={schoolId:'school-a',reportId:'report-1',actorMembershipId:'member-1',operationKey:'op-1',fingerprint:'a'.repeat(64),expectedVersion:2};
const stored={schoolId:'school-a',id:'report-1',version:2};
test('new report operation requires matching optimistic version',()=>{
 assert.deepEqual(planReportWrite(intent,stored,[]),{ok:true,kind:'new'});
 assert.deepEqual(planReportWrite({...intent,expectedVersion:1},stored,[]),{ok:false,code:'stale_version'});
});
test('identical idempotency receipt replays even after the version advances',()=>{
 const receipt={...intent,resultingVersion:3};
 assert.deepEqual(planReportWrite(intent,{...stored,version:3},[receipt]),{ok:true,kind:'replay',resultingVersion:3});
});
test('operation key collisions and duplicate receipts fail closed',()=>{
 const receipt={...intent,resultingVersion:3};
 assert.equal(planReportWrite({...intent,fingerprint:'b'.repeat(64)},stored,[receipt]).ok,false);
 assert.equal(planReportWrite(intent,stored,[receipt,receipt]).ok,false);
 assert.equal(planReportWrite({...intent,reportId:'other'},stored,[receipt]).ok,false);
});
test('cross-school, malformed fingerprints and invalid version fail closed',()=>{
 assert.equal(planReportWrite({...intent,schoolId:'school-b'},stored,[]).ok,false);
 assert.equal(planReportWrite({...intent,fingerprint:'not-a-hash'},stored,[]).ok,false);
 assert.equal(planReportWrite({...intent,expectedVersion:0},stored,[]).ok,false);
 assert.equal(planReportWrite(intent,stored,[{...intent,schoolId:'school-b',resultingVersion:3}]).ok,false);
});
const release={schoolId:'school-a',studentId:'student-1',stage:'published' as const,releasedVersion:3,reportVersion:3,revoked:false};
const guardian={id:'guardian-1',schoolId:'school-a'};
const links=[{schoolId:'school-a',studentId:'student-1',guardianId:'guardian-1',active:true}];
test('published release is visible only to linked guardian',()=>{
 assert.equal(canReadReleasedReport(release,guardian,links),true);
 assert.equal(canReadReleasedReport(release,{...guardian,id:'stranger'},links),false);
 assert.equal(canReadReleasedReport(release,{...guardian,schoolId:'school-b'},links),false);
 assert.equal(canReadReleasedReport(release,null,links),false);
});
test('revoked, stale, unpublished and inactive guardian releases fail closed',()=>{
 assert.equal(canReadReleasedReport({...release,revoked:true},guardian,links),false);
 assert.equal(canReadReleasedReport({...release,reportVersion:4},guardian,links),false);
 assert.equal(canReadReleasedReport({...release,stage:'approved'},guardian,links),false);
 assert.equal(canReadReleasedReport(release,guardian,[{...links[0]!,active:false}]),false);
 assert.equal(canReadReleasedReport(release,guardian,[...links,{...links[0]!,schoolId:'school-b'}]),false);
});
