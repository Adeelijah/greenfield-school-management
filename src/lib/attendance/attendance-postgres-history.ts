import type {AttendanceDatabase} from './attendance-postgres-fixture';
export type AttendanceMark='present'|'absent'|'late'|'excused';
export type AttendanceHistory={version:number;date:string;marks:Record<string,AttendanceMark>;history:{version:number;reason:string|null;marks:Record<string,AttendanceMark>;recordedAt:string}[]};
export type AttendanceReadOutcome={ok:true;register:AttendanceHistory|null}|{ok:false;code:'invalid'|'forbidden'|'unavailable'};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function marks(value:unknown):value is Record<string,AttendanceMark>{return object(value)&&Object.keys(value).length>0&&Object.entries(value).every(([key,v])=>uuid(key)&&typeof v==='string'&&['present','absent','late','excused'].includes(v));}
export function decodeAttendanceHistory(value:unknown,date:string):AttendanceReadOutcome|null{
 if(!object(value)||Object.keys(value).length!==2)return null;
 if(value.ok===false&&(value.code==='invalid'||value.code==='forbidden'))return{ok:false,code:value.code};
 if(value.ok!==true||!Object.hasOwn(value,'register'))return null;
 if(value.register===null)return{ok:true,register:null};
 const r=value.register;
 if(!object(r)||Object.keys(r).length!==4||r.date!==date||!Number.isInteger(r.version)||Number(r.version)<1||Number(r.version)>2147483647||!marks(r.marks)||!Array.isArray(r.history)||r.history.length!==r.version)return null;
 const currentMarks=r.marks;
 const ids=Object.keys(currentMarks).sort().join(',');
 const history:AttendanceHistory['history']=[];
 for(let i=0;i<r.history.length;i++){
  const h=r.history[i];
  if(!object(h)||Object.keys(h).length!==4||h.version!==i+1||!marks(h.marks)||Object.keys(h.marks).sort().join(',')!==ids||typeof h.recordedAt!=='string'||!Number.isFinite(Date.parse(h.recordedAt))||(i===0?h.reason!==null:typeof h.reason!=='string'||h.reason.trim().length===0||h.reason.length>2000))return null;
  history.push({version:i+1,reason:h.reason as string|null,marks:{...h.marks},recordedAt:h.recordedAt});
 }
 if(Object.keys(currentMarks).some(id=>currentMarks[id]!==history[history.length-1]!.marks[id]))return null;
 return{ok:true,register:{version:Number(r.version),date,marks:{...currentMarks},history}};
}
class HistoryAbort extends Error{readonly outcome:AttendanceReadOutcome;constructor(outcome:AttendanceReadOutcome){super('Attendance history rejected');this.outcome=outcome;}}
/** Read-only generated upgrade adapter. Every read rechecks complete current
 * authority through the private SQL function; historical marks are not a roster. */
export async function readAttendanceUpgradeFixture(db:AttendanceDatabase,schema:string,identity:()=>Promise<{authUserId:string}|null>,selector:unknown):Promise<AttendanceReadOutcome>{
 if(!/^rc_it_[a-f0-9]{16}$/.test(schema)||!object(selector)||Object.keys(selector).length!==2||(selector.classKey!=='primary5'&&selector.classKey!=='creche')||typeof selector.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(selector.date)||!Number.isFinite(Date.parse(selector.date))||new Date(selector.date).toISOString().slice(0,10)!==selector.date)return{ok:false,code:'invalid'};
 const classKey=selector.classKey,date=selector.date;
 try{
  const actor=await identity();if(!actor||!uuid(actor.authUserId))return{ok:false,code:'forbidden'};const auth=actor.authUserId;
  return await db.begin(async tx=>{
   const role=await tx.unsafe('SELECT current_user AS role');
   if(role.length!==1||role[0]!.role!==schema+'_attendance_worker')throw new HistoryAbort({ok:false,code:'forbidden'});
   const rows=await tx.unsafe('SELECT "'+schema+'"."read_attendance"($1::uuid,$2::text,$3::text::date) AS outcome',[auth,classKey,date]);
   const outcome=rows.length===1?decodeAttendanceHistory(rows[0]!.outcome,date):null;
   if(!outcome)throw new HistoryAbort({ok:false,code:'unavailable'});if(!outcome.ok)throw new HistoryAbort(outcome);return outcome;
  });
 }catch(error){return error instanceof HistoryAbort?error.outcome:{ok:false,code:'unavailable'};}
}
