import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { executeCompleteFixtureReport, type FixtureRequestBinding } from './report-card-complete-fixture-boundary.ts';
import type { SqlDatabase, SqlClient } from './report-card-postgres-disposable-adapter';
const schema='rc_it_0123456789abcdef';
const binding:FixtureRequestBinding={authUserId:'auth',schoolUserId:'user',membershipId:'member',schoolId:'school'};
const row={auth_user_id:'auth',school_user_id:'user',membership_id:'member',school_id:'school',role:'teacher',status:'active',final_primary_year:5,school_user_count:1,active_membership_count:1};
function fixture() {
  const f={role:schema+'_writer',gate:true,rows:[{...row}],events:[] as string[],committed:[] as string[],failWrite:false};
  const db:SqlDatabase={unsafe:async()=>{throw Error('outside transaction');},begin:async callback=>{
    const staged:string[]=[];f.events.push('begin');
    try {const result=await callback({unsafe:async(query,params)=>{
      if(query==='SELECT current_user AS role'){f.events.push('role');return [{role:f.role}];}
      if(query.includes('fixture_source_write_gate')){f.events.push('source');return f.gate?[{id:1}]:[];}
      if(query.includes('lock_report_card_actor')){f.events.push('authority');assert.deepEqual(params,['auth']);return f.rows;}
      f.events.push(query);staged.push(query);if(f.failWrite)throw Error('private persistence detail');return [];
    }});f.committed.push(...staged);f.events.push('commit');return result;}catch(error){f.events.push('rollback');throw error;}
  }};
  return {...f,state:f,db};
}
test('complete boundary orders role/source/authority before work and shares exactly one outer transaction',async()=>{
  const f=fixture();const result=await executeCompleteFixtureReport(f.db,schema,binding,async(db,identity,authority)=>{
    assert.deepEqual(await identity(),{authUserId:'auth'});assert.equal(authority.schoolId,'school');
    await db.begin(tx=>tx.unsafe('write'));return {ok:true,value:'applied'};
  });assert.deepEqual(result,{ok:true,value:'applied'});assert.deepEqual(f.state.events,['begin','role','source','authority','write','commit']);
});
test('invalid schema or missing trusted binding denies without opening a transaction',async()=>{
  const f=fixture();for(const [s,b] of [['public',binding],[schema,{...binding,authUserId:''}]] as const)assert.deepEqual(await executeCompleteFixtureReport(f.db,s,b,async()=>({ok:true})),{ok:false,code:'invalid'});assert.deepEqual(f.state.events,[]);
});
test('owner, reader, foreign writer and missing source gate cannot reach authority/work',async()=>{
  for(const role of ['postgres',schema+'_reader','rc_it_fedcba9876543210_writer']){const f=fixture();f.state.role=role;assert.deepEqual(await executeCompleteFixtureReport(f.db,schema,binding,async()=>{throw Error('work must not run');}),{ok:false,code:'forbidden'});assert.equal(f.state.events.includes('source'),false);}
  const f=fixture();f.state.gate=false;assert.deepEqual(await executeCompleteFixtureReport(f.db,schema,binding,async()=>({ok:true})),{ok:false,code:'transaction_failed'});assert.equal(f.state.events.includes('authority'),false);
});
test('hidden membership ambiguity, suspension and request rebinding deny before work',async()=>{
  for(const patch of [{active_membership_count:2},{status:'suspended'},{school_id:'foreign'},{school_user_id:'other-user'},{membership_id:'other-member'}]){const f=fixture();Object.assign(f.state.rows[0],patch);assert.deepEqual(await executeCompleteFixtureReport(f.db,schema,binding,async()=>{throw Error('work must not run');}),{ok:false,code:'forbidden'});assert.equal(f.state.events.at(-1),'rollback');}
});
test('failed command outcome rolls back partial writes and preserves the safe failure result',async()=>{
  const f=fixture();assert.deepEqual(await executeCompleteFixtureReport(f.db,schema,binding,async db=>{await db.begin(tx=>tx.unsafe('partial write'));return {ok:false,code:'receipt_failure'};}),{ok:false,code:'receipt_failure'});assert.deepEqual(f.state.committed,[]);assert.equal(f.state.events.at(-1),'rollback');
});
test('caught inner persistence failure cannot be converted into a successful commit',async()=>{
  const f=fixture();f.state.failWrite=true;assert.deepEqual(await executeCompleteFixtureReport(f.db,schema,binding,async db=>{try{await db.begin(tx=>tx.unsafe('partial write'));}catch{}return {ok:true};}),{ok:false,code:'transaction_failed'});assert.deepEqual(f.state.committed,[]);
});
test('thrown workload failure rolls back without exposing SQL details',async()=>{
  const f=fixture();assert.deepEqual(await executeCompleteFixtureReport(f.db,schema,binding,async db=>{await db.begin(tx=>tx.unsafe('partial write'));throw Error('private SQL detail');}),{ok:false,code:'transaction_failed'});assert.deepEqual(f.state.committed,[]);
});
test('captured connection and database leases cannot execute after the outer transaction ends',async()=>{
  const f=fixture();let captured:SqlClient|undefined,scoped:SqlDatabase|undefined;
  const result=await executeCompleteFixtureReport(f.db,schema,binding,async db=>{
    scoped=db;await db.begin(async tx=>{captured=tx;});
    // An old callback lease must not revive during another callback.
    await db.begin(async()=>{assert.throws(()=>captured!.unsafe('stale write'),/Expired/);});
    return {ok:true};
  });
  assert.deepEqual(result,{ok:false,code:'transaction_failed'});
  assert.throws(()=>captured!.unsafe('late write'),/Expired/);await assert.rejects(scoped!.begin(async()=>true),/Invalid/);assert.deepEqual(f.state.committed,[]);
});
test('current locked role/configuration is used without mutating the request binding',async()=>{
  const f=fixture();Object.assign(f.state.rows[0],{role:'admin',final_primary_year:6});const before={...binding};
  assert.deepEqual(await executeCompleteFixtureReport(f.db,schema,binding,async(_db,_identity,authority)=>({ok:true,role:authority.role,year:authority.finalPrimaryYear})),{ok:true,role:'admin',year:6});assert.deepEqual(binding,before);
});
test('SQL failure caught inside a command callback still poisons the whole transaction',async()=>{
  const f=fixture();f.state.failWrite=true;
  assert.deepEqual(await executeCompleteFixtureReport(f.db,schema,binding,async db=>{
    await db.begin(async tx=>{try{await tx.unsafe('partial write');}catch{}});return {ok:true};
  }),{ok:false,code:'transaction_failed'});assert.deepEqual(f.state.committed,[]);
});

test('request binding is captured before asynchronous transaction work',async()=>{
  const f=fixture(),mutable={...binding};
  const pending=executeCompleteFixtureReport(f.db,schema,mutable,async(_db,identity,authority)=>({ok:true,auth:(await identity()).authUserId,school:authority.schoolId}));
  mutable.authUserId='changed';mutable.schoolId='changed';
  assert.deepEqual(await pending,{ok:true,auth:'auth',school:'school'});
});
