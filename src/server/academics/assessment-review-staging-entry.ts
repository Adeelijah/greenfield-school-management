import 'server-only';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getStagingAssessmentReviewDatabase} from './assessment-review-staging-connection';
import {createAssessmentReviewRuntime} from '@/lib/academics/assessment-review-staging-runtime';
import {assessmentReviewWritesEnabled} from '@/lib/academics/assessment-review-staging-policy';
import {parseAssessmentReviewCommand} from '@/lib/academics/assessment-review-command';
import {executeAssessmentReviewInScope} from '@/lib/academics/assessment-postgres-review-fixture';
import {managedAssessmentReviewSqlScope} from '@/lib/academics/report-card-sql-scope';
import {stagingClassChoices,stagingSelector} from '@/lib/academics/report-card-staging-ui';
import type {SqlDatabase} from '@/lib/academics/report-card-postgres-disposable-adapter';
import type {AssessmentReviewOutcome} from '@/lib/academics/assessment-review-command';
/** SDK verification supplies only the auth principal. The complete private helper
 * and current actor/reviewer assignment checks run inside the writer transaction,
 * before historical receipt discovery. No presentation role is trusted. */
export function createVerifiedAssessmentReviewEntry(db:Pick<SqlDatabase,'begin'>){
 const runtime=createAssessmentReviewRuntime(db),scope=managedAssessmentReviewSqlScope();
 return{async run(raw:unknown):Promise<AssessmentReviewOutcome>{
  const command=parseAssessmentReviewCommand(raw);if(!command)return{ok:false,code:'invalid'};
  const choice=stagingClassChoices.find(c=>c.classId===command.classId),selected=stagingSelector(choice?.key);
  if(!selected||selected.sessionId!==command.sessionId||selected.termId!==command.termId)return{ok:false,code:'invalid'};
  let auth:string;
  try{const client=await createSupabaseServerClient();const result=await client.auth.getUser();const id=result.data.user?.id;if(result.error||typeof id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))return{ok:false,code:'forbidden'};auth=id;}catch{return{ok:false,code:'forbidden'};}
  return executeAssessmentReviewInScope(runtime,scope,async()=>({authUserId:auth}),command);
 }};
}
export async function runStagingAssessmentReview(raw:unknown):Promise<AssessmentReviewOutcome>{
 if(!assessmentReviewWritesEnabled(process.env))return{ok:false,code:'forbidden'};
 try{return await createVerifiedAssessmentReviewEntry(getStagingAssessmentReviewDatabase()).run(raw);}catch{return{ok:false,code:'unavailable'};}
}
