import type {MaterializedAssessment} from './assessment-canonical-source';
import type {SqlClient} from './report-card-postgres-disposable-adapter';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {canonicalizeSnapshotValue} from './report-card-canonical-snapshot.ts';
export type AssessmentSubjectReviewStatus={state:'unreviewed'|'reviewed'|'finalized';reviewId:string|null;finalizationId:string|null};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
/** Content projection only. Current actor/reviewer authority is rechecked by the
 * command writer. Stored seeded rows do not prove SDK-authenticated authorship. */
export function projectAssessmentReviewStatus(materialized:MaterializedAssessment,sources:readonly Record<string,unknown>[],reviews:readonly Record<string,unknown>[],finals:readonly Record<string,unknown>[],role:'teacher'|'admin',membershipId:string):Record<string,AssessmentSubjectReviewStatus>|null{
 try{
  if(sources.length>1)return null;
  const source=sources[0];
  if(!source){if(reviews.length||finals.length)return null;return Object.fromEntries(materialized.subjects.map(s=>[s.rosterId,{state:'unreviewed',reviewId:null,finalizationId:null}]));}
  if(!uuid(source.id)||source.hash!==materialized.manifest.sha256||canonicalizeSnapshotValue(source.manifest)!==materialized.manifest.canonicalJson)return null;
  if(new Set(reviews.map(r=>r.id)).size!==reviews.length||new Set(finals.map(r=>r.id)).size!==finals.length)return null;
  if([...reviews,...finals].some(r=>!uuid(r.id)||r.sourceId!==source.id||!materialized.subjects.some(s=>s.rosterId===r.rosterId)))return null;
  const result:Record<string,AssessmentSubjectReviewStatus>={};
  for(const subject of materialized.subjects){
   const all=reviews.filter(r=>r.rosterId===subject.rosterId);
   if(all.some(r=>!uuid(r.reviewer)))return null;
   const selected=role==='teacher'?all.filter(r=>r.reviewer===membershipId):all;
   const completed=finals.filter(f=>f.rosterId===subject.rosterId);
   if(selected.length>1||completed.length>1)return null;
   const review=selected[0],final=completed[0];
   if(final){const referenced=all.find(r=>r.id===final.reviewId);if(!referenced||!uuid(final.finalizer)||final.finalizer===referenced.reviewer||final.hash!==subject.results.sha256||canonicalizeSnapshotValue(final.results)!==subject.results.canonicalJson)return null;}
   result[subject.rosterId]={state:final?'finalized':review?'reviewed':'unreviewed',reviewId:review?String(review.id):null,finalizationId:final?String(final.id):null};
  }
  return result;
 }catch{return null;}
}
/** Called inside the same locked complete-source read, never from a browser. */
export async function readAssessmentReviewStatus(tx:SqlClient,schoolId:string,scopeId:string,revision:number,materialized:MaterializedAssessment,role:'teacher'|'admin',membershipId:string){
 const sources=await tx.unsafe('SELECT id,source_manifest AS manifest,content_hash AS hash FROM public.assessment_source_versions WHERE school_id=$1::uuid AND scope_id=$2::uuid AND revision=$3 FOR SHARE',[schoolId,scopeId,revision]);
 if(sources.length!==1)return projectAssessmentReviewStatus(materialized,sources,[],[],role,membershipId);
 const params=[schoolId,scopeId,sources[0]!.id];
 const reviews=await tx.unsafe('SELECT id,source_version_id AS "sourceId",roster_id AS "rosterId",reviewer_membership_id AS reviewer FROM public.assessment_teacher_reviews WHERE school_id=$1::uuid AND scope_id=$2::uuid AND source_version_id=$3::uuid FOR SHARE',params);
 const finals=await tx.unsafe('SELECT id,source_version_id AS "sourceId",roster_id AS "rosterId",teacher_review_id AS "reviewId",finalized_by AS finalizer,results,content_hash AS hash FROM public.assessment_finalizations WHERE school_id=$1::uuid AND scope_id=$2::uuid AND source_version_id=$3::uuid FOR SHARE',params);
 return projectAssessmentReviewStatus(materialized,sources,reviews,finals,role,membershipId);
}
