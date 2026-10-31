// @ts-expect-error Explicit source extension for the offline Node runner.
import { decodeAttendanceOutcome as decode } from './attendance-staging-policy.ts';
import type { AttendanceOutcome } from './staging-attendance-command';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { parseAttendanceCommand } from './staging-attendance-command.ts';
export type AttendanceSql = { unsafe(query:string,params?:unknown[]):Promise<Record<string,unknown>[]> };
export type AttendanceDatabase = { begin<T>(work:(tx:AttendanceSql)=>Promise<T>):Promise<T> };
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
class AttendanceAbort extends Error {
 readonly outcome:AttendanceOutcome;
 constructor(outcome:AttendanceOutcome){super('Attendance fixture transaction rejected');this.outcome=outcome;}
}
/** Fixture-only adapter: no driver, environment lookup or staging server wiring.
 * Identity callback belongs to the trusted test/server boundary, never body data.
 * SQL function owns its exclusive gate and complete actor check. Any failure
 * poisons the outer transaction, including a malformed successful SQL response.
 */
async function executeAttendanceInFixture(
 db:AttendanceDatabase,schema:string,role:string,verifiedIdentity:()=>Promise<{authUserId:string}|null>,raw:unknown,
):Promise<AttendanceOutcome>{
 const command=parseAttendanceCommand(raw);
 if(!command)return{ok:false,code:'invalid'};
 try{
  const identity=await verifiedIdentity();
  if(!identity||!uuid(identity.authUserId))return{ok:false,code:'forbidden'};
  const authUserId=identity.authUserId;
  return await db.begin(async tx=>{
   const rowsRole=await tx.unsafe('SELECT current_user AS role');
   if(rowsRole.length!==1||rowsRole[0]!.role!==role)throw new AttendanceAbort({ok:false,code:'forbidden'});
   const rows=await tx.unsafe('SELECT "'+schema+'"."save_attendance"($1::uuid,$2::text::jsonb) AS outcome',[authUserId,JSON.stringify(command)]);
   const outcome=rows.length===1?decode(rows[0]!.outcome):null;
   if(!outcome)throw new AttendanceAbort({ok:false,code:'unavailable'});
   if(!outcome.ok)throw new AttendanceAbort(outcome);
   return outcome;
  });
 }catch(error){return error instanceof AttendanceAbort?error.outcome:{ok:false,code:'unavailable'};}
}

export async function executeAttendanceFixture(db:AttendanceDatabase,schema:string,identity:()=>Promise<{authUserId:string}|null>,raw:unknown):Promise<AttendanceOutcome>{
 if(!/^at_it_[a-f0-9]{16}$/.test(schema))return{ok:false,code:'invalid'};
 return executeAttendanceInFixture(db,schema,schema+'_worker',identity,raw);
}
/** Only generated, schema-faithful upgrade fixtures. Never permits public or a
 * request-selected role, and never substitutes the existing report role. */
export async function executeAttendanceUpgradeFixture(db:AttendanceDatabase,schema:string,identity:()=>Promise<{authUserId:string}|null>,raw:unknown):Promise<AttendanceOutcome>{
 if(!/^rc_it_[a-f0-9]{16}$/.test(schema))return{ok:false,code:'invalid'};
 return executeAttendanceInFixture(db,schema,schema+'_attendance_worker',identity,raw);
}
