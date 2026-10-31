import type {AttendanceDatabase,AttendanceSql} from './attendance-postgres-fixture';
// Reuse the generic catalog evidence shape, not any report database or role switch.
// @ts-expect-error Explicit source extension for the offline Node runner.
import {stagingReportRoleQuery} from '../academics/report-card-staging-runtime.ts';
export const attendanceRoles=Object.freeze(['greenfield_attendance_app','greenfield_attendance_runtime','greenfield_attendance_owner'] as const);
export const attendanceRoleQuery=stagingReportRoleQuery;
const sessionQuery='SELECT session_user AS "loginRole",current_user AS "executionRole"';
function link(value:unknown,role:string):boolean{
 if(!Array.isArray(value)||value.length!==1)return false;const m=value[0];
 return !!m&&m.role===role&&m.set===true&&m.inherit===false&&m.admin===false;
}
export function inspectAttendanceRoles(rows:unknown):boolean{
 if(!Array.isArray(rows)||rows.length!==3||new Set(rows.map(r=>r?.name)).size!==3)return false;
 for(const row of rows){
  if(!row||!attendanceRoles.includes(row.name)||['superuser','bypass','creator','database','replication','inherit'].some(k=>row[k]!==false)||row.login!==(row.name===attendanceRoles[0])||row.owner!==(row.name===attendanceRoles[2])||!Array.isArray(row.memberships)||!Array.isArray(row.members))return false;
  if(row.name===attendanceRoles[0]?!link(row.memberships,attendanceRoles[1]):row.memberships.length!==0)return false;
  const control=row.members.filter((m:Record<string,unknown>|null)=>m?.role==='postgres');
  if(control.length!==1)return false;const m=control[0];
  if(m.admin!==true||m.set!==false||m.inherit!==false||m.memberSuperuser!==false||m.memberCreator!==true||m.memberBypass!==true||typeof m.grantor!=='string'||!m.grantor||m.grantorSuperuser!==true)return false;
  const other=row.members.filter((m:Record<string,unknown>|null)=>m?.role!=='postgres');
  if(row.name===attendanceRoles[1]?!link(other,attendanceRoles[0]):other.length!==0)return false;
 }
 return true;
}
const failure=()=>new Error('Attendance runtime verification failed');
/** Fixed managed staging only. No caller-selected role, schema or school. */
export function createAttendanceRuntime(db:AttendanceDatabase):AttendanceDatabase{
 return{async begin<T>(work:(tx:AttendanceSql)=>Promise<T>):Promise<T>{return db.begin(async tx=>{
  const session=async(role:string)=>{const rows=await tx.unsafe(sessionQuery);if(rows.length!==1||rows[0]!.loginRole!==attendanceRoles[0]||rows[0]!.executionRole!==role)throw failure();};
  await session(attendanceRoles[0]);
  if(!inspectAttendanceRoles(await tx.unsafe(attendanceRoleQuery,[...attendanceRoles])))throw failure();
  await tx.unsafe('SET LOCAL ROLE "greenfield_attendance_runtime"');await session(attendanceRoles[1]);
  let active=true,poisoned=false,inFlight=0;
  const lease:AttendanceSql={async unsafe(query,params){if(!active||poisoned)throw failure();inFlight++;try{return await tx.unsafe(query,params);}catch(e){poisoned=true;throw e;}finally{inFlight--;}}};
  try{const result=await work(lease);if(poisoned||inFlight)throw failure();await session(attendanceRoles[1]);return result;}finally{active=false;}
 });}};
}
