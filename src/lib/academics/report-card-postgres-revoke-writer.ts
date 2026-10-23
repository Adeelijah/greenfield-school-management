import type { ReportSqlScope } from './report-card-sql-scope';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { fixtureReportSqlScope, isReportSqlScope } from './report-card-sql-scope.ts';
// Shared withdrawal adapter. No driver, connection, app route or environment.
import { createHash, randomUUID } from 'node:crypto';
import type { SqlDatabase } from './report-card-postgres-disposable-adapter';
import type { CorrectionReport, CorrectionRelease, CorrectionSnapshot } from './report-card-release-correction';
// @ts-expect-error Explicit TS extension for Node offline runner.
import { normalizeReleaseCorrectionCommand, planReleaseCorrection } from './report-card-release-correction.ts';
// @ts-expect-error Explicit TS extension for Node offline runner.
import { lockReportActorInScope } from './report-card-postgres-command-context.ts';
// @ts-expect-error Explicit TS extension for Node offline runner.
import { fixtureAssessmentDecoders as d } from './assessment-postgres-fixture-source-reader.ts';
// @ts-expect-error Explicit TS extension for Node offline runner.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
export type RevokeReportOutcome={ok:true;kind:'applied'|'replay';action:'revoke';reportId:string;releaseId:string;snapshotId:string;snapshotReportVersion:number;version:number;stage:'draft';revokedAt:string}|{ok:false;code:string};
class RevokeAbort extends Error {readonly code:string;constructor(code:string){super(code);this.code=code;}}
const abort=(code:string):never=>{throw new RevokeAbort(code);};
const receiptObject=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const timestamp=(value:unknown):string|null=>{
 if(value===null)return null;
 if(value instanceof Date && Number.isFinite(value.getTime()))return value.toISOString();
 if(typeof value==='string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value)return value;
 throw Error('Invalid selected timestamp');
};
/** Source gate -> exclusive actor anchor -> report -> releases -> snapshot.
 * Deliberately does not require fresh academic data to withdraw a bad release.
 * Post-write errors must escape begin so all writes roll back before mapping.
 */
export async function executeReportRevocationInScope(db:SqlDatabase,sqlScope:ReportSqlScope,raw:unknown,verifiedIdentity:()=>Promise<{authUserId:string}|null>):Promise<RevokeReportOutcome>{
 const command=normalizeReleaseCorrectionCommand(raw);
 if(!isReportSqlScope(sqlScope)||!command)return{ok:false,code:'invalid'};
 const table=(name:string)=>'"'+sqlScope.schema+'"."'+name+'"';
 try{return await db.begin(async tx=>{
  const actor=await lockReportActorInScope(tx,sqlScope,verifiedIdentity);if(!actor.ok)return abort(actor.code);
  if(actor.identity.membership.role!=='admin')return abort('forbidden');
  const schoolId=actor.identity.school.id,actorId=actor.identity.membership.id;
  const rows=await tx.unsafe('SELECT id,school_id AS "schoolId",student_id AS "studentId",enrollment_id AS "enrollmentId",stage,version,assessment_scope_id AS "assessmentScopeId",assessment_source_version_id AS "assessmentSourceVersionId",assessment_revision AS "assessmentRevision",submitted_by AS "submittedBy",approved_by AS "approvedBy",published_at AS "publishedAt",return_reason AS "returnReason" FROM '+table('report_cards')+' WHERE school_id=$1::uuid AND id=$2::uuid FOR UPDATE',[schoolId,command.reportId]);
  if(rows.length!==1)return abort('not_found');const row=rows[0]!;
  const report:CorrectionReport={id:d.textField(row.id),schoolId:d.textField(row.schoolId),studentId:d.textField(row.studentId),enrollmentId:d.textField(row.enrollmentId),stage:d.enumField(row.stage,['draft','submitted','returned','approved','published'] as const),version:d.integerField(row.version),assessmentScopeId:d.textField(row.assessmentScopeId),assessmentSourceVersionId:d.textField(row.assessmentSourceVersionId),assessmentRevision:d.integerField(row.assessmentRevision),submittedBy:d.nullableText(row.submittedBy),approvedBy:d.nullableText(row.approvedBy),publishedAt:timestamp(row.publishedAt),returnReason:d.nullableText(row.returnReason)};
  if(report.schoolId!==schoolId||report.id!==command.reportId)return abort('not_found');
  const fingerprint=createHash('sha256').update(canonicalizeSnapshotValue({format:'greenfield.report-card.revoke-command.v1',schoolId,actorId,command})).digest('hex');
  const receipts=await tx.unsafe('SELECT report_id AS "reportId",fingerprint,resulting_version AS "resultingVersion",outcome FROM '+table('report_card_operation_receipts')+' WHERE school_id=$1::uuid AND actor_membership_id=$2::uuid AND operation_key=$3::text FOR SHARE',[schoolId,actorId,command.operationKey]);
  if(receipts.length>1)return abort('invalid_receipt');
  const receipt=receipts[0];
  if(receipt&&(receipt.reportId!==report.id||receipt.fingerprint!==fingerprint))return abort('idempotency_conflict');
  const releaseRows=await tx.unsafe('SELECT id,school_id AS "schoolId",report_id AS "reportId",report_version AS "reportVersion",snapshot_id AS "snapshotId",snapshot_report_version AS "snapshotReportVersion",published_by AS "publishedBy",released_at AS "releasedAt",revoked_at AS "revokedAt" FROM '+table('report_card_releases')+' WHERE school_id=$1::uuid AND report_id=$2::uuid ORDER BY report_version,id FOR UPDATE',[schoolId,report.id]);
  const releases:CorrectionRelease[]=releaseRows.map(r=>({id:d.textField(r.id),schoolId:d.textField(r.schoolId),reportId:d.textField(r.reportId),reportVersion:d.integerField(r.reportVersion),snapshotId:d.textField(r.snapshotId),snapshotReportVersion:d.integerField(r.snapshotReportVersion),publishedBy:d.textField(r.publishedBy),releasedAt:timestamp(r.releasedAt)??abort('invalid_release'),revokedAt:timestamp(r.revokedAt)}));
  const matches=releases.filter(r=>r.id===command.releaseId&&r.schoolId===schoolId&&r.reportId===report.id);
  if(matches.length!==1)return abort('invalid_release');const release=matches[0]!;
  const pins=await tx.unsafe('SELECT id,school_id AS "schoolId",report_id AS "reportId",report_version AS "reportVersion",enrollment_id AS "enrollmentId",assessment_scope_id AS "assessmentScopeId",assessment_source_version_id AS "assessmentSourceVersionId",assessment_revision AS "assessmentRevision" FROM '+table('report_card_snapshots')+' WHERE school_id=$1::uuid AND report_id=$2::uuid AND id=$3::uuid AND report_version=$4 FOR SHARE',[schoolId,report.id,release.snapshotId,release.snapshotReportVersion]);
  if(pins.length!==1)return abort('invalid_snapshot');const pin=pins[0]!;
  const snapshot:CorrectionSnapshot={id:d.textField(pin.id),schoolId:d.textField(pin.schoolId),reportId:d.textField(pin.reportId),reportVersion:d.integerField(pin.reportVersion),enrollmentId:d.textField(pin.enrollmentId),assessmentScopeId:d.textField(pin.assessmentScopeId),assessmentSourceVersionId:d.textField(pin.assessmentSourceVersionId),assessmentRevision:d.integerField(pin.assessmentRevision)};
  if(receipt){
   const outcome=receipt.outcome,version=d.integerField(receipt.resultingVersion);
   if(!receiptObject(outcome))return abort('invalid_receipt');
   if(outcome.ok!==true||outcome.kind!=='applied'||outcome.action!=='revoke'||outcome.stage!=='draft'||outcome.reportId!==report.id||outcome.releaseId!==release.id||outcome.snapshotId!==snapshot.id||outcome.snapshotReportVersion!==snapshot.reportVersion||outcome.version!==version||version!==command.expectedVersion+1||version>report.version||release.reportVersion!==command.expectedVersion||release.snapshotReportVersion!==command.expectedVersion-1||!release.revokedAt||outcome.revokedAt!==release.revokedAt)return abort('invalid_receipt');
   const audit=await tx.unsafe('SELECT id FROM '+table('report_card_audit')+" WHERE school_id=$1::uuid AND report_id=$2::uuid AND release_id=$3::uuid AND actor_membership_id=$4::uuid AND action='revoke' AND before_version=$5 AND after_version=$6 AND snapshot_id=$7::uuid AND snapshot_report_version=$8 AND reason=$9::text AND occurred_at=$10::timestamptz FOR SHARE",[schoolId,report.id,release.id,actorId,command.expectedVersion,version,snapshot.id,snapshot.reportVersion,command.reason,release.revokedAt]);
   if(audit.length!==1)return abort('invalid_receipt');
   return{ok:true,kind:'replay',action:'revoke',reportId:report.id,releaseId:release.id,snapshotId:snapshot.id,snapshotReportVersion:snapshot.reportVersion,version,stage:'draft',revokedAt:release.revokedAt} as const;
  }
  const now=new Date().toISOString();
  const planned=planReleaseCorrection(report,releases,snapshot,{membershipId:actorId,schoolId,role:actor.identity.membership.role,status:actor.identity.membership.status},command,now);
  if(!planned.ok)return abort(planned.code);
  const changedRelease=await tx.unsafe('UPDATE '+table('report_card_releases')+' SET revoked_at=$4::timestamptz WHERE school_id=$1::uuid AND report_id=$2::uuid AND id=$3::uuid AND revoked_at IS NULL AND report_version=$5 AND snapshot_id=$6::uuid AND snapshot_report_version=$7 RETURNING id',[schoolId,report.id,release.id,now,report.version,snapshot.id,snapshot.reportVersion]);
  if(changedRelease.length!==1)return abort('stale_release');
  const changedReport=await tx.unsafe('UPDATE '+table('report_cards')+" SET stage='draft',version=$3,submitted_by=NULL,approved_by=NULL,published_at=NULL,return_reason=NULL WHERE school_id=$1::uuid AND id=$2::uuid AND version=$4 AND stage='published' RETURNING id",[schoolId,report.id,planned.report.version,report.version]);
  if(changedReport.length!==1)return abort('stale_version');
  await tx.unsafe('INSERT INTO '+table('report_card_audit')+' (id,school_id,report_id,actor_membership_id,action,before_stage,after_stage,before_version,after_version,snapshot_id,snapshot_report_version,release_id,reason,occurred_at) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::'+table('report_card_action')+',$6::'+table('report_card_stage')+',$7::'+table('report_card_stage')+',$8,$9,$10::uuid,$11,$12::uuid,$13::text,$14::timestamptz)',[randomUUID(),schoolId,report.id,actorId,'revoke','published','draft',report.version,planned.report.version,snapshot.id,snapshot.reportVersion,release.id,command.reason,now]);
  const outcome={ok:true,kind:'applied',action:'revoke',reportId:report.id,releaseId:release.id,snapshotId:snapshot.id,snapshotReportVersion:snapshot.reportVersion,version:planned.report.version,stage:'draft',revokedAt:now} as const;
  await tx.unsafe('INSERT INTO '+table('report_card_operation_receipts')+' (school_id,report_id,actor_membership_id,operation_key,fingerprint,resulting_version,outcome) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6,$7::text::jsonb)',[schoolId,report.id,actorId,command.operationKey,fingerprint,outcome.version,JSON.stringify(outcome)]);
  return outcome;
 });}catch(error){return{ok:false,code:error instanceof RevokeAbort?error.code:'transaction_failed'};}
}


/** Disposable compatibility entry: public remains invalid. */
export async function executeFixtureReportRevocation(db: SqlDatabase, schema: string, raw: unknown, verifiedIdentity: () => Promise<{authUserId:string}|null>): Promise<RevokeReportOutcome> { const scope = fixtureReportSqlScope(schema); return scope ? executeReportRevocationInScope(db, scope, raw, verifiedIdentity) : {ok:false,code:'invalid'}; }
