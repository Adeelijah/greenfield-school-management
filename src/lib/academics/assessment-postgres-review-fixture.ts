// Generated upgraded schemas ONLY. No public adapter, SDK, env, connection or grants.
import {createHash,randomUUID} from 'node:crypto';
import type {SqlDatabase,SqlClient} from './report-card-postgres-disposable-adapter';
import type {AssessmentReviewOutcome} from './assessment-review-command';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {parseAssessmentReviewCommand,decodeAssessmentReviewSuccess} from './assessment-review-command.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {fixtureReportSqlScope} from './report-card-sql-scope.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {lockReportActorInScope} from './report-card-postgres-command-context.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {loadCompleteAssessmentInScope} from './assessment-postgres-canonical-reader.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {canonicalizeSnapshotValue} from './report-card-canonical-snapshot.ts';
class ReviewAbort extends Error{readonly code:Extract<AssessmentReviewOutcome,{ok:false}>['code'];constructor(code:Extract<AssessmentReviewOutcome,{ok:false}>['code']){super('Assessment review rejected');this.code=code;}}
const abort=(code:ReviewAbort['code']):never=>{throw new ReviewAbort(code);};
/** EXCLUSIVE discovery gate precedes identity, scope, receipt and candidate reads.
 * Every row belongs to this outer transaction; failures must escape db.begin.
 * Fixture owner transport is not evidence of a deployable restricted service role.
 */
export async function executeFixtureAssessmentReview(db:SqlDatabase,schema:string,verifiedIdentity:()=>Promise<{authUserId:string}|null>,raw:unknown):Promise<AssessmentReviewOutcome>{
 const scope=fixtureReportSqlScope(schema),cmd=parseAssessmentReviewCommand(raw);if(!scope||!cmd)return{ok:false,code:'invalid'};
 const table=(name:string)=>'"'+schema+'"."'+name+'"';
 const fingerprint=createHash('sha256').update(canonicalizeSnapshotValue(cmd)).digest('hex');
 try{return await db.begin(async(tx:SqlClient)=>{
  if((await tx.unsafe('SELECT id FROM '+table('fixture_source_write_gate')+' WHERE id=1 FOR UPDATE')).length!==1)return abort('unavailable');
  const actor=await lockReportActorInScope(tx,scope,verifiedIdentity);if(!actor.ok)return abort('forbidden');
  const schoolId=actor.identity.school.id,member=actor.identity.membership;
  if(member.role!==(cmd.action==='review_subject'?'teacher':'admin'))return abort('forbidden');
  const scopes=await tx.unsafe('SELECT sc.id AS id,sc.revision AS revision FROM '+table('assessment_scopes')+' sc JOIN '+table('classes')+' c ON c.school_id=sc.school_id AND c.id=sc.class_id JOIN '+table('academic_levels')+' l ON l.school_id=c.school_id AND l.id=c.level_id JOIN '+table('academic_sections')+' sec ON sec.school_id=c.school_id AND sec.id=c.section_id AND sec.level_id=l.id JOIN '+table('academic_sessions')+' sess ON sess.school_id=sc.school_id AND sess.id=sc.session_id JOIN '+table('terms')+' term ON term.school_id=sc.school_id AND term.id=sc.term_id AND term.session_id=sess.id WHERE sc.school_id=$1::uuid AND sc.class_id=$2::uuid AND sc.session_id=$3::uuid AND sc.term_id=$4::uuid AND l.is_active=true AND sec.is_active=true AND ((l.stage=\'primary\' AND l.primary_year BETWEEN 1 AND $5::integer) OR (l.stage IN (\'creche\',\'nursery\') AND l.primary_year IS NULL)) AND sess.starts_on<=sess.ends_on AND term.starts_on<=term.ends_on AND term.starts_on>=sess.starts_on AND term.ends_on<=sess.ends_on FOR SHARE OF sc,c,l,sec,sess,term',[schoolId,cmd.classId,cmd.sessionId,cmd.termId,actor.identity.school.finalPrimaryYear]);
  if(scopes.length!==1)return abort('forbidden');const selected=scopes[0]!;
  const rosters=await tx.unsafe('SELECT id FROM '+table('assessment_subject_roster')+' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND id=$3::uuid AND is_active=true FOR SHARE',[schoolId,selected.id,cmd.rosterId]);
  if(rosters.length!==1)return abort('forbidden');
  const permission=async(membershipId:string)=>{
   const assignments=await tx.unsafe('SELECT id FROM '+table('teacher_class_assignments')+' WHERE school_id=$1::uuid AND teacher_membership_id=$2::uuid AND class_id=$3::uuid AND session_id=$4::uuid AND ended_at IS NULL FOR SHARE',[schoolId,membershipId,cmd.classId,cmd.sessionId]);
   if(assignments.length!==1)return false;
   const links=await tx.unsafe('SELECT id FROM '+table('assessment_teacher_subjects')+' WHERE school_id=$1::uuid AND roster_id=$2::uuid AND class_assignment_id=$3::uuid AND is_active=true FOR SHARE',[schoolId,cmd.rosterId,assignments[0]!.id]);return links.length===1;
  };
  if(member.role==='teacher'&&!await permission(member.id))return abort('forbidden');
  const receipts=await tx.unsafe('SELECT scope_id AS "scopeId",fingerprint,resulting_revision AS revision,outcome FROM '+table('assessment_operation_receipts')+' WHERE school_id=$1::uuid AND actor_membership_id=$2::uuid AND operation_key=$3 FOR SHARE',[schoolId,member.id,cmd.operationKey]);
  if(receipts.length>1)return abort('unavailable');
  if(receipts.length){const receipt=receipts[0]!,stored=receipt.outcome as {command?:unknown;result?:unknown}|null;
   if(receipt.scopeId!==selected.id||receipt.fingerprint!==fingerprint||!stored||canonicalizeSnapshotValue(stored.command)!==canonicalizeSnapshotValue(cmd))return abort('conflict');
   const result=decodeAssessmentReviewSuccess(stored.result);if(!result||result.kind!=='applied'||result.action!==cmd.action||result.revision!==cmd.expectedScopeRevision||receipt.revision!==result.revision||cmd.action==='finalize_subject'&&result.reviewId!==cmd.teacherReviewId)return abort('unavailable');
   return{...result,kind:'replay'} as const;
  }
  if(selected.revision!==cmd.expectedScopeRevision)return abort('conflict');
  const candidate=await loadCompleteAssessmentInScope(tx,scope,{classId:cmd.classId,sessionId:cmd.sessionId,termId:cmd.termId},async()=>({authUserId:actor.authUserId}));
  if(!candidate.ok)return abort(candidate.code==='forbidden'?'forbidden':'incomplete_source');
  if(candidate.identity.membership.id!==member.id||candidate.input.scope.id!==selected.id||candidate.input.scope.revision!==cmd.expectedScopeRevision)return abort('conflict');
  const subject=candidate.materialized.subjects.find(s=>s.rosterId===cmd.rosterId);if(!subject)return abort('incomplete_source');
  const sources=await tx.unsafe('SELECT id,source_manifest AS manifest,content_hash AS hash FROM '+table('assessment_source_versions')+' WHERE school_id=$1::uuid AND scope_id=$2::uuid AND revision=$3 FOR SHARE',[schoolId,selected.id,cmd.expectedScopeRevision]);
  if(sources.length>1)return abort('source_mismatch');
  if(sources.length&&(sources[0]!.hash!==candidate.materialized.manifest.sha256||canonicalizeSnapshotValue(sources[0]!.manifest)!==candidate.materialized.manifest.canonicalJson))return abort('source_mismatch');
  let sourceId=sources[0]?.id as string|undefined;
  if(!sourceId){if(cmd.action==='finalize_subject')return abort('review_required');sourceId=randomUUID();await tx.unsafe('INSERT INTO '+table('assessment_source_versions')+' (id,school_id,scope_id,revision,source_manifest,content_hash) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::text::jsonb,$6)',[sourceId,schoolId,selected.id,cmd.expectedScopeRevision,candidate.materialized.manifest.canonicalJson,candidate.materialized.manifest.sha256]);}
  let reviewId:string,finalizationId:string|null=null;
  if(cmd.action==='review_subject'){
   const prior=await tx.unsafe('SELECT id FROM '+table('assessment_teacher_reviews')+' WHERE school_id=$1::uuid AND roster_id=$2::uuid AND source_version_id=$3::uuid AND reviewer_membership_id=$4::uuid FOR SHARE',[schoolId,cmd.rosterId,sourceId,member.id]);if(prior.length)return abort('conflict');
   reviewId=randomUUID();await tx.unsafe('INSERT INTO '+table('assessment_teacher_reviews')+' (id,school_id,scope_id,roster_id,source_version_id,reviewer_membership_id) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid)',[reviewId,schoolId,selected.id,cmd.rosterId,sourceId,member.id]);
  }else{
   const reviews=await tx.unsafe('SELECT reviewer_membership_id AS reviewer FROM '+table('assessment_teacher_reviews')+' WHERE school_id=$1::uuid AND id=$2::uuid AND scope_id=$3::uuid AND roster_id=$4::uuid AND source_version_id=$5::uuid FOR SHARE',[schoolId,cmd.teacherReviewId,selected.id,cmd.rosterId,sourceId]);
   if(reviews.length!==1)return abort('review_required');const reviewer=reviews[0]!.reviewer;
   const members=await tx.unsafe('SELECT m.id,m.user_id AS "userId",u.auth_user_id AS "authUserId" FROM '+table('memberships')+' m JOIN '+table('school_users')+' u ON u.id=m.user_id WHERE m.school_id=$1::uuid AND m.id=$2::uuid AND m.status=\'active\' AND m.role=\'teacher\' FOR SHARE OF m,u',[schoolId,reviewer]);
   if(members.length!==1||members[0]!.authUserId===actor.authUserId||reviewer===member.id||!await permission(String(reviewer)))return abort('forbidden');
   const active=await tx.unsafe('SELECT id FROM '+table('memberships')+' WHERE user_id=$1::uuid AND status=\'active\' ORDER BY id FOR SHARE',[members[0]!.userId]);if(active.length!==1||active[0]!.id!==reviewer)return abort('forbidden');
   const prior=await tx.unsafe('SELECT id FROM '+table('assessment_finalizations')+' WHERE school_id=$1::uuid AND source_version_id=$2::uuid AND roster_id=$3::uuid FOR SHARE',[schoolId,sourceId,cmd.rosterId]);if(prior.length)return abort('conflict');
   reviewId=cmd.teacherReviewId;finalizationId=randomUUID();await tx.unsafe('INSERT INTO '+table('assessment_finalizations')+' (id,school_id,scope_id,roster_id,source_version_id,teacher_review_id,finalized_by,results,content_hash) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::text::jsonb,$9)',[finalizationId,schoolId,selected.id,cmd.rosterId,sourceId,reviewId,member.id,subject.results.canonicalJson,subject.results.sha256]);
  }
  const result={ok:true,kind:'applied',action:cmd.action,revision:cmd.expectedScopeRevision,sourceVersionId:sourceId,reviewId,finalizationId} as const;
  await tx.unsafe('INSERT INTO '+table('assessment_audit')+' (id,school_id,scope_id,actor_membership_id,action,before_revision,after_revision) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$6)',[randomUUID(),schoolId,selected.id,member.id,cmd.action,cmd.expectedScopeRevision]);
  await tx.unsafe('INSERT INTO '+table('assessment_operation_receipts')+' (id,school_id,scope_id,actor_membership_id,operation_key,fingerprint,resulting_revision,outcome) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::text::jsonb)',[randomUUID(),schoolId,selected.id,member.id,cmd.operationKey,fingerprint,cmd.expectedScopeRevision,JSON.stringify({command:cmd,result})]);
  return result;
 });}catch(e){return{ok:false,code:e instanceof ReviewAbort?e.code:'unavailable'};}
}
