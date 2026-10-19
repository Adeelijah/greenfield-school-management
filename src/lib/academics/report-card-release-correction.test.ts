import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit TS extension for Node offline runner.
import { normalizeReleaseCorrectionCommand, planReleaseCorrection } from './report-card-release-correction.ts';
// @ts-expect-error Explicit TS extension for Node offline runner.
import { canReadReleasedReport } from './report-card-persistence-policy.ts';
import type { CorrectionReport, CorrectionRelease, CorrectionSnapshot, CorrectionActor } from './report-card-release-correction';
const publishedAt='2026-10-19T10:00:00.000Z',now='2026-10-19T11:00:00.000Z';
function fixture(){
 const report:CorrectionReport={id:'report',schoolId:'school',studentId:'pupil',enrollmentId:'enrollment',stage:'published',version:4,assessmentScopeId:'scope',assessmentSourceVersionId:'source',assessmentRevision:7,submittedBy:'teacher',approvedBy:'admin',publishedAt,returnReason:null};
 const release:CorrectionRelease={id:'release',schoolId:'school',reportId:'report',reportVersion:4,snapshotId:'snapshot',snapshotReportVersion:3,publishedBy:'admin',releasedAt:publishedAt,revokedAt:null};
 const snapshot:CorrectionSnapshot={id:'snapshot',schoolId:'school',reportId:'report',reportVersion:3,enrollmentId:'enrollment',assessmentScopeId:'scope',assessmentSourceVersionId:'source',assessmentRevision:7};
 const actor:CorrectionActor={membershipId:'admin',schoolId:'school',role:'admin',status:'active'};
 const command={action:'revoke',reportId:'report',releaseId:'release',expectedVersion:4,operationKey:'correct-report',reason:'  Incorrect subject score  '};
 return{report,release,snapshot,actor,command};
}
function run(f=fixture(),releases:CorrectionRelease[]=[f.release],time=now){return planReleaseCorrection(f.report,releases,f.snapshot,f.actor,f.command,time);}
test('admin revokes exact publication into a new draft with reason and immutable provenance',()=>{
 const f=fixture(),result=run(f);assert.equal(result.ok,true);if(!result.ok)return;
 assert.equal(result.report.stage,'draft');assert.equal(result.report.version,5);
 assert.deepEqual([result.report.submittedBy,result.report.approvedBy,result.report.publishedAt,result.report.returnReason],[null,null,null,null]);
 assert.equal(result.release.revokedAt,now);assert.equal(result.audit.reason,'Incorrect subject score');assert.equal(result.audit.snapshotId,'snapshot');assert.equal(result.audit.snapshotReportVersion,3);
 assert.equal(result.report.assessmentSourceVersionId,'source');assert.equal(result.audit.actorMembershipId,'admin');
});
test('teacher, bursar, suspended and foreign-school actors cannot revoke',()=>{
 for(const patch of [{role:'teacher' as const},{role:'bursar' as const},{status:'suspended' as const},{schoolId:'foreign'},{membershipId:''}]){const f=fixture();Object.assign(f.actor,patch);assert.deepEqual(run(f),{ok:false,code:'forbidden'});}
});
test('command boundary rejects forged authority, missing keys, getters and blank or excessive reasons',()=>{
 const f=fixture();
 for(const raw of [null,{...f.command,schoolId:'foreign'},{...f.command,reason:' '},{...f.command,reason:'x'.repeat(2001)},{...f.command,operationKey:'x'.repeat(201)},{...f.command,action:'publish'},{...f.command,expectedVersion:1.5}])assert.equal(normalizeReleaseCorrectionCommand(raw),null);
 const decorated={...f.command,[Symbol('authority')]:true};assert.equal(normalizeReleaseCorrectionCommand(decorated),null);
 const getter={...f.command};Object.defineProperty(getter,'reason',{enumerable:true,get(){throw Error('must not read getter');}});assert.equal(normalizeReleaseCorrectionCommand(getter),null);
});
test('unpublished stages cannot use the correction command',()=>{
 for(const stage of ['draft','submitted','returned','approved'] as const){const f=fixture();f.report.stage=stage;assert.deepEqual(run(f),{ok:false,code:'invalid_transition'});}
});
test('stale competing corrections and unsafe version growth fail',()=>{
 const f=fixture();f.command.expectedVersion=3;assert.deepEqual(run(f),{ok:false,code:'stale_version'});
 f.report.version=Number.MAX_SAFE_INTEGER;f.command.expectedVersion=f.report.version;assert.equal(run(f).ok,false);
 const g=fixture(),first=run(g);assert.equal(first.ok,true);if(first.ok){g.report=first.report;assert.deepEqual(run(g),{ok:false,code:'stale_version'});}
});
test('missing, duplicated and multiple active releases never select an arbitrary release',()=>{
 const f=fixture();for(const rows of [[],[f.release,f.release],[f.release,{...f.release,id:'another'}],[{...f.release,revokedAt:now}]])assert.deepEqual(run(f,rows),{ok:false,code:'invalid_release'});
});
test('release school, report, version and target substitutions fail closed',()=>{
 for(const patch of [{schoolId:'foreign'},{reportId:'other'},{reportVersion:5},{snapshotReportVersion:2},{id:'other-release'},{releasedAt:now}]){const f=fixture();Object.assign(f.release,patch);assert.deepEqual(run(f),{ok:false,code:'invalid_release'});}
});
test('every approved snapshot identity and source binding must match the publication',()=>{
 for(const patch of [{id:'other'},{schoolId:'foreign'},{reportId:'other'},{reportVersion:2},{enrollmentId:'other'},{assessmentScopeId:'other'},{assessmentSourceVersionId:'other'},{assessmentRevision:8}]){const f=fixture();Object.assign(f.snapshot,patch);assert.deepEqual(run(f),{ok:false,code:'invalid_snapshot'});}
});
test('invalid dates, time reversal and malformed published actors are denied',()=>{
 for(const time of ['invalid','2026-02-30T10:00:00.000Z','2026-10-19T09:00:00.000Z'])assert.equal(run(fixture(),undefined,time).ok,false);
 const f=fixture();f.report.approvedBy=f.report.submittedBy;assert.equal(run(f).ok,false);
 const g=fixture();g.report.returnReason='old reason';assert.equal(run(g).ok,false);
});
test('earlier revoked history remains valid and unchanged when correcting a later publication',()=>{
 const f=fixture();f.report.version=8;f.command.expectedVersion=8;f.release.reportVersion=8;f.release.snapshotReportVersion=7;f.snapshot.reportVersion=7;
 const old={...f.release,id:'old-release',snapshotId:'old-snapshot',reportVersion:4,snapshotReportVersion:3,releasedAt:'2026-10-18T10:00:00.000Z',revokedAt:'2026-10-18T11:00:00.000Z'};
 const before=structuredClone(old);assert.equal(run(f,[old,f.release]).ok,true);assert.deepEqual(old,before);
 assert.equal(run(f,[old,{...old,id:'duplicate-version'},f.release]).ok,false);
 old.revokedAt='2026-10-18T09:00:00.000Z';assert.equal(run(f,[old,f.release]).ok,false);
});
test('planning does not mutate report, release, snapshot, actor or command and needs no fresh assessment source',()=>{
 const f=fixture(),before=structuredClone(f);for(const value of Object.values(f))Object.freeze(value);
 const result=run(f);assert.equal(result.ok,true);assert.deepEqual(f,before);
 if(result.ok){assert.notEqual(result.report,f.report);assert.notEqual(result.release,f.release);assert.equal(result.report.assessmentRevision,7);}
});
test('the existing guardian visibility policy hides a revoked publication immediately in the planned state',()=>{
 const f=fixture(),guardian={id:'guardian',schoolId:'school'},links=[{schoolId:'school',studentId:'pupil',guardianId:'guardian',active:true}];
 const before={schoolId:'school',studentId:'pupil',stage:'published' as const,releasedVersion:4,reportVersion:4,revoked:false};
 assert.equal(canReadReleasedReport(before,guardian,links),true);
 const result=run(f);assert.equal(result.ok,true);if(result.ok)assert.equal(canReadReleasedReport({...before,stage:result.report.stage,reportVersion:result.report.version,revoked:result.release.revokedAt!==null},guardian,links),false);
});
