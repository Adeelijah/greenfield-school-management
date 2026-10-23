import type { ReportSqlScope } from './report-card-sql-scope';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { fixtureReportSqlScope, isReportSqlScope } from './report-card-sql-scope.ts';
// Shared persisted workflow; explicit issued scope, no connection or route.
import { createHash, randomUUID } from 'node:crypto';
import type { SqlDatabase } from './report-card-postgres-disposable-adapter';
// @ts-expect-error Node type stripping requires explicit source extension.
import { lockReportActorInScope } from './report-card-postgres-command-context.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { fixtureAssessmentDecoders as d } from './assessment-postgres-fixture-source-reader.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { readVerifiedCanonicalAssessmentInScope } from './assessment-postgres-canonical-reader.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
type Create = {action:'create';operationKey:string;studentId:string;enrollmentId:string;classId:string;sessionId:string;termId:string};
type Transition = {action:'submit'|'return'|'reopen';operationKey:string;reportId:string;expectedVersion:number;reason?:string};
export type PersistedReportWorkflowCommand = Create|Transition;
export type PersistedReportWorkflowOutcome = {ok:true;kind:'applied'|'replay';action:Create['action']|Transition['action'];reportId:string;version:number;stage:'draft'|'submitted'|'returned'}|{ok:false;code:string};
class WorkflowAbort extends Error {readonly code:string;constructor(code:string){super(code);this.code=code;}}
const abort = (code:string):never => {throw new WorkflowAbort(code);};
const text = (v:unknown):v is string => typeof v==='string' && !!v.trim();
/** All writes and durable receipts belong to this outer transaction. No source
 * mutation/lock upgrade. Creation starts from a complete finalized source;
 * submission refreshes its pin. Return/reopen can recover a stale report without
 * weakening source requirements for the subsequent submission/approval.
 */
export async function executeReportWorkflowInScope(db:SqlDatabase,sqlScope:ReportSqlScope,raw:PersistedReportWorkflowCommand,verifiedIdentity:()=>Promise<{authUserId:string}|null>):Promise<PersistedReportWorkflowOutcome>{
 if(!isReportSqlScope(sqlScope)||!raw||!['create','submit','return','reopen'].includes(raw.action)||!text(raw.operationKey)||raw.operationKey.length>128)return{ok:false,code:'invalid'};
 let command:PersistedReportWorkflowCommand;
 if(raw.action==='create'){
  if(![raw.studentId,raw.enrollmentId,raw.classId,raw.sessionId,raw.termId].every(text))return{ok:false,code:'invalid'};
  command={action:'create',operationKey:raw.operationKey,studentId:raw.studentId,enrollmentId:raw.enrollmentId,classId:raw.classId,sessionId:raw.sessionId,termId:raw.termId};
 }else{
  if(!text(raw.reportId)||!Number.isSafeInteger(raw.expectedVersion)||raw.expectedVersion<1||raw.action==='return'&&(!text(raw.reason)||raw.reason.length>2000))return{ok:false,code:'invalid'};
  command={action:raw.action,operationKey:raw.operationKey,reportId:raw.reportId,expectedVersion:raw.expectedVersion,...raw.action==='return'?{reason:raw.reason!.trim()}: {}};
 }
 const table=(name:string)=>'"'+sqlScope.schema+'"."'+name+'"';
 try{return await db.begin(async tx=>{
  const actor=await lockReportActorInScope(tx,sqlScope,verifiedIdentity);if(!actor.ok)return abort(actor.code);
  const {identity}=actor,schoolId=identity.school.id,actorId=identity.membership.id,role=identity.membership.role;
  if(command.action==='submit'?role!=='teacher':command.action==='return'||command.action==='reopen'?role!=='admin':!['teacher','admin'].includes(role))return abort('forbidden');
  const {operationKey,...intent}=command;
  const fingerprint=createHash('sha256').update(canonicalizeSnapshotValue({format:'greenfield.report-card.workflow-command.v1',schoolId,actorId,intent})).digest('hex');
  const receipts=await tx.unsafe('SELECT report_id AS "reportId",fingerprint,resulting_version AS "resultingVersion",outcome FROM '+table('report_card_operation_receipts')+' WHERE school_id=$1::uuid AND actor_membership_id=$2::uuid AND operation_key=$3::text FOR SHARE',[schoolId,actorId,operationKey]);
  if(receipts.length>1)return abort('invalid_receipt');
  if(receipts.length&&receipts[0]!.fingerprint!==fingerprint)return abort('idempotency_conflict');
  const receipt=receipts[0];
  // Actor serialization protects operation keys; the separate creation identity
  // lock serializes different actors creating the same logical report.
  if(command.action==='create'&&!receipt)await tx.unsafe('SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1::text,0))',[canonicalizeSnapshotValue({schoolId,studentId:command.studentId,classId:command.classId,sessionId:command.sessionId,termId:command.termId})]);
  const requestedId=command.action==='create'?(receipt?d.textField(receipt.reportId):null):command.reportId;
  const rows=requestedId===null?[]:await tx.unsafe('SELECT id,school_id AS "schoolId",enrollment_id AS "enrollmentId",student_id AS "studentId",class_id AS "classId",session_id AS "sessionId",term_id AS "termId",assessment_scope_id AS "assessmentScopeId",assessment_source_version_id AS "assessmentSourceVersionId",assessment_revision AS "assessmentRevision",stage,version,submitted_by AS "submittedBy",approved_by AS "approvedBy",return_reason AS "returnReason" FROM '+table('report_cards')+' WHERE school_id=$1::uuid AND id=$2::uuid FOR UPDATE',[schoolId,requestedId]);
  if(requestedId!==null&&rows.length!==1)return abort('not_found');
  const row=rows[0];
  const report=row?{id:d.textField(row.id),schoolId:d.textField(row.schoolId),enrollmentId:d.textField(row.enrollmentId),studentId:d.textField(row.studentId),classId:d.textField(row.classId),sessionId:d.textField(row.sessionId),termId:d.textField(row.termId),assessmentScopeId:d.textField(row.assessmentScopeId),assessmentSourceVersionId:d.textField(row.assessmentSourceVersionId),assessmentRevision:d.integerField(row.assessmentRevision),stage:d.enumField(row.stage,['draft','submitted','returned','approved','published'] as const),version:d.integerField(row.version)}:null;
  if(report&&(report.id!==requestedId||report.schoolId!==schoolId))return abort('not_found');
  const selector=command.action==='create'?command:report;
  if(!selector)return abort('not_found');
  if(role==='teacher'){
   const assignments=await tx.unsafe('SELECT id FROM '+table('teacher_class_assignments')+' WHERE school_id=$1::uuid AND teacher_membership_id=$2::uuid AND class_id=$3::uuid AND session_id=$4::uuid AND ended_at IS NULL FOR SHARE',[schoolId,actorId,selector.classId,selector.sessionId]);
   if(assignments.length!==1)return abort('forbidden');
  }
  const stage=command.action==='submit'?'submitted' as const:command.action==='return'?'returned' as const:'draft' as const;
  if(receipt){
   if(!report||receipt.reportId!==report.id)return abort('idempotency_conflict');
   if(command.action==='create'&&(report.studentId!==command.studentId||report.enrollmentId!==command.enrollmentId||report.classId!==command.classId||report.sessionId!==command.sessionId||report.termId!==command.termId))return abort('invalid_receipt');
   const saved=d.decoded<Record<string,unknown>>(receipt.outcome),version=d.integerField(receipt.resultingVersion);
   if(saved.ok!==true||saved.kind!=='applied'||saved.reportId!==report.id||saved.action!==command.action||saved.stage!==stage||saved.version!==version||version<1||version>report.version)return abort('invalid_receipt');
   return{ok:true,kind:'replay',action:command.action,reportId:report.id,version,stage} as const;
  }
  if(command.action!=='create'){
   if(!report||report.version!==command.expectedVersion)return abort('stale_version');
   const allowed=command.action==='submit'?['draft','returned']:command.action==='return'?['submitted']:['approved'];
   if(!allowed.includes(report.stage))return abort('invalid_transition');
   const releases=await tx.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE school_id=$1::uuid AND report_id=$2::uuid AND revoked_at IS NULL FOR SHARE',[schoolId,report.id]);
   if(releases.length)return abort('active_release');
   if(command.action==='reopen'){
    const pins=await tx.unsafe('SELECT id FROM '+table('report_card_snapshots')+' WHERE school_id=$1::uuid AND report_id=$2::uuid AND report_version=$3 FOR SHARE',[schoolId,report.id,report.version]);
    if(pins.length!==1)return abort('snapshot_mismatch');
   }
  }
  let sourceId=report?.assessmentSourceVersionId??'',scopeId=report?.assessmentScopeId??'',revision=report?.assessmentRevision??0;
  if(command.action==='create'||command.action==='submit'){
   const loaded=await readVerifiedCanonicalAssessmentInScope(tx,sqlScope,{classId:selector.classId,sessionId:selector.sessionId,termId:selector.termId},async()=>({authUserId:actor.authUserId}));
   if(!loaded.ok)return abort(loaded.code);
   if(loaded.identity.membership.id!==actorId||loaded.input.scope.schoolId!==schoolId||loaded.input.enrollments.filter(e=>e.id===selector.enrollmentId&&e.studentId===selector.studentId).length!==1||report&&loaded.input.scope.id!==report.assessmentScopeId)return abort('invalid_reference');
   sourceId=loaded.sourceVersionId;scopeId=loaded.input.scope.id;revision=loaded.input.scope.revision;
  }
  const now=new Date().toISOString(),version=command.action==='create'?1:report!.version+1;
  const reportId=command.action==='create'?randomUUID():report!.id;
  if(command.action==='create'){
   const existing=await tx.unsafe('SELECT id FROM '+table('report_cards')+' WHERE school_id=$1::uuid AND student_id=$2::uuid AND class_id=$3::uuid AND session_id=$4::uuid AND term_id=$5::uuid FOR UPDATE',[schoolId,command.studentId,command.classId,command.sessionId,command.termId]);
   if(existing.length)return abort('duplicate_report');
   const created=await tx.unsafe('INSERT INTO '+table('report_cards')+' (id,school_id,enrollment_id,student_id,class_id,session_id,term_id,assessment_scope_id,assessment_source_version_id,assessment_revision) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::uuid,$10) RETURNING id',[reportId,schoolId,command.enrollmentId,command.studentId,command.classId,command.sessionId,command.termId,scopeId,sourceId,revision]);
   if(created.length!==1||created[0]!.id!==reportId)return abort('transaction_failed');
  }else{
   const updated=command.action==='submit'
    ?await tx.unsafe('UPDATE '+table('report_cards')+" SET stage='submitted',version=$3,submitted_by=$4::uuid,approved_by=NULL,published_at=NULL,return_reason=NULL,assessment_source_version_id=$5::uuid,assessment_revision=$6 WHERE school_id=$1::uuid AND id=$2::uuid AND version=$7 AND stage IN ('draft','returned') RETURNING id",[schoolId,reportId,version,actorId,sourceId,revision,report!.version])
    :command.action==='return'
     ?await tx.unsafe('UPDATE '+table('report_cards')+" SET stage='returned',version=$3,approved_by=NULL,published_at=NULL,return_reason=$4::text WHERE school_id=$1::uuid AND id=$2::uuid AND version=$5 AND stage='submitted' RETURNING id",[schoolId,reportId,version,command.reason!,report!.version])
     :await tx.unsafe('UPDATE '+table('report_cards')+" SET stage='draft',version=$3,submitted_by=NULL,approved_by=NULL,published_at=NULL,return_reason=NULL WHERE school_id=$1::uuid AND id=$2::uuid AND version=$4 AND stage='approved' RETURNING id",[schoolId,reportId,version,report!.version]);
   if(updated.length!==1)return abort('stale_version');
  }
  await tx.unsafe('INSERT INTO '+table('report_card_audit')+' (id,school_id,report_id,actor_membership_id,action,reason,before_stage,after_stage,before_version,after_version,occurred_at) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text::'+table('report_card_action')+',$6::text,$7::text::'+table('report_card_stage')+',$8::text::'+table('report_card_stage')+',$9,$10,$11::timestamptz)',[randomUUID(),schoolId,reportId,actorId,command.action,command.action==='return'?command.reason!:null,report?.stage??'draft',stage,report?.version??0,version,now]);
  const outcome={ok:true,kind:'applied',action:command.action,reportId,version,stage} as const;
  await tx.unsafe('INSERT INTO '+table('report_card_operation_receipts')+' (school_id,report_id,actor_membership_id,operation_key,fingerprint,resulting_version,outcome) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6,$7::text::jsonb)',[schoolId,reportId,actorId,operationKey,fingerprint,version,JSON.stringify(outcome)]);
  return outcome;
 });}catch(error){return{ok:false,code:error instanceof WorkflowAbort?error.code:'transaction_failed'};}
}


/** Disposable compatibility entry: public remains invalid. */
export async function executeFixtureReportWorkflow(db: SqlDatabase, schema: string, raw: PersistedReportWorkflowCommand, verifiedIdentity: () => Promise<{authUserId:string}|null>): Promise<PersistedReportWorkflowOutcome> { const scope = fixtureReportSqlScope(schema); return scope ? executeReportWorkflowInScope(db, scope, raw, verifiedIdentity) : {ok:false,code:'invalid'}; }
