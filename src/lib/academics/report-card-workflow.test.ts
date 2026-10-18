import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node runner requires the source extension.
import { planReportTransition, type ReportRecord, type ReportActor, type ReportCommand } from './report-card-workflow.ts';
// @ts-expect-error Node runner requires the source extension.
import type { ReportCardDraft } from './report-cards.ts';

const record: ReportRecord = {schoolId:'school',studentId:'student',classId:'class',sessionId:'session',termId:'term',stage:'draft',version:1,assessmentVersion:5,submittedBy:null,approvedBy:null,publishedAt:null,returnReason:null};
const card: ReportCardDraft = {...record,status:'ready_for_review',publishable:false,subjects:[{subjectId:'math',complete:true,finalized:true,result:{studentId:'student',subjectId:'math',sessionId:'session',termId:'term',state:'finalized',total:85,grade:'A',remark:null,missingComponents:[],componentScores:[]}}]};
const teacher:ReportActor={membershipId:'teacher',schoolId:'school',role:'teacher',status:'active',assignedClassIds:['class']};
const admin:ReportActor={membershipId:'admin',schoolId:'school',role:'admin',status:'active',assignedClassIds:[]};
const command=(action:ReportCommand['action'],expectedVersion=1):ReportCommand=>({action,expectedVersion,assessmentVersion:5,idempotencyKey:action});
const run=(r:ReportRecord,a:ReportActor,c:ReportCommand,p=card)=>planReportTransition(r,p,a,c,'2026-10-19T12:00:00Z');

test('assigned teacher submits and admin approves then publishes',()=>{
 const submitted=run(record,teacher,command('submit'));assert.equal(submitted.ok,true);if(!submitted.ok)return;
 const approved=run(submitted.record,admin,command('approve',2));assert.equal(approved.ok,true);if(!approved.ok)return;
 const published=run(approved.record,admin,command('publish',3));assert.equal(published.ok,true);if(!published.ok)return;
 assert.equal(published.record.stage,'published');assert.equal(published.record.version,4);
 assert.equal(published.audit.actorMembershipId,'admin');
});
test('cross-school, suspended, bursar and unassigned teacher are denied',()=>{
 const actors:ReportActor[]=[{...teacher,schoolId:'other'},{...teacher,status:'suspended'},{...teacher,role:'bursar'},{...teacher,assignedClassIds:[]}];
 for(const actor of actors){const result=run(record,actor,command('submit'));assert.equal(result.ok,false);if(!result.ok)assert.equal(result.code,'forbidden');}
});
test('stale report or assessment versions are denied',()=>{
 assert.equal(run(record,teacher,command('submit',0)).ok,false);
 assert.equal(run(record,teacher,{...command('submit'),assessmentVersion:4}).ok,false);
});
test('incomplete subject and missing return reason are denied',()=>{
 const incomplete:ReportCardDraft={...card,status:'incomplete'};
 assert.equal(run(record,teacher,command('submit'),incomplete).ok,false);
 const submitted:ReportRecord={...record,stage:'submitted',submittedBy:'teacher'};
 assert.equal(run(submitted,admin,command('return')).ok,false);
});
test('admin return and teacher resubmission preserve audit transitions',()=>{
 const submitted=run(record,teacher,command('submit'));if(!submitted.ok)throw Error('setup');
 const returned=run(submitted.record,admin,{...command('return',2),reason:'Needs correction'});assert.equal(returned.ok,true);if(!returned.ok)return;
 const resubmitted=run(returned.record,teacher,command('submit',3));assert.equal(resubmitted.ok,true);if(!resubmitted.ok)return;
 assert.equal(resubmitted.record.stage,'submitted');
});
