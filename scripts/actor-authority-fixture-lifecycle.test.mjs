import test from 'node:test';
import assert from 'node:assert/strict';
import { awaitFixtureAuthorityLock, cleanupFixtureAuthority } from './lib/actor-authority-fixture-lifecycle.mjs';
const names = {schema:'rc_auth_0123456789abcdef',ownerRole:'gf_rc_auth_owner_0123456789abcdef',runtimeRole:'gf_rc_auth_runtime_0123456789abcdef'};
const all = {schema:true,owner:true,runtime:true};
function fixture({failRole=false,remaining=[]}={}) {
  const committed=[], attempts=[];
  return {committed,attempts,db:{
    begin:async work=>{const staged=[];await work({unsafe:async query=>{attempts.push(query);if(failRole && query.startsWith('DROP ROLE'))throw Error('role dependency');staged.push(query);return [];}});committed.push(...staged);},
    unsafe:async(query,parameters)=>{attempts.push({query,parameters});return remaining;},
  }};
}
test('cleanup commits exact owned schema and roles then verifies catalog absence',async()=>{
  const f=fixture();await cleanupFixtureAuthority(f.db,names,all);
  assert.deepEqual(f.committed,['DROP SCHEMA "'+names.schema+'" CASCADE','DROP ROLE "'+names.runtimeRole+'"','DROP ROLE "'+names.ownerRole+'"']);
  assert.deepEqual(f.attempts.at(-1).parameters,[names.schema,names.runtimeRole,names.ownerRole]);
});
test('cleanup dependency errors propagate and no partial cleanup commits',async()=>{
  const f=fixture({failRole:true});await assert.rejects(cleanupFixtureAuthority(f.db,names,all),/role dependency/);assert.deepEqual(f.committed,[]);
});
test('cleanup cannot report success when a catalog object remains',async()=>{
  const f=fixture({remaining:[{kind:'role',name:names.ownerRole}]});await assert.rejects(cleanupFixtureAuthority(f.db,names,all),/verification failed/);
});
test('partial setup cleans only acknowledged objects and absent setup issues no SQL',async()=>{
  const f=fixture();await cleanupFixtureAuthority(f.db,names,{schema:false,owner:true,runtime:false});assert.deepEqual(f.committed,['DROP ROLE "'+names.ownerRole+'"']);
  const empty=fixture();await cleanupFixtureAuthority(empty.db,names,{schema:false,owner:false,runtime:false});assert.deepEqual(empty.attempts,[]);
});
test('cleanup refuses unsafe or mismatched fixture identifiers before SQL',async()=>{
  for(const patch of [{schema:'public'},{ownerRole:'postgres'},{runtimeRole:names.runtimeRole+'x'}]){const f=fixture();await assert.rejects(cleanupFixtureAuthority(f.db,{...names,...patch},all),/non-generated/);assert.deepEqual(f.attempts,[]);}
});
test('lock readiness succeeds while the real holder remains open',async()=>{
  let release;const work=new Promise(resolve=>{release=resolve;});await awaitFixtureAuthorityLock(work,Promise.resolve(),100);release();await work;
});
test('lock readiness observes holder failure or premature completion without hanging',async()=>{
  const pending=new Promise(()=>{});await assert.rejects(awaitFixtureAuthorityLock(Promise.reject(Error('lock denied')),pending,100),/lock denied/);await assert.rejects(awaitFixtureAuthorityLock(Promise.resolve(),pending,100),/ended before readiness/);
});
test('lock readiness is bounded and rejects unsafe timeout configuration',async()=>{
  const pending=new Promise(()=>{});await assert.rejects(awaitFixtureAuthorityLock(pending,pending,5),/timed out/);for(const timeout of [0,-1,30001,NaN])await assert.rejects(awaitFixtureAuthorityLock(pending,pending,timeout),/Invalid fixture lock timeout/);
});
