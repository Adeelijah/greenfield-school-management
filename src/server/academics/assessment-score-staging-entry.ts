import 'server-only';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getStagingAssessmentScoreDatabase} from './assessment-score-staging-connection';
import {createAssessmentScoreRuntime} from '@/lib/academics/assessment-score-staging-runtime';
import {assessmentScoreWritesEnabled} from '@/lib/academics/assessment-score-staging-policy';
import {parseSubjectScoreCommand,decodeSubjectScoreOutcome} from '@/lib/academics/assessment-score-command';
import type {SqlDatabase} from '@/lib/academics/report-card-postgres-disposable-adapter';
import type {SubjectScoreOutcome} from '@/lib/academics/assessment-score-command';
class BoundaryAbort extends Error{}
const unavailable={ok:false,code:'unavailable'} as const;
/** Only SDK-verified auth UUID crosses this boundary. The private SQL function
 * re-derives complete current membership/class/subject authority under locks
 * on every command, including receipt replay. Presentation roles are not authority. */
export function createVerifiedAssessmentScoreEntry(db:SqlDatabase){
 const runtime=createAssessmentScoreRuntime(db);
 return{async save(raw:unknown):Promise<SubjectScoreOutcome>{
  const command=parseSubjectScoreCommand(raw);if(!command)return{ok:false,code:'invalid'};
  let auth:string;
  try{const client=await createSupabaseServerClient();const r=await client.auth.getUser();const id=r.data.user?.id;if(r.error||typeof id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))return{ok:false,code:'forbidden'};auth=id;}catch{return{ok:false,code:'forbidden'};}
  let rejected:SubjectScoreOutcome=unavailable;
  try{return await runtime.begin(async tx=>{
   const rows=await tx.unsafe('SELECT public.save_assessment_subject_scores($1::uuid,$2::text::jsonb) AS outcome',[auth,JSON.stringify(command)]);
   const result=rows.length===1?decodeSubjectScoreOutcome(rows[0]!.outcome):null;
   if(!result||!result.ok){rejected=result??unavailable;throw new BoundaryAbort();}return result;
  });}catch(e){return e instanceof BoundaryAbort?rejected:unavailable;}
 }};
}
export async function saveStagingAssessmentScores(raw:unknown):Promise<SubjectScoreOutcome>{
 if(!assessmentScoreWritesEnabled(process.env))return{ok:false,code:'forbidden'};
 try{return await createVerifiedAssessmentScoreEntry(getStagingAssessmentScoreDatabase()).save(raw);}catch{return unavailable;}
}
