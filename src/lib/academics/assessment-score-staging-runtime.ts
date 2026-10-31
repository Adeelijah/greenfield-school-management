import type {SqlDatabase,SqlClient as AssessmentScoreSql} from './report-card-postgres-disposable-adapter';
type AssessmentScoreDatabase=Pick<SqlDatabase,'begin'>;
// Reuse the generic catalog evidence shape, not any report database or role switch.
// @ts-expect-error Explicit source extension for the offline Node runner.
import {stagingReportRoleQuery} from './report-card-staging-runtime.ts';
export const assessmentScoreRoles=Object.freeze(['greenfield_assessment_app','greenfield_assessment_runtime','greenfield_assessment_owner'] as const);
export const assessmentScoreRoleQuery=stagingReportRoleQuery;
const sessionQuery='SELECT session_user AS "loginRole",current_user AS "executionRole"';
function link(value:unknown,role:string):boolean{
 if(!Array.isArray(value)||value.length!==1)return false;const m=value[0];
 return !!m&&m.role===role&&m.set===true&&m.inherit===false&&m.admin===false;
}
export function inspectAssessmentScoreRoles(rows:unknown):boolean{
 if(!Array.isArray(rows)||rows.length!==3||new Set(rows.map(r=>r?.name)).size!==3)return false;
 for(const row of rows){
  if(!row||!assessmentScoreRoles.includes(row.name)||['superuser','bypass','creator','database','replication','inherit'].some(k=>row[k]!==false)||row.login!==(row.name===assessmentScoreRoles[0])||row.owner!==(row.name===assessmentScoreRoles[2])||!Array.isArray(row.memberships)||!Array.isArray(row.members))return false;
  if(row.name===assessmentScoreRoles[0]?!link(row.memberships,assessmentScoreRoles[1]):row.memberships.length!==0)return false;
  const control=row.members.filter((m:Record<string,unknown>|null)=>m?.role==='postgres');
  if(control.length!==1)return false;const m=control[0];
  if(m.admin!==true||m.set!==false||m.inherit!==false||m.memberSuperuser!==false||m.memberCreator!==true||m.memberBypass!==true||typeof m.grantor!=='string'||!m.grantor||m.grantorSuperuser!==true)return false;
  const other=row.members.filter((m:Record<string,unknown>|null)=>m?.role!=='postgres');
  if(row.name===assessmentScoreRoles[1]?!link(other,assessmentScoreRoles[0]):other.length!==0)return false;
 }
 return true;
}
const failure=()=>new Error('AssessmentScore runtime verification failed');
/** Fixed managed staging only. No caller-selected role, schema or school. */
export function createAssessmentScoreRuntime(db:AssessmentScoreDatabase):AssessmentScoreDatabase{
 return{async begin<T>(work:(tx:AssessmentScoreSql)=>Promise<T>):Promise<T>{return db.begin(async tx=>{
  const session=async(role:string)=>{const rows=await tx.unsafe(sessionQuery);if(rows.length!==1||rows[0]!.loginRole!==assessmentScoreRoles[0]||rows[0]!.executionRole!==role)throw failure();};
  await session(assessmentScoreRoles[0]);
  if(!inspectAssessmentScoreRoles(await tx.unsafe(assessmentScoreRoleQuery,[...assessmentScoreRoles])))throw failure();
  await tx.unsafe('SET LOCAL ROLE "greenfield_assessment_runtime"');await session(assessmentScoreRoles[1]);
  let active=true,poisoned=false,inFlight=0;
  const lease:AssessmentScoreSql={async unsafe(query,params){if(!active||poisoned)throw failure();inFlight++;try{return await tx.unsafe(query,params);}catch(e){poisoned=true;throw e;}finally{inFlight--;}}};
  try{const result=await work(lease);if(poisoned||inFlight)throw failure();await session(assessmentScoreRoles[1]);return result;}finally{active=false;}
 });}};
}
