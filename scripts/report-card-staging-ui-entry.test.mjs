// Real new server entry files, controlled framework/SDK/SQL boundaries only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as policy from '../src/lib/academics/report-card-staging-ui.ts';
const schoolId=policy.stagingSchoolId, id='00000000-0000-4000-8000-000000000001';
const env={NODE_ENV:'development',GREENFIELD_STAGING_UI:'LOCAL_STAGING_REPORTS_ONLY',NEXT_PUBLIC_SUPABASE_URL:policy.stagingProjectUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_test',GREENFIELD_STAGING_COMMANDS:'FICTIONAL_STAGING_WRITES_ONLY'};
async function withEnv(work,changes={}){const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env,changes);try{return await work();}finally{for(const[k,v]of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;}}
function form(extra={}){const f=new FormData();for(const[k,v]of Object.entries({action:'submit',operationKey:'intent',reportId:id,expectedVersion:'1',...extra}))f.append(k,v);return f;}
async function load(path,state){
 const token=randomUUID(),key='greenfield-staging-ui-'+token;globalThis[Symbol.for(key)]=state;
 const context=`globalThis[Symbol.for(${JSON.stringify(key)})]`,url=new URL('../'+path,import.meta.url);url.searchParams.set('test',token);
 const mocks=new Map([
  ['server-only','export {};'],
  ['next/cache',`export function revalidatePath(p){${context}.events.push(['revalidate',p]);}`],
  ['next/navigation',`export function redirect(p){throw Object.assign(new Error('redirect'),{destination:p});} export function notFound(){throw Object.assign(new Error('not-found'),{notFound:true});}`],
  ['next/server',`export const NextResponse=${context}.Response;`],
  ['@supabase/ssr',`export function createServerClient(u,k,o){return ${context}.createClient(u,k,o);}`],
  ['@/lib/supabase/server',`export async function createSupabaseServerClient(){${context}.events.push(['sdk']);return ${context}.client;}`],
  ['@/server/academics/report-card-staging-connection',`export const localStagingRuntimeConfig={schoolId:${JSON.stringify(schoolId)}};export function getLocalStagingDatabase(){${context}.events.push(['db-config']);return {};}`],
  ['@/server/academics/report-card-staging-commands',`export function createVerifiedStagingReportCommands(){return async command=>{${context}.events.push(['command',command]);return ${context}.outcome;};}`],
  ['@/server/auth/report-card-identity',`export async function resolveVerifiedReportCardIdentity(){return ${context}.identity;}`],
  ['@/lib/academics/report-card-staging-runtime',`export function createStagingReportRuntime(){return {};}`],
  ['@/lib/academics/report-card-sql-scope',`export function stagingReportSqlScope(){return {};}`],
  ['@/lib/academics/report-card-request-command',`export const isReportCardUuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);`],
  ['@/lib/academics/assessment-postgres-canonical-reader',`export async function readVerifiedCanonicalAssessmentInScope(){${context}.events.push(['verified-source']);return ${context}.source;}`],
  ['@/lib/academics/report-card-staging-command-boundary',`export async function executeStagingReportBoundary(_runtime,_identity,work){${context}.events.push(['locked-boundary']);if(${context}.denied)return{ok:false,code:'forbidden'};return work({begin:callback=>callback({unsafe:${context}.query})},async()=>({authUserId:'verified'}),{role:${context}.lockedRole});}`],
 ]);
 const prefix='greenfield-ui-test-'+token+':';
 const hooks=registerHooks({resolve(s,c,next){if(c.parentURL!==url.href)return next(s,c);if(s==='@/lib/academics/report-card-staging-ui')return{url:new URL('../src/lib/academics/report-card-staging-ui.ts',import.meta.url).href,shortCircuit:true};if(mocks.has(s))return{url:prefix+encodeURIComponent(s),shortCircuit:true};throw Error('Unexpected UI entry dependency: '+s);},load(u,c,next){if(u===url.href){const file=new URL(u);file.search='';return{format:'module',source:stripTypeScriptTypes(readFileSync(file,'utf8')),shortCircuit:true};}if(u.startsWith(prefix))return{format:'module',source:mocks.get(decodeURIComponent(u.slice(prefix.length))),shortCircuit:true};return next(u,c);}});
 try{return{module:await import(url.href),close(){hooks.deregister();delete globalThis[Symbol.for(key)];}};}catch(e){hooks.deregister();delete globalThis[Symbol.for(key)];throw e;}
}
test('actual server action checks both gates and closed form before connection configuration or dispatch',async()=>{
 const state={events:[],outcome:{ok:false,code:'forbidden'}},f=await load('src/app/staging/report-cards/actions.ts',state);
 try{await withEnv(async()=>{
  assert.deepEqual(await f.module.runStagingReportCommand(null,form()),{ok:false,code:'forbidden'});assert.deepEqual(state.events,[]);
 },{GREENFIELD_STAGING_COMMANDS:''});
 await withEnv(async()=>{assert.deepEqual(await f.module.runStagingReportCommand(null,form({schoolId})),{ok:false,code:'invalid'});assert.deepEqual(state.events,[]);});
 }finally{f.close();}
});
test('actual server action preserves replay keys, returns bounded outcomes and invalidates only successful reports',async()=>{
 const state={events:[],outcome:{ok:false,code:'forbidden'}},f=await load('src/app/staging/report-cards/actions.ts',state);
 try{await withEnv(async()=>{
  assert.deepEqual(await f.module.runStagingReportCommand(null,form()),state.outcome);assert.equal(state.events.some(e=>e[0]==='revalidate'),false);
  state.events=[];state.outcome={ok:true,kind:'replay',action:'submit',reportId:id,version:2,stage:'submitted'};
  assert.deepEqual(await f.module.runStagingReportCommand(null,form()),state.outcome);
  assert.equal(state.events.find(e=>e[0]==='command')[1].operationKey,'intent');assert.deepEqual(state.events.at(-1),['revalidate','/staging/report-cards']);
 });}finally{f.close();}
});
test('actual staging login denies disabled routes before SDK and never accepts an arbitrary return URL',async()=>{
 const state={events:[],client:{auth:{async signInWithPassword(){return{error:null};},async getUser(){return{data:{user:{id}},error:null};}}}},f=await load('src/app/staging/login/actions.ts',state);
 try{
  await withEnv(async()=>{await assert.rejects(f.module.signInToStaging(form()),e=>e.notFound===true);assert.deepEqual(state.events,[]);},{GREENFIELD_STAGING_UI:''});
  await withEnv(async()=>{const login=new FormData();login.set('email','test@example.invalid');login.set('password','local-only');login.set('next','https://foreign.invalid');await assert.rejects(f.module.signInToStaging(login),e=>e.destination==='/staging/report-cards');});
 }finally{f.close();}
});
class Response{
 constructor(_body,{status=200,headers={}}={}){this.status=status;this.headers=new Headers(headers);const values=new Map();this.cookies={getAll:()=>[...values.values()],set:(first,value,options={})=>{const c=typeof first==='string'?{name:first,value,...options}:first;values.set(c.name,c);}};}
 static next(){return new Response();}static redirect(url){const r=new Response(null,{status:307});r.destination=url.pathname;return r;}
}
const request=path=>{const nextUrl=new URL('http://localhost:3000'+path);nextUrl.clone=()=>new URL(nextUrl);return{nextUrl,cookies:{getAll:()=>[],set(){}}};};
test('actual staging proxy returns disabled 404 without SDK and preserves refreshed cookies on fixed redirects',async()=>{
 const state={Response,createClient(_u,_k,options){return{auth:{async getUser(){options.cookies.setAll([{name:'refreshed',value:'test-cookie',options:{httpOnly:true}}]);return{data:{user:null},error:null};}}};}},f=await load('src/lib/supabase/staging-proxy.ts',state);
 try{
  await withEnv(async()=>{assert.equal((await f.module.stagingProxy(request('/staging/report-cards'))).status,404);},{NODE_ENV:'production'});
  await withEnv(async()=>{const r=await f.module.stagingProxy(request('/staging/report-cards'));assert.equal(r.destination,'/staging/login');assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(r.cookies.getAll(),[{name:'refreshed',value:'test-cookie',httpOnly:true}]);});
 }finally{f.close();}
});
test('actual staging proxy verifies the user and redirects signed-in login requests to the staging workspace',async()=>{
 let verified=0;const state={Response,createClient(){return{auth:{async getUser(){verified++;return{data:{user:{id}},error:null};}}};}},f=await load('src/lib/supabase/staging-proxy.ts',state);
 try{await withEnv(async()=>{assert.equal((await f.module.stagingProxy(request('/staging/login'))).destination,'/staging/report-cards');assert.equal(verified,1);});}finally{f.close();}
});
function workspaceState(){
 const selector=policy.stagingSelector('primary5');
 const state={events:[],identity:{schoolId,role:'admin'},lockedRole:'teacher',denied:false,
  source:{ok:true,input:{scope:{revision:2},roster:[{}],enrollments:[{id,studentId:id,classId:selector.classId,status:'active'}]}},
  reports:[],releases:[]};
 state.query=async sql=>{state.events.push(['sql',sql]);assert.doesNotMatch(sql,/^(INSERT|UPDATE|DELETE|TRUNCATE)/);
  if(sql.includes('public.students'))return[{firstName:'Fixture',lastName:'Pupil'}];
  if(sql.includes('public.report_cards'))return state.reports;
  if(sql.includes('public.report_card_releases'))return state.releases;
  throw Error('Unexpected workspace read');};
 return state;
}
test('actual workspace denies missing/foreign identity and boundary rejection before any pupil or report read',async()=>{
 for(const mutation of ['missing','foreign','boundary']){
  const state=workspaceState();if(mutation==='missing')state.identity=null;if(mutation==='foreign')state.identity.schoolId=id;if(mutation==='boundary')state.denied=true;
  const f=await load('src/server/academics/report-card-staging-workspace.ts',state);
  try{await withEnv(async()=>{assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'forbidden'});assert.equal(state.events.some(e=>e[0]==='sql'),false);});}finally{f.close();}
 }
});
test('actual workspace uses verified source and refreshed role, and rejects report/enrollment substitution',async()=>{
 const state=workspaceState(),f=await load('src/server/academics/report-card-staging-workspace.ts',state);
 try{await withEnv(async()=>{
  const success=await f.module.readLocalStagingWorkspace('primary5');assert.equal(success.ok,true);assert.equal(success.workspace.role,'teacher');assert.equal(success.workspace.pupils[0].label,'Fixture Pupil');
  assert.ok(state.events.findIndex(e=>e[0]==='locked-boundary')<state.events.findIndex(e=>e[0]==='sql'));
  state.reports=[{reportId:id,studentId:'00000000-0000-4000-8000-000000000002',enrollmentId:id,version:1,stage:'draft',returnReason:null}];
  assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'unavailable'});
 });}finally{f.close();}
});
test('actual workspace fails closed on an unverified source and conflicting live releases',async()=>{
 const state=workspaceState(),f=await load('src/server/academics/report-card-staging-workspace.ts',state);
 try{await withEnv(async()=>{
  const source=state.source;state.source={ok:false,code:'stale_source'};
  assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'unavailable'});assert.equal(state.events.some(e=>e[0]==='sql'),false);
  state.source=source;state.reports=[{reportId:id,studentId:id,enrollmentId:id,version:4,stage:'published',returnReason:null}];state.releases=[{id},{id}];
  assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'unavailable'});
 });}finally{f.close();}
});
