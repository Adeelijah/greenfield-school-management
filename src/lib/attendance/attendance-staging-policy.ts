// Pure local-staging policy. The SQL routines remain the current-authority boundary.
// @ts-expect-error Explicit source extension for the offline Node runner.
import { stagingUiEnabled } from '../academics/report-card-staging-ui.ts';
import type { AttendanceOutcome } from './staging-attendance-command';
export function validAttendanceDatabaseUrl(value:unknown):value is string{
 if(typeof value!=='string')return false;
 try{const u=new URL(value);return u.protocol==='postgresql:'&&u.hostname==='aws-0-eu-west-1.pooler.supabase.com'&&u.port==='5432'&&u.pathname==='/postgres'&&u.username==='greenfield_attendance_app.hweoqkbgmzycyznrbvng'&&!!u.password&&!u.search&&!u.hash;}catch{return false;}
}
export function attendanceReadsEnabled(env:Readonly<Record<string,string|undefined>>):boolean{return stagingUiEnabled(env)&&['READ_ONLY','FICTIONAL_STAGING_ATTENDANCE_WRITES_ONLY'].includes(env.GREENFIELD_STAGING_ATTENDANCE??'');}
export function attendanceWritesEnabled(env:Readonly<Record<string,string|undefined>>):boolean{return attendanceReadsEnabled(env)&&env.GREENFIELD_STAGING_ATTENDANCE==='FICTIONAL_STAGING_ATTENDANCE_WRITES_ONLY';}
export function parseAttendanceSelector(value:unknown):{classKey:'primary5'|'creche';date:string}|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const r=value as Record<string,unknown>;
 if(Object.keys(r).length!==2||!Object.hasOwn(r,'classKey')||!Object.hasOwn(r,'date')||(r.classKey!=='primary5'&&r.classKey!=='creche')||typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date)return null;
 return{classKey:r.classKey,date:r.date};
}
export function decodeAttendanceOutcome(value:unknown):AttendanceOutcome|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const r=value as Record<string,unknown>;
 if(r.ok===true&&Object.keys(r).length===3&&(r.kind==='applied'||r.kind==='replay')&&Number.isInteger(r.version)&&Number(r.version)>0&&Number(r.version)<=2147483647)return{ok:true,kind:r.kind,version:Number(r.version)};
 if(r.ok===false&&Object.keys(r).length===2&&(r.code==='invalid'||r.code==='forbidden'||r.code==='conflict'))return{ok:false,code:r.code};return null;
}
