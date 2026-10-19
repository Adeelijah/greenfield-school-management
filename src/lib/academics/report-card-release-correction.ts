// Pure review-only policy. Caller must authenticate, lock, deduplicate and persist atomically.
import type { ReportActor, ReportStage } from './report-card-workflow';
export type ReleaseCorrectionCommand = {action:'revoke';reportId:string;releaseId:string;expectedVersion:number;operationKey:string;reason:string};
export type CorrectionReport = {
 id:string;schoolId:string;studentId:string;enrollmentId:string;stage:ReportStage;version:number;
 assessmentScopeId:string;assessmentSourceVersionId:string;assessmentRevision:number;
 submittedBy:string|null;approvedBy:string|null;publishedAt:string|null;returnReason:string|null;
};
export type CorrectionRelease = {id:string;schoolId:string;reportId:string;reportVersion:number;snapshotId:string;snapshotReportVersion:number;publishedBy:string;releasedAt:string;revokedAt:string|null};
export type CorrectionSnapshot = {id:string;schoolId:string;reportId:string;reportVersion:number;enrollmentId:string;assessmentScopeId:string;assessmentSourceVersionId:string;assessmentRevision:number};
export type CorrectionActor = Pick<ReportActor,'membershipId'|'schoolId'|'role'|'status'>;
export type ReleaseCorrectionDecision = {ok:false;code:'invalid'|'forbidden'|'stale_version'|'invalid_transition'|'invalid_release'|'invalid_snapshot'} | {
 ok:true;report:CorrectionReport;release:CorrectionRelease;
 audit:{action:'revoke';schoolId:string;reportId:string;actorMembershipId:string;beforeStage:'published';afterStage:'draft';beforeVersion:number;afterVersion:number;reason:string;releaseId:string;snapshotId:string;snapshotReportVersion:number;operationKey:string;occurredAt:string};
};
const text = (value:unknown):value is string => typeof value==='string' && value.length>0 && value===value.trim();
const positive = (value:unknown):value is number => Number.isSafeInteger(value) && (value as number)>0;
const instant = (value:unknown):value is string => typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value;
export function normalizeReleaseCorrectionCommand(raw:unknown):ReleaseCorrectionCommand|null {
 if(!raw || typeof raw!=='object' || Array.isArray(raw))return null;
 const descriptors=Object.getOwnPropertyDescriptors(raw);
 const allowed=['action','reportId','releaseId','expectedVersion','operationKey','reason'];
 if(Reflect.ownKeys(raw).length!==allowed.length || Reflect.ownKeys(raw).some(key=>typeof key!=='string'||!allowed.includes(key)||!('value' in descriptors[key]!)))return null;
 const row=raw as Record<string,unknown>;
 if(row.action!=='revoke'||!text(row.reportId)||!text(row.releaseId)||!positive(row.expectedVersion)||!text(row.operationKey)||row.operationKey.length>200||typeof row.reason!=='string'||!row.reason.trim()||row.reason.trim().length>2000)return null;
 return {action:'revoke',reportId:row.reportId,releaseId:row.releaseId,expectedVersion:row.expectedVersion,operationKey:row.operationKey,reason:row.reason.trim()};
}
export function planReleaseCorrection(report:CorrectionReport, releases:readonly CorrectionRelease[], snapshot:CorrectionSnapshot,
 actor:CorrectionActor, raw:unknown, occurredAt:string):ReleaseCorrectionDecision {
 const command=normalizeReleaseCorrectionCommand(raw);
 if(!command||!report||!actor||!snapshot||!Array.isArray(releases)||!instant(occurredAt)||
  ![report.id,report.schoolId,report.studentId,report.enrollmentId,report.assessmentScopeId,report.assessmentSourceVersionId].every(text)||
  !positive(report.version)||report.version===Number.MAX_SAFE_INTEGER||!positive(report.assessmentRevision)||report.id!==command.reportId)return{ok:false,code:'invalid'};
 if(actor.role!=='admin'||actor.status!=='active'||!text(actor.membershipId)||actor.schoolId!==report.schoolId)return{ok:false,code:'forbidden'};
 if(command.expectedVersion!==report.version)return{ok:false,code:'stale_version'};
 if(report.stage!=='published')return{ok:false,code:'invalid_transition'};
 if(report.version<4||!text(report.submittedBy)||!text(report.approvedBy)||report.submittedBy===report.approvedBy||report.returnReason!==null||!instant(report.publishedAt)||occurredAt<report.publishedAt)return{ok:false,code:'invalid'};
 const ids=new Set<string>(),versions=new Set<number>();
 for(const row of releases){
  if(!row||![row.id,row.schoolId,row.reportId,row.snapshotId,row.publishedBy].every(text)||row.schoolId!==report.schoolId||row.reportId!==report.id||ids.has(row.id)||versions.has(row.reportVersion)||
   !positive(row.reportVersion)||row.reportVersion<4||!positive(row.snapshotReportVersion)||row.snapshotReportVersion<3||row.reportVersion!==row.snapshotReportVersion+1||row.reportVersion>report.version||!instant(row.releasedAt)||
   row.revokedAt!==null&&(!instant(row.revokedAt)||row.revokedAt<row.releasedAt||row.revokedAt>occurredAt))return{ok:false,code:'invalid_release'};
  ids.add(row.id);versions.add(row.reportVersion);
 }
 const active=releases.filter(row=>row.revokedAt===null);
 if(active.length!==1)return{ok:false,code:'invalid_release'};
 const release=active[0]!;
 if(release.id!==command.releaseId||release.reportVersion!==report.version||release.releasedAt!==report.publishedAt)return{ok:false,code:'invalid_release'};
 if(snapshot.id!==release.snapshotId||snapshot.schoolId!==report.schoolId||snapshot.reportId!==report.id||snapshot.reportVersion!==release.snapshotReportVersion||
  snapshot.enrollmentId!==report.enrollmentId||snapshot.assessmentScopeId!==report.assessmentScopeId||snapshot.assessmentSourceVersionId!==report.assessmentSourceVersionId||snapshot.assessmentRevision!==report.assessmentRevision)return{ok:false,code:'invalid_snapshot'};
 const version=report.version+1;
 return {ok:true,report:{...report,stage:'draft',version,submittedBy:null,approvedBy:null,publishedAt:null,returnReason:null},
  release:{...release,revokedAt:occurredAt},audit:{action:'revoke',schoolId:report.schoolId,reportId:report.id,actorMembershipId:actor.membershipId,
   beforeStage:'published',afterStage:'draft',beforeVersion:report.version,afterVersion:version,reason:command.reason,releaseId:release.id,snapshotId:snapshot.id,
   snapshotReportVersion:snapshot.reportVersion,operationKey:command.operationKey,occurredAt}};
}
