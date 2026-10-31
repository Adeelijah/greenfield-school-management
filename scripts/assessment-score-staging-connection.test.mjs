import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import * as policy from '../src/lib/academics/assessment-score-staging-policy.ts';
import * as lifecycle from '../src/lib/academics/report-card-staging-pool.ts';
async function fixture(work){
 const state={ca:'-----BEGIN CERTIFICATE-----\nfixture',clients:[],queries:[],fail:false},token=randomUUID(),symbol=Symbol.for(token),slot=Symbol.for('greenfield.local-staging.assessment-score-pool.v1');
 const previousPool=globalThis[slot];delete globalThis[slot];globalThis[symbol]=state;
 const env={NODE_ENV:'development',GREENFIELD_STAGING_UI:'LOCAL_STAGING_REPORTS_ONLY',GREENFIELD_STAGING_ASSESSMENT_SCORES:'FICTIONAL_STAGING_SCORE_WRITES_ONLY',NEXT_PUBLIC_SUPABASE_URL:'https://hweoqkbgmzycyznrbvng.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_test',GREENFIELD_STAGING_ASSESSMENT_SCORE_DATABASE_URL:'postgresql://greenfield_assessment_app.hweoqkbgmzycyznrbvng:fixture@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',GREENFIELD_STAGING_DB_CA_FILE:'fixture-ca'};
 const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);
 state.policy=policy;state.lifecycle=lifecycle;state.driver=(url,options)=>{
  const client={url,options,closed:0,commits:0,rollbacks:0,async end(){this.closed++;},async begin(callback){try{const value=await callback({unsafe:async(query)=>{state.queries.push(query);if(query==='SELECT test'&&state.pending)await state.pending;if(state.fail&&query==='SELECT test')throw Object.assign(Error('private detail'),{code:'XX000'});return[{value:1}];}});this.commits++;return value;}catch(e){this.rollbacks++;throw e;}}};state.clients.push(client);return client;
 };
 const context=`globalThis[Symbol.for(${JSON.stringify(token)})]`,url=new URL('../src/server/academics/assessment-score-staging-connection.ts',import.meta.url);url.searchParams.set('test',token);
 const mocks=new Map([['server-only','export {};'],['node:fs',`export const readFileSync=()=>${context}.ca;`],['postgres',`export default ${context}.driver;`],['@/lib/academics/assessment-score-staging-policy',`export const {assessmentScoreWritesEnabled,validAssessmentScoreDatabaseUrl}=${context}.policy;`],['@/lib/academics/report-card-staging-pool',`export const {createStagingPoolManager}=${context}.lifecycle;`]]),prefix='pool-test-'+token+':';
 const hooks=registerHooks({resolve(s,c,next){if(c.parentURL===url.href&&mocks.has(s))return{url:prefix+encodeURIComponent(s),shortCircuit:true};return next(s,c);},load(u,c,next){if(u===url.href){const f=new URL(u);f.search='';return{format:'module',source:stripTypeScriptTypes(readFileSync(f,'utf8')),shortCircuit:true};}if(u.startsWith(prefix))return{format:'module',source:mocks.get(decodeURIComponent(u.slice(prefix.length))),shortCircuit:true};return next(u,c);}});
 try{await work((await import(url.href)).getStagingAssessmentScoreDatabase,state);}finally{await globalThis[slot]?.retire();if(previousPool)globalThis[slot]=previousPool;else delete globalThis[slot];delete globalThis[symbol];hooks.deregister();for(const[k,v]of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;}
}
test('assessment-score adapter reuses bounded TLS transport but starts a new transaction and settings every call',()=>fixture(async(get,state)=>{
 const db=get();assert.throws(()=>db.unsafe('SELECT test'),/transaction/);assert.equal(state.clients.length,0);
 for(let i=0;i<2;i++)await db.begin(async tx=>assert.deepEqual(await tx.unsafe('SELECT test'),[{value:1}]));
 assert.equal(state.clients.length,1);const c=state.clients[0];assert.equal(c.commits,2);assert.equal(c.closed,0);assert.equal(c.options.max,2);assert.equal(c.options.prepare,false);assert.equal(c.options.ssl.rejectUnauthorized,true);assert.equal(c.options.idle_timeout,30);assert.equal(c.options.max_lifetime,300);assert.equal(state.queries.filter(q=>q.includes("set_config('lock_timeout','5s',true)")).length,2);
}));
test('assessment-score adapter expires SQL handles and retires failed transactions even when callback catches SQL error',()=>fixture(async(get,state)=>{
 const db=get();let saved;await db.begin(async tx=>{saved=tx;});const count=state.queries.length;await assert.rejects(saved.unsafe('SELECT test'),/Expired/);assert.equal(state.queries.length,count);
 state.fail=true;await assert.rejects(db.begin(async tx=>{try{await tx.unsafe('SELECT test');}catch{};}),/Incomplete/);assert.equal(state.clients[0].closed,1);assert.equal(state.clients[0].rollbacks,1);
 state.fail=false;await db.begin(async tx=>tx.unsafe('SELECT test'));assert.equal(state.clients.length,2);
}));
test('assessment-score adapter rejects stale configuration and rotates transport for changed CA bytes',()=>fixture(async(get,state)=>{
 const old=get();await old.begin(async()=>{});state.ca+='\nrotated';await assert.rejects(old.begin(async()=>{}),/configuration changed/);assert.equal(state.clients[0].commits,1);
 await get().begin(async()=>{});assert.equal(state.clients.length,2);assert.equal(state.clients[0].closed,1);assert.equal(state.clients[1].options.ssl.ca,state.ca);
 const current=get();process.env.GREENFIELD_STAGING_UI='';assert.throws(get,/disabled/);await assert.rejects(current.begin(async()=>{}),/configuration changed/);
}));

test('assessment-score adapter rejects outstanding SQL and callback failures before a successful commit',()=>fixture(async(get,state)=>{
 const db=get();let release;state.pending=new Promise(r=>{release=r;});let outstanding;
 await assert.rejects(db.begin(async tx=>{outstanding=tx.unsafe('SELECT test');}),/Incomplete/);assert.equal(state.clients[0].rollbacks,1);assert.equal(state.clients[0].commits,0);release();await outstanding;delete state.pending;
 const error=Error('callback');await assert.rejects(db.begin(async()=>{throw error;}),e=>e===error);assert.equal(state.clients[1].closed,1);
}));
