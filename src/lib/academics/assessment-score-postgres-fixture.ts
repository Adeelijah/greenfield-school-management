// Generated upgraded fixtures only. No staging URL, SDK, env or public adapter.
// @ts-expect-error Explicit source extension for the offline Node runner.
import {parseSubjectScoreCommand,decodeSubjectScoreOutcome} from './assessment-score-command.ts';
import type {SubjectScoreOutcome} from './assessment-score-command';
import type {SqlDatabase} from './report-card-postgres-disposable-adapter';
class ScoreAbort extends Error{readonly outcome:SubjectScoreOutcome;constructor(outcome:SubjectScoreOutcome){super('Score transaction rejected');this.outcome=outcome;}}
export async function executeSubjectScoreFixture(db:SqlDatabase,schema:string,identity:()=>Promise<{authUserId:string}|null>,raw:unknown):Promise<SubjectScoreOutcome>{
 if(!/^rc_it_[a-f0-9]{16}$/.test(schema))return{ok:false,code:'invalid'};
 const command=parseSubjectScoreCommand(raw);if(!command)return{ok:false,code:'invalid'};
 try{const actor=await identity();if(!actor||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(actor.authUserId))return{ok:false,code:'forbidden'};const auth=actor.authUserId;
  return await db.begin(async tx=>{const role=await tx.unsafe('SELECT current_user AS role');if(role.length!==1||role[0]!.role!==schema+'_score_runtime')throw new ScoreAbort({ok:false,code:'forbidden'});
   const rows=await tx.unsafe('SELECT "'+schema+'".save_subject_scores($1::uuid,$2::text::jsonb) AS outcome',[auth,JSON.stringify(command)]);const outcome=rows.length===1?decodeSubjectScoreOutcome(rows[0]!.outcome):null;
   if(!outcome||!outcome.ok)throw new ScoreAbort(outcome??{ok:false,code:'unavailable'});return outcome;
  });
 }catch(error){return error instanceof ScoreAbort?error.outcome:{ok:false,code:'unavailable'};}
}
