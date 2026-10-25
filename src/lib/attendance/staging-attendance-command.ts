import { createHash } from 'node:crypto';
export type AttendanceCommand = { action:'save_register'; classKey:'primary5'|'creche'; date:string; expectedVersion:number; operationKey:string; reason:string|null; marks:Record<string,'present'|'absent'|'late'|'excused'> };
export type AttendanceOutcome = {ok:true;kind:'applied'|'replay';version:number}|{ok:false;code:'invalid'|'forbidden'|'conflict'|'unavailable'};
export function parseAttendanceCommand(value:unknown):AttendanceCommand|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const r=value as Record<string,unknown>,keys=['action','classKey','date','expectedVersion','operationKey','reason','marks'];
 if(Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))||r.action!=='save_register'||(r.classKey!=='primary5'&&r.classKey!=='creche')||typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isSafeInteger(r.expectedVersion)||Number(r.expectedVersion)<0||Number(r.expectedVersion)>=Number.MAX_SAFE_INTEGER||typeof r.operationKey!=='string'||!/^[A-Za-z0-9:_-]{8,120}$/.test(r.operationKey)||!r.marks||typeof r.marks!=='object'||Array.isArray(r.marks))return null;
 if(r.reason!==null&&(typeof r.reason!=='string'||!r.reason.trim()||r.reason.trim().length>2000))return null;
 if(Number(r.expectedVersion)>0&&typeof r.reason!=='string')return null;
 const marks=r.marks as Record<string,unknown>;
 if(!Object.keys(marks).length||Object.keys(marks).some(id=>! /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)||(typeof marks[id]!=='string'||!['present','absent','late','excused'].includes(marks[id] as string))))return null;
 return {action:'save_register',classKey:r.classKey as AttendanceCommand['classKey'],date:r.date,expectedVersion:Number(r.expectedVersion),operationKey:r.operationKey,reason:typeof r.reason==='string'?r.reason.trim():null,marks:{...marks}as AttendanceCommand['marks']};
}
export type AttendanceContext={schoolId:string;actorId:string;role:'admin'|'teacher'|'bursar';active:boolean;assigned:boolean;studentIds:readonly string[];sessionStartsOn:string;sessionEndsOn:string;registerVersion:number};
export type AttendanceTransaction={
 // Adapter must take the source/authority gate BEFORE roster or register discovery,
 // resolve current actor itself, and lock the unique class/session/date register.
 lockContext(classKey:string,date:string):Promise<AttendanceContext|null>;
 receipt(schoolId:string,actorId:string,key:string):Promise<{fingerprint:string;version:number}|null>;
 write(context:AttendanceContext,command:AttendanceCommand,nextVersion:number):Promise<void>;
 audit(context:AttendanceContext,command:AttendanceCommand,nextVersion:number):Promise<void>;
 storeReceipt(context:AttendanceContext,key:string,fingerprint:string,nextVersion:number):Promise<void>;
};
export type AttendancePort={begin<T>(work:(tx:AttendanceTransaction)=>Promise<T>):Promise<T>};
/** Durable adapter deliberately absent. Never expose this with a caller-owned
 * actor or substitute memory storage for a live save endpoint. */
export async function executeAttendanceCommand(raw:unknown,port:AttendancePort,today:string):Promise<AttendanceOutcome>{
 const c=parseAttendanceCommand(raw);if(!c||!Number.isFinite(Date.parse(c.date))||new Date(c.date).toISOString().slice(0,10)!==c.date||c.date>today)return{ok:false,code:'invalid'};
 const fingerprint=createHash('sha256').update(JSON.stringify({...c,marks:Object.fromEntries(Object.entries(c.marks).sort(([a],[b])=>a.localeCompare(b)))})).digest('hex');
 try{return await port.begin(async tx=>{
  const context=await tx.lockContext(c.classKey,c.date);
  if(!context||!context.active||(context.role!=='admin'&&context.role!=='teacher')||(context.role==='teacher'&&!context.assigned)||!context.schoolId||!context.actorId)return{ok:false,code:'forbidden'}as const;
  if(c.date<context.sessionStartsOn||c.date>context.sessionEndsOn||!context.studentIds.length||new Set(context.studentIds).size!==context.studentIds.length||Object.keys(c.marks).length!==context.studentIds.length||context.studentIds.some(id=>!Object.hasOwn(c.marks,id)))return{ok:false,code:'invalid'}as const;
  const prior=await tx.receipt(context.schoolId,context.actorId,c.operationKey);
  if(prior)return prior.fingerprint===fingerprint?{ok:true,kind:'replay',version:prior.version}as const:{ok:false,code:'conflict'}as const;
  if(!Number.isSafeInteger(context.registerVersion)||context.registerVersion<0||c.expectedVersion!==context.registerVersion)return{ok:false,code:'conflict'}as const;
  const version=context.registerVersion+1;
  await tx.write(context,c,version);await tx.audit(context,c,version);await tx.storeReceipt(context,c.operationKey,fingerprint,version);
  return{ok:true,kind:'applied',version}as const;
 });}catch{return{ok:false,code:'unavailable'};}
}
