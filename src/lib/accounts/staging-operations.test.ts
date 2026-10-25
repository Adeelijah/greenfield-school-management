import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {projectAssessmentEditor,validateAttendanceDraft,validateScoreEditorDraft} from './staging-operations.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {createApprovedSnapshotFixture} from '../academics/report-card-canonical-test-fixtures.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {projectStagingDashboard} from './staging-dashboard.ts';
import type {AssessmentEditorView} from './staging-operations';
const subject:AssessmentEditorView['subjects'][number]={id:'subject',name:'English',mode:'numeric',configVersion:1,components:[{id:'exam',label:'Exam',maximum:60,weight:100,required:true}],observations:[],bands:[],pupils:[{id:'pupil',name:'Fixture pupil',values:{exam:'50'}}]};
test('score drafts require complete bounded component values and reject forged pupil/component keys',()=>{
 assert.deepEqual(validateScoreEditorDraft(subject,{'pupil:exam':'60'}),{ok:true});
 for(const values of [{},{'pupil:exam':'61'},{'pupil:exam':'NaN'},{'pupil:exam':'1e2'},{'pupil:exam':'1.12345'},{'foreign:exam':'50'}] as Record<string,string>[])assert.equal(validateScoreEditorDraft(subject,values).ok,false);
});
test('observational score validation never accepts a fabricated observation or numeric total',()=>{const s={...subject,mode:'observational' as const,observations:[{value:'developing',label:'Developing'}]};assert.equal(validateScoreEditorDraft(s,{'pupil:exam':'developing'}).ok,true);assert.equal(validateScoreEditorDraft(s,{'pupil:exam':'50'}).ok,false);});
test('attendance draft validation requires exact roster, valid statuses and a real non-future date',()=>{
 assert.equal(validateAttendanceDraft('2026-10-23',['pupil'],{pupil:'present'},'2026-10-25').ok,true);
 for(const [date,marks]of [['2026-02-31',{pupil:'present'}],['2026-10-26',{pupil:'present'}],['2026-10-23',{}],['2026-10-23',{pupil:'present',foreign:'absent'}],['2026-10-23',{pupil:'unknown'}]] as [string,Record<string,string>][])assert.equal(validateAttendanceDraft(date,['pupil'],marks,'2026-10-25').ok,false);
});

test('assessment projection binds the complete source enrollment set to verified directory labels',()=>{
 const input=createApprovedSnapshotFixture().docs.input;
 const directory=projectStagingDashboard('teacher',[{key:'primary5',label:'Test class',workspace:{role:'teacher',pupils:input.enrollments.map(e=>({studentId:e.studentId,enrollmentId:e.id,label:'Fixture pupil'})),reports:[],assessmentRevision:input.scope.revision,subjectCount:input.roster.length}}]);assert.ok(directory);
 const view=projectAssessmentEditor(input,directory,'primary5');assert.ok(view);assert.equal(view.subjects.length,input.roster.length);assert.equal(view.subjects[0]!.pupils.length,input.enrollments.length);assert.equal(view.subjects[0]!.configVersion,input.configs[0]!.config.version);
 directory.records[0]!.enrollmentId='foreign';assert.equal(projectAssessmentEditor(input,directory,'primary5'),null);
});
