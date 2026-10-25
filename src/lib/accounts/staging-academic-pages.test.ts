import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { canOpenAcademicPage, academicPageHref, filterAcademicRecords, reportWorkflowHref } from './staging-academic-pages.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { projectStagingDashboard } from './staging-dashboard.ts';
import type { StagingWorkspace } from '../academics/report-card-staging-ui';
test('academic page matrix separates admin directory, teacher classes and report access',()=>{
 for(const role of ['admin','teacher','bursar','owner']){
  assert.equal(canOpenAcademicPage(role,'students'),role==='admin');assert.equal(canOpenAcademicPage(role,'classes'),role==='teacher');assert.equal(canOpenAcademicPage(role,'reports'),role==='admin'||role==='teacher');
 }
 assert.equal(academicPageHref('Students','teacher'),null);assert.equal(academicPageHref('Report cards','bursar'),null);assert.equal(academicPageHref('My classes','teacher'),'/staging/classes');
 assert.equal(reportWorkflowHref('foreign'),null);assert.equal(reportWorkflowHref('creche'),'/staging/report-cards?class=creche');
});
test('directory/report filters preserve exact pupil report pins and do not manufacture missing reports',()=>{
 const w:StagingWorkspace={role:'teacher',assessmentRevision:2,subjectCount:1,pupils:[{studentId:'one',enrollmentId:'enrollment-1',label:'Ada Fixture'},{studentId:'two',enrollmentId:'enrollment-2',label:'Bola Fixture'}],reports:[{reportId:'report-1',studentId:'one',enrollmentId:'enrollment-1',version:3,stage:'returned',returnReason:'Check score',releaseId:null}]};
 const d=projectStagingDashboard('teacher',[{key:'primary5',label:'Primary 5 A',workspace:w}]);assert.ok(d);
 const r=filterAcademicRecords(d,'  ADA ','primary5','returned');assert.equal(r.length,1);assert.equal(r[0]!.reportId,'report-1');assert.equal(r[0]!.reportVersion,3);assert.equal(r[0]!.returnReason,'Check score');
 assert.equal(filterAcademicRecords(d,'','creche','all').length,0);assert.equal(filterAcademicRecords(d,'','all','none')[0]!.reportId,null);assert.equal(d.classes[0]!.notSubmitted,2);assert.equal(d.records.length,2);
});
