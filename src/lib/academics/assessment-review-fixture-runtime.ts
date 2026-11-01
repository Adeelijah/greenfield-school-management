// Disposable execution transport only: exact generated LOGIN -> SET-only role.
import type {SqlDatabase,SqlClient} from './report-card-postgres-disposable-adapter';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {stagingReportRoleQuery} from './report-card-staging-runtime.ts';
const exact=(value:unknown,role:string)=>Array.isArray(value)&&value.length===1&&value[0]?.role===role&&value[0]?.set===true&&value[0]?.inherit===false&&value[0]?.admin===false;
export function inspectFixtureReviewRoles(schema:string,rows:unknown):boolean{
 if(!/^rc_it_[a-f0-9]{16}$/.test(schema)||!Array.isArray(rows)||rows.length!==2)return false;
 const login=schema+'_review_login',runtime=schema+'_review_runtime';
 if(new Set(rows.map(r=>r?.name)).size!==2)return false;
 return rows.every(r=>r&&[login,runtime].includes(r.name)&&['inherit','superuser','bypass','creator','database','replication','owner'].every(k=>r[k]===false)&&r.login===(r.name===login)&&(r.name===login?exact(r.memberships,runtime)&&Array.isArray(r.members)&&r.members.length===0:Array.isArray(r.memberships)&&r.memberships.length===0&&exact(r.members,login)));
}
export function createFixtureReviewRuntime(db:SqlDatabase,schema:string):SqlDatabase{
 if(!/^rc_it_[a-f0-9]{16}$/.test(schema))throw Error('Generated fixture review runtime required');
 const login=schema+'_review_login',runtime=schema+'_review_runtime';
 return{unsafe(){throw Error('Review SQL requires transaction');},async begin<T>(work:(tx:SqlClient)=>Promise<T>):Promise<T>{return db.begin(async tx=>{
  const session=async(role:string)=>{const rows=await tx.unsafe('SELECT session_user AS "loginRole",current_user AS "executionRole"');if(rows.length!==1||rows[0]!.loginRole!==login||rows[0]!.executionRole!==role)throw Error('Wrong fixture review execution role');};
  await session(login);if(!inspectFixtureReviewRoles(schema,await tx.unsafe(stagingReportRoleQuery,[login,runtime,runtime])))throw Error('Unsafe fixture review role graph');
  await tx.unsafe('SET LOCAL ROLE "'+runtime+'"');await session(runtime);
  let active=true,poisoned=false,inFlight=0;
  const lease:SqlClient={async unsafe(query,params){if(!active||poisoned)throw Error('Expired review SQL');inFlight++;try{return await tx.unsafe(query,params);}catch(e){poisoned=true;throw e;}finally{inFlight--;}}};
  try{const result=await work(lease);if(poisoned||inFlight)throw Error('Incomplete review SQL');await session(runtime);return result;}finally{active=false;}
 });}};
}
