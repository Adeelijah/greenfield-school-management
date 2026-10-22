// Executes the actual server bridge with intercepted SDK/driver imports only.
// No application database module, Supabase client, environment or service loads.
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';

const bridgeURL = new URL('../src/server/auth/report-card-identity.ts', import.meta.url).href;
const decoderURL = new URL('../src/lib/academics/report-card-actor-authority.ts', import.meta.url).href;
const key = Symbol.for('greenfield.report-card-identity.offline-test');
const row = {auth_user_id:'verified-auth',school_user_id:'school-user',membership_id:'membership',school_id:'school',role:'teacher',status:'active',final_primary_year:5,school_user_count:1,active_membership_count:1};
let state;
function reset() {
  state = {events:[],queries:[],auth:{data:{user:{id:row.auth_user_id}},error:null},rpc:{data:[{...row}],error:null},results:[[{...row}]]};
  const tx = {execute:async query=>{state.events.push('query');state.queries.push(query);if(state.queryError)throw state.queryError;return state.results.shift() ?? [];}};
  state.tx = tx;
  globalThis[key] = {
    client:async()=>{
      if(state.clientError)throw state.clientError;
      return {auth:{getUser:async()=>{state.events.push('getUser');if(state.authError)throw state.authError;return state.auth;}},rpc:async(...args)=>{state.events.push(['rpc',...args]);if(state.rpcError)throw state.rpcError;return state.rpc;}};
    },
    database:()=>{
      state.events.push('database');if(state.databaseError)throw state.databaseError;
      return {transaction:async work=>{state.events.push('begin');try{const result=await work(tx);state.events.push('commit');return result;}catch(error){state.events.push('rollback');throw error;}}};
    },
  };
}
reset();
const mocks = new Map([
  ['server-only','export {};'],
  ['drizzle-orm','export function sql(strings,...values){return {text:strings.join("?"),values};}'],
  ['@/lib/supabase/server','export const createSupabaseServerClient=()=>globalThis[Symbol.for("greenfield.report-card-identity.offline-test")].client();'],
  ['@/db/client','export const getDatabase=()=>globalThis[Symbol.for("greenfield.report-card-identity.offline-test")].database();'],
]);
const hooks = registerHooks({
  resolve(specifier,context,nextResolve) {
    if(context.parentURL===bridgeURL) {
      if(mocks.has(specifier))return {url:'greenfield-offline:'+encodeURIComponent(specifier),shortCircuit:true};
      if(specifier==='@/lib/academics/report-card-actor-authority')return {url:decoderURL,shortCircuit:true};
      throw Error('Unexpected server bridge dependency: '+specifier);
    }
    if(context.parentURL===decoderURL)throw Error('Unexpected authority decoder dependency: '+specifier);
    return nextResolve(specifier,context);
  },
  load(url,context,nextLoad) {
    if(url.startsWith('greenfield-offline:'))return {format:'module',source:mocks.get(decodeURIComponent(url.slice('greenfield-offline:'.length))),shortCircuit:true};
    if(url===bridgeURL||url===decoderURL)return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8')),shortCircuit:true};
    return nextLoad(url,context);
  },
});
let bridge;
try { bridge = await import(bridgeURL); } catch(error) { hooks.deregister(); throw error; }
beforeEach(reset);
after(()=>{hooks.deregister();delete globalThis[key];});

test('actual bridge verifies getUser before zero-argument RPC and returns frozen distinct identifiers',async()=>{
  const identity=await bridge.resolveVerifiedReportCardIdentity();
  assert.ok(identity);assert.equal(Object.isFrozen(identity),true);
  assert.deepEqual(state.events,['getUser',['rpc','resolve_report_card_actor']]);
  assert.deepEqual([identity.authUserId,identity.schoolUserId,identity.membershipId,identity.schoolId],['verified-auth','school-user','membership','school']);
});

test('missing, rejected or throwing authentication denies before RPC or database lookup',async()=>{
  for(const patch of [{auth:{data:{user:null},error:null}},{auth:{data:{user:{id:row.auth_user_id}},error:{message:'expired'}}},{authError:Error('provider detail')},{clientError:Error('client detail')}]) {
    reset();Object.assign(state,patch);assert.equal(await bridge.resolveVerifiedReportCardIdentity(),null);
    assert.equal(state.events.some(event=>Array.isArray(event)||event==='database'),false);
  }
});

test('RPC errors, ambiguous memberships and cross-actor evidence fail closed',async()=>{
  for(const patch of [{rpcError:Error('private provider detail')},{rpc:{data:[row],error:{message:'denied'}}},{rpc:{data:[row,row],error:null}},{rpc:{data:[{...row,auth_user_id:'foreign'}],error:null}},{rpc:{data:[{...row,active_membership_count:2}],error:null}}]) {
    reset();Object.assign(state,patch);assert.equal(await bridge.resolveVerifiedReportCardIdentity(),null);assert.equal(state.events.includes('database'),false);
  }
});

test('unbranded or JSON-round-tripped identities cannot invoke transaction authority lookup',async()=>{
  const identity=await bridge.resolveVerifiedReportCardIdentity();
  for(const value of [null,{...row},JSON.parse(JSON.stringify(identity))])assert.equal(await bridge.resolveReportCardActorInTransaction(state.tx,value),null);
  assert.deepEqual(state.queries,[]);
});

test('transaction refresh uses current locked role/configuration and parameterizes only verified auth ID',async()=>{
  const identity=await bridge.resolveVerifiedReportCardIdentity();
  state.results=[{rows:[{...row,role:'admin',final_primary_year:6}]}];
  const current=await bridge.resolveReportCardActorInTransaction(state.tx,identity);
  assert.equal(current.role,'admin');assert.equal(current.finalPrimaryYear,6);
  assert.match(state.queries[0].text,/public\.lock_report_card_actor\(\?::uuid\)/);assert.deepEqual(state.queries[0].values,[row.auth_user_id]);
});

test('transaction refresh refuses cross-school or principal rebinding within a request',async()=>{
  const identity=await bridge.resolveVerifiedReportCardIdentity();
  for(const patch of [{school_id:'foreign-school'},{school_user_id:'replacement-user'},{membership_id:'replacement-member'}]) {
    state.results=[[{...row,...patch}]];
    assert.equal(await bridge.resolveReportCardActorInTransaction(state.tx,identity),null);
  }
});

test('transaction authority rejects suspension, incomplete evidence, malformed driver results and SQL errors',async()=>{
  const identity=await bridge.resolveVerifiedReportCardIdentity();
  for(const result of [[{...row,status:'suspended'}],[{...row,school_user_count:2}],{rows:'encoded'},null,[]]) {
    state.results=[result];assert.equal(await bridge.resolveReportCardActorInTransaction(state.tx,identity),null);
  }
  state.queryError=Error('private SQL detail');assert.equal(await bridge.resolveReportCardActorInTransaction(state.tx,identity),null);
});

test('teacher assignment check binds school/member/class/session, requires exactly one active row and fails on SQL error',async()=>{
  const authority={authUserId:row.auth_user_id,schoolUserId:row.school_user_id,membershipId:row.membership_id,schoolId:row.school_id,role:'teacher',status:'active',finalPrimaryYear:5};
  for(const [result,expected] of [[[{id:'assignment'}],true],[{rows:[{id:'assignment'}]},true],[[],false],[[{id:'a'},{id:'b'}],false],[{rows:null},false]]) {
    state.results=[result];assert.equal(await bridge.hasCurrentReportCardAssignment(state.tx,authority,'class','session'),expected);
  }
  assert.deepEqual(state.queries[0].values,['school','membership','class','session']);
  assert.match(state.queries[0].text,/ended_at is null\s+for share/);
  state.queryError=Error('private SQL detail');assert.equal(await bridge.hasCurrentReportCardAssignment(state.tx,authority,'class','session'),false);
});

test('admin needs no teacher assignment while invalid selectors and inactive actors deny',async()=>{
  const authority={role:'admin',status:'active'};
  assert.equal(await bridge.hasCurrentReportCardAssignment(state.tx,authority,'class','session'),true);
  assert.equal(await bridge.hasCurrentReportCardAssignment(state.tx,authority,'','session'),false);
  assert.equal(await bridge.hasCurrentReportCardAssignment(state.tx,{...authority,status:'suspended'},'class','session'),false);
  assert.equal(await bridge.hasCurrentReportCardAssignment(state.tx,{...authority,role:'bursar'},'class','session'),false);
  assert.deepEqual(state.queries,[]);
});

test('runner never calls report work after failed request or locked authority checks',async()=>{
  let workCalls=0;
  state.auth={data:{user:null},error:null};
  assert.equal(await bridge.withVerifiedReportCardActorTransaction(()=>{workCalls++;}),null);assert.equal(state.events.includes('database'),false);
  for (const rows of [[],[{...row,school_id:'foreign-school'}],[{...row,membership_id:'replacement'}]]) {
    reset();state.results=[rows];
    assert.equal(await bridge.withVerifiedReportCardActorTransaction(()=>{workCalls++;}),null);assert.equal(workCalls,0);
  }
});

test('runner passes the same transaction/current authority to work and rolls back a thrown work failure',async()=>{
  state.results=[[{...row,role:'admin'}]];
  assert.equal(await bridge.withVerifiedReportCardActorTransaction(async(tx,authority)=>{assert.equal(tx,state.tx);assert.equal(authority.role,'admin');return 'result';}),'result');
  assert.deepEqual(state.events.slice(-4),['database','begin','query','commit']);
  reset();assert.equal(await bridge.withVerifiedReportCardActorTransaction(async()=>{throw Error('work failed');}),null);
  assert.equal(state.events.at(-1),'rollback');
});
