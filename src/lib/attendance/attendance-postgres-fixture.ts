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
function decode(value:unknown):AttendanceOutcome|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const r=value as Record<string,unknown>;
 if(r.ok===true&&Object.keys(r).length===3&&(r.kind==='applied'||r.kind==='replay')&&Number.isInteger(r.version)&&Number(r.version)>0&&Number(r.version)<=2147483647)return{ok:true,kind:r.kind,version:Number(r.version)};
 if(r.ok===false&&Object.keys(r).length===2&&(r.code==='invalid'||r.code==='forbidden'||r.code==='conflict'))return{ok:false,code:r.code};
 return null;
}
/** Fixture-only adapter: no driver, environment lookup or staging server wiring.
 * Identity callback belongs to the trusted test/server boundary, never body data.
 * SQL function owns its exclusive gate and complete actor check. Any failure
 * poisons the outer transaction, including a malformed successful SQL response.
 */
export async function executeAttendanceFixture(
 db:AttendanceDatabase,schema:string,verifiedIdentity:()=>Promise<{authUserId:string}|null>,raw:unknown,
):Promise<AttendanceOutcome>{
 const command=parseAttendanceCommand(raw);
 if(!/^at_it_[a-f0-9]{16}$/.test(schema)||!command)return{ok:false,code:'invalid'};
 try{
  const identity=await verifiedIdentity();
  if(!identity||!uuid(identity.authUserId))return{ok:false,code:'forbidden'};
  const authUserId=identity.authUserId;
  return await db.begin(async tx=>{
   const role=await tx.unsafe('SELECT current_user AS role');
   if(role.length!==1||role[0]!.role!==schema+'_worker')throw new AttendanceAbort({ok:false,code:'forbidden'});
   const rows=await tx.unsafe('SELECT "'+schema+'"."save_attendance"($1::uuid,$2::text::jsonb) AS outcome',[authUserId,JSON.stringify(command)]);
   const outcome=rows.length===1?decode(rows[0]!.outcome):null;
   if(!outcome)throw new AttendanceAbort({ok:false,code:'unavailable'});
   if(!outcome.ok)throw new AttendanceAbort(outcome);
   return outcome;
  });
 }catch(error){return error instanceof AttendanceAbort?error.outcome:{ok:false,code:'unavailable'};}
}
