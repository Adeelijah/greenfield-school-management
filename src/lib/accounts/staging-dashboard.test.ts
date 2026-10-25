import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { projectStagingDashboard } from './staging-dashboard.ts';
import type { StagingWorkspace } from '../academics/report-card-staging-ui';
const workspace = (role: 'admin' | 'teacher'): StagingWorkspace => ({role,pupils:[{studentId:'pupil',enrollmentId:'enrollment',label:'Fixture pupil'}],reports:[],assessmentRevision:2,subjectCount:2});
test('verified dashboard derives pending reports without fabricating attendance or finance',()=>{
 const w=workspace('teacher'),r=projectStagingDashboard('teacher',[{label:'Test class',workspace:w}]);assert.ok(r);assert.equal(r.records.length,1);assert.equal(r.records[0]!.reportStatus,'Not created');assert.equal(r.records[0]!.attendance,'Not connected');assert.equal(r.records[0]!.balance,null);assert.deepEqual(r.metrics.map(m=>m[0]),['1','1','1','0']);
});
test('dashboard counts submitted and published reports with selected role semantics',()=>{
 const w=workspace('admin');w.reports=[{reportId:'report',studentId:'pupil',enrollmentId:'enrollment',version:1,stage:'submitted',returnReason:null,releaseId:null}];
 const r=projectStagingDashboard('admin',[{label:'Test class',workspace:w}]);assert.ok(r);assert.equal(r.metrics[2]![0],'1');assert.equal(r.records[0]!.reportStatus,'Awaiting review');w.reports[0]!.stage='published';assert.equal(projectStagingDashboard('admin',[{label:'Test',workspace:w}])!.metrics[3]![0],'1');
});
test('projection denies changed role, duplicate cross-class pupils and unbound report identities',()=>{
 const w=workspace('teacher');assert.equal(projectStagingDashboard('admin',[{label:'Test',workspace:w}]),null);assert.equal(projectStagingDashboard('teacher',[{label:'One',workspace:w},{label:'Two',workspace:w}]),null);
 w.reports=[{reportId:'report',studentId:'foreign',enrollmentId:'enrollment',version:1,stage:'submitted',returnReason:null,releaseId:null}];assert.equal(projectStagingDashboard('teacher',[{label:'Test',workspace:w}]),null);
});
