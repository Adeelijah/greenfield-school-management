import 'server-only';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getStagingAttendanceDatabase} from './staging-attendance-connection';
import {createAttendanceRuntime} from '@/lib/attendance/attendance-staging-runtime';
import {attendanceReadsEnabled,attendanceWritesEnabled,parseAttendanceSelector,decodeAttendanceOutcome} from '@/lib/attendance/attendance-staging-policy';
import {parseAttendanceCommand} from '@/lib/attendance/staging-attendance-command';
import {decodeAttendanceHistory} from '@/lib/attendance/attendance-postgres-history';
import type {AttendanceDatabase} from '@/lib/attendance/attendance-postgres-fixture';
import type {AttendanceOutcome} from '@/lib/attendance/staging-attendance-command';
import type {AttendanceReadOutcome} from '@/lib/attendance/attendance-postgres-history';
class BoundaryAbort extends Error{}
const forbidden={ok:false,code:'forbidden'} as const;
const unavailable={ok:false,code:'unavailable'} as const;
/** SDK getUser supplies only an authenticated UUID. Current membership, school,
 * role and assignment are derived ONCE by the private SQL routine under its
 * source/authority gates, before any history or receipt. No routing-role/RPC
 * snapshot is accepted as command authority or copied into a later transaction. */
export function createVerifiedAttendanceEntry(db:AttendanceDatabase){
 const runtime=createAttendanceRuntime(db);
 async function actor(){try{const client=await createSupabaseServerClient();const r=await client.auth.getUser();return !r.error&&typeof r.data.user?.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(r.data.user.id)?r.data.user.id:null;}catch{return null;}}
 return{
  async save(raw:unknown):Promise<AttendanceOutcome>{
   const command=parseAttendanceCommand(raw);if(!command||!parseAttendanceSelector({classKey:command.classKey,date:command.date}))return{ok:false,code:'invalid'};
   const auth=await actor();if(!auth)return forbidden;let rejected:AttendanceOutcome=unavailable;
   try{return await runtime.begin(async tx=>{const rows=await tx.unsafe('SELECT public.save_attendance($1::uuid,$2::text::jsonb) AS outcome',[auth,JSON.stringify(command)]);const result=rows.length===1?decodeAttendanceOutcome(rows[0]!.outcome):null;if(!result||!result.ok){rejected=result??unavailable;throw new BoundaryAbort();}return result;});}catch(e){return e instanceof BoundaryAbort?rejected:unavailable;}
  },
  async read(raw:unknown):Promise<AttendanceReadOutcome>{
   const selector=parseAttendanceSelector(raw);if(!selector)return{ok:false,code:'invalid'};
   const auth=await actor();if(!auth)return forbidden;let rejected:AttendanceReadOutcome=unavailable;
   try{return await runtime.begin(async tx=>{const rows=await tx.unsafe('SELECT public.read_attendance($1::uuid,$2::text,$3::text::date) AS outcome',[auth,selector.classKey,selector.date]);const result=rows.length===1?decodeAttendanceHistory(rows[0]!.outcome,selector.date):null;if(!result||!result.ok){rejected=result??unavailable;throw new BoundaryAbort();}return result;});}catch(e){return e instanceof BoundaryAbort?rejected:unavailable;}
  },
 };
}
export async function saveStagingAttendance(raw:unknown):Promise<AttendanceOutcome>{
 if(!attendanceWritesEnabled(process.env))return forbidden;
 try{return await createVerifiedAttendanceEntry(getStagingAttendanceDatabase()).save(raw);}catch{return unavailable;}
}
export async function readStagingAttendance(raw:unknown):Promise<AttendanceReadOutcome&{canSave?:boolean}>{
 if(!attendanceReadsEnabled(process.env))return unavailable;
 try{const result=await createVerifiedAttendanceEntry(getStagingAttendanceDatabase()).read(raw);return result.ok?{...result,canSave:attendanceWritesEnabled(process.env)}:result;}catch{return unavailable;}
}
