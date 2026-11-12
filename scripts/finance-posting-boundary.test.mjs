import test from 'node:test';
import assert from 'node:assert/strict';
import {executeFinancePostingFixture} from '../src/lib/finance/finance-postgres-fixture.ts';

const schema='fi_it_0123456789abcdef',login=schema+'_login',worker=schema+'_worker';
const invoiceId='00000000-0000-4000-8000-000000000001',authUserId='00000000-0000-4000-8000-000000000002';
const cmd=()=>({action:'record_payment',invoiceId,expectedVersion:1,operationKey:'finance-test-01',amount:'50',method:'cash',reference:null,receivedOn:'2026-11-12'});
const applied={ok:true,kind:'applied',result:{ok:true,action:'record_payment',invoiceId,version:2,eventId:'00000000-0000-4000-8000-000000000003',receiptId:'00000000-0000-4000-8000-000000000004'}};
function fixture({initial=login,changed=worker,outcome=applied,failCommit=false}={}){
 const events=[];
 const db={async begin(work){let role=initial;events.push('begin');try{const result=await work({async unsafe(sql,params){
  if(sql.startsWith('SELECT session_user'))return [{login:initial,role}];
  if(sql.startsWith('SET LOCAL ROLE')){events.push(sql);role=changed;return [];}
  events.push(params);return [{outcome}];
 }});if(failCommit)throw Error('fixture commit details');events.push('commit');return result;}catch(error){events.push('rollback');throw error;}}};
 return {db,events};
}
const identity=async()=>({authUserId});
test('finance boundary rejects unverified principals and forged request identity before opening a transaction',async()=>{
 const {db,events}=fixture();
 for(const raw of [{...cmd(),schoolId:invoiceId},{...cmd(),role:'admin'},{...cmd(),authUserId}])assert.deepEqual(await executeFinancePostingFixture(db,schema,identity,raw),{ok:false,code:'invalid'});
 assert.deepEqual(await executeFinancePostingFixture(db,'public',identity,cmd()),{ok:false,code:'invalid'});
 assert.deepEqual(await executeFinancePostingFixture(db,schema,async()=>null,cmd()),{ok:false,code:'forbidden'});assert.deepEqual(events,[]);
});
test('finance boundary copies a normalized command before awaiting verified identity',async()=>{
 const {db,events}=fixture(),request=cmd();
 assert.deepEqual(await executeFinancePostingFixture(db,schema,async()=>{request.amount='120';return {authUserId};},request),applied);
 assert.deepEqual(events,['begin',`SET LOCAL ROLE "${worker}"`,[authUserId,JSON.stringify({...cmd(),amount:'50.00'})],'commit']);
});
test('finance boundary fails closed on owner or wrong worker sessions before invoking the routine',async()=>{
 for(const options of [{initial:'postgres'},{changed:'postgres'}]){const {db,events}=fixture(options);assert.deepEqual(await executeFinancePostingFixture(db,schema,identity,cmd()),{ok:false,code:'forbidden'});assert.equal(events.at(-1),'rollback');assert.ok(!events.some(Array.isArray));}
});
test('finance boundary preserves a replay result but rolls back a business denial',async()=>{
 const replay=fixture({outcome:{...applied,kind:'replay'}});assert.deepEqual(await executeFinancePostingFixture(replay.db,schema,identity,cmd()),{...applied,kind:'replay'});
 const fail=fixture({outcome:{ok:false,code:'duplicate_reference'}});assert.deepEqual(await executeFinancePostingFixture(fail.db,schema,identity,cmd()),{ok:false,code:'duplicate_reference'});assert.equal(fail.events.at(-1),'rollback');
});
test('finance boundary rolls back malformed or scope-mismatched success before returning any record',async()=>{
 for(const result of [{...applied.result,version:3},{...applied.result,invoiceId:authUserId},{...applied.result,internal:'raw row'},{...applied.result,receiptId:null}]){const {db,events}=fixture({outcome:{...applied,result}});assert.deepEqual(await executeFinancePostingFixture(db,schema,identity,cmd()),{ok:false,code:'unavailable'});assert.equal(events.at(-1),'rollback');}
});
test('finance boundary does not report success after a failed commit or expose provider errors',async()=>{
 const {db,events}=fixture({failCommit:true});assert.deepEqual(await executeFinancePostingFixture(db,schema,identity,cmd()),{ok:false,code:'unavailable'});assert.equal(events.at(-1),'rollback');
 assert.deepEqual(await executeFinancePostingFixture(db,schema,async()=>{throw Error('sensitive fixture provider error');},cmd()),{ok:false,code:'unavailable'});
});
