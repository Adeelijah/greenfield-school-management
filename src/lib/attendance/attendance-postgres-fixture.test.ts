import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { executeAttendanceFixture } from './attendance-postgres-fixture.ts';
import type { AttendanceDatabase } from './attendance-postgres-fixture';
const schema='at_it_0123456789abcdef',auth='00000000-0000-4000-8000-000000000001',student='00000000-0000-4000-8000-000000000002';
const command=()=>({action:'save_register',classKey:'primary5',date:'2026-10-23',expectedVersion:0,operationKey:'intent-0001',reason:null,marks:{[student]:'present'}});
function fixture(outcome:unknown={ok:true,kind:'applied',version:1},role=schema+'_worker'){
 const queries:{sql:string;params:unknown[]|undefined}[]=[];let committed=false,rolledBack=false;
 const db:AttendanceDatabase={async begin(work){try{const result=await work({async unsafe(sql,params){queries.push({sql,params});return sql.includes('current_user')?[{role}]:[{outcome}];}});committed=true;return result;}catch(error){rolledBack=true;throw error;}}};
 return{db,queries,get committed(){return committed;},get rolledBack(){return rolledBack;}};
}
test('attendance fixture rejects unsafe schema and forged body before transaction or identity lookup',async()=>{
 const f=fixture();let identities=0;const identity=async()=>{identities++;return{authUserId:auth};};
 for(const name of ['public','rc_it_0123456789abcdef','at_it_x;DROP SCHEMA public'])assert.deepEqual(await executeAttendanceFixture(f.db,name,identity,command()),{ok:false,code:'invalid'});
 assert.deepEqual(await executeAttendanceFixture(f.db,schema,identity,{...command(),schoolId:auth}),{ok:false,code:'invalid'});
 assert.equal(identities,0);assert.equal(f.queries.length,0);
});
test('verified identity is parameterized and exact fixture execution role is mandatory',async()=>{
 const f=fixture();assert.deepEqual(await executeAttendanceFixture(f.db,schema,async()=>({authUserId:auth}),command()),{ok:true,kind:'applied',version:1});
 assert.equal(f.committed,true);assert.deepEqual(f.queries[1]!.params,[auth,JSON.stringify(command())]);assert.ok(!f.queries[1]!.sql.includes(auth));
 const owner=fixture(undefined,schema+'_owner');assert.deepEqual(await executeAttendanceFixture(owner.db,schema,async()=>({authUserId:auth}),command()),{ok:false,code:'forbidden'});assert.equal(owner.queries.length,1);assert.equal(owner.rolledBack,true);
});
test('missing verified auth rejects without opening a SQL transaction',async()=>{const f=fixture();assert.deepEqual(await executeAttendanceFixture(f.db,schema,async()=>null,command()),{ok:false,code:'forbidden'});assert.equal(f.queries.length,0);});
test('malformed SQL successes and safe denials abort the owning transaction',async()=>{
 for(const value of [null,{ok:true,kind:'applied',version:0},{ok:true,kind:'applied',version:1,school:'leak'},{ok:false,code:'internal-secret'},{ok:false,code:'conflict'}]){
  const f=fixture(value);const result=await executeAttendanceFixture(f.db,schema,async()=>({authUserId:auth}),command());assert.equal(result.ok,false);assert.equal(f.committed,false);assert.equal(f.rolledBack,true);
 }
});
test('database and identity exceptions expose no raw error detail',async()=>{const f=fixture();assert.deepEqual(await executeAttendanceFixture(f.db,schema,async()=>{throw Error('secret');},command()),{ok:false,code:'unavailable'});const db:AttendanceDatabase={async begin(){throw Error('password');}};assert.deepEqual(await executeAttendanceFixture(db,schema,async()=>({authUserId:auth}),command()),{ok:false,code:'unavailable'});});
