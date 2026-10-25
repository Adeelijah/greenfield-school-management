// Real new server entry files, controlled framework/SDK/SQL boundaries only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as academicPages from '../src/lib/accounts/staging-academic-pages.ts';
import { projectStagingDashboard } from '../src/lib/accounts/staging-dashboard.ts';
import { decodeStagingStaffAccount } from '../src/lib/academics/staging-staff-account.ts';
import * as policy from '../src/lib/academics/report-card-staging-ui.ts';
import * as approvedPolicy from '../src/lib/academics/report-card-approved-view.ts';
import { fixtureAssessmentDecoders } from '../src/lib/academics/assessment-postgres-fixture-source-reader.ts';
import { createApprovedSnapshotFixture } from '../src/lib/academics/report-card-canonical-test-fixtures.ts';
import { buildApprovedReportSnapshot } from '../src/lib/academics/report-card-approved-snapshot.ts';
import { materializeAssessmentSource } from '../src/lib/academics/assessment-canonical-source.ts';
const schoolId=policy.stagingSchoolId, id='00000000-0000-4000-8000-000000000001';
const env={NODE_ENV:'development',GREENFIELD_STAGING_UI:'LOCAL_STAGING_REPORTS_ONLY',NEXT_PUBLIC_SUPABASE_URL:policy.stagingProjectUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_test',GREENFIELD_STAGING_COMMANDS:'FICTIONAL_STAGING_WRITES_ONLY'};
async function withEnv(work,changes={}){const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env,changes);try{return await work();}finally{for(const[k,v]of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;}}
function form(extra={}){const f=new FormData();for(const[k,v]of Object.entries({action:'submit',operationKey:'intent',reportId:id,expectedVersion:'1',...extra}))f.append(k,v);return f;}
async function load(path,state){
 state.academicPages=academicPages;state.dashboardProjection=projectStagingDashboard;state.staffDecoder=decodeStagingStaffAccount;state.decoders=fixtureAssessmentDecoders;state.approvedPolicy=approvedPolicy;
 const token=randomUUID(),key='greenfield-staging-ui-'+token;globalThis[Symbol.for(key)]=state;
 const context=`globalThis[Symbol.for(${JSON.stringify(key)})]`,url=new URL('../'+path,import.meta.url);url.searchParams.set('test',token);
 const mocks=new Map([
  ['server-only','export {};'],
  ['@/lib/accounts/staging-academic-pages',`export const canOpenAcademicPage=${context}.academicPages.canOpenAcademicPage;`],
  ['@/server/accounts/staging-staff-account',`export async function readStagingStaffAccount(){${context}.events.push(['staff-role']);return ${context}.staffRole;}`],
  ['@/server/accounts/staging-dashboard',`export async function readStagingDashboard(role){${context}.events.push(['academic-data',role]);return ${context}.dashboard;}`],
  ['@/lib/accounts/staging-dashboard',`export const projectStagingDashboard=${context}.dashboardProjection;`],
  ['@/server/academics/report-card-staging-workspace',`export const readLocalStagingWorkspace=choice=>${context}.readWorkspace(choice);`],
  ['@/lib/supabase/staging-proxy',`export const stagingProxy=request=>${context}.delegate(request);`],
  ['@/lib/academics/staging-staff-account',`export const decodeStagingStaffAccount=${context}.staffDecoder;`],
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
  ['@/lib/academics/assessment-postgres-fixture-source-reader',`export const fixtureAssessmentDecoders=${context}.decoders;`],
  ['@/lib/academics/report-card-approved-view',`export const verifyApprovedResultView=${context}.approvedPolicy.verifyApprovedResultView;`],
  ['@/lib/academics/report-card-staging-command-boundary',`export async function executeStagingReportBoundary(_runtime,_identity,work){${context}.events.push(['locked-boundary']);if(${context}.denied)return{ok:false,code:'forbidden'};return work({begin:callback=>callback({unsafe:${context}.query})},async()=>({authUserId:'verified'}),{role:${context}.lockedRole,membershipId:'teacher',finalPrimaryYear:5});}`],
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
  await withEnv(async()=>{const login=new FormData();login.set('email','test@example.invalid');login.set('password','local-only');login.set('next','https://foreign.invalid');await assert.rejects(f.module.signInToStaging(login),e=>e.destination==='/staging/dashboard');});
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
 try{await withEnv(async()=>{assert.equal((await f.module.stagingProxy(request('/staging/login'))).destination,'/staging/dashboard');assert.equal(verified,1);});}finally{f.close();}
});
function workspaceState(){
 const selector=policy.stagingSelector('primary5');
 const state={events:[],identity:{schoolId,role:'admin'},lockedRole:'teacher',denied:false,
  assignments:[{id}],scope:{scopeId:id,schoolId,...selector,revision:2,stage:'primary',primaryYear:5,levelActive:true,sectionActive:true,sessionStartsOn:'2026-09-01',sessionEndsOn:'2027-07-31',termStartsOn:'2026-09-01',termEndsOn:'2026-12-18'},
  enrollments:[{id,studentId:id,schoolId,classId:selector.classId,sessionId:selector.sessionId,status:'active'}],roster:[{id,subjectId:id}],
  reports:[],releases:[]};
 state.query=async (sql,params)=>{state.events.push(['sql',sql,params]);assert.doesNotMatch(sql,/^(INSERT|UPDATE|DELETE|TRUNCATE)/);
  if(sql.includes('FROM public.teacher_class_assignments'))return state.assignments;
  if(sql.includes('FROM public.assessment_scopes'))return state.scope?[state.scope]:[];
  if(sql.includes('FROM public.enrollments'))return state.enrollments;
  if(sql.includes('FROM public.assessment_subject_roster'))return state.roster;
  if(sql.includes('public.students'))return state.labels??[{id,schoolId,status:'active',firstName:'Fixture',lastName:'Pupil'}];
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
test('actual index uses refreshed role and scoped placement, and rejects report/enrollment substitution',async()=>{
 const state=workspaceState(),f=await load('src/server/academics/report-card-staging-workspace.ts',state);
 try{await withEnv(async()=>{
  const success=await f.module.readLocalStagingWorkspace('primary5');assert.equal(success.ok,true);assert.equal(success.workspace.role,'teacher');assert.equal(success.workspace.pupils[0].label,'Fixture Pupil');
  assert.ok(state.events.findIndex(e=>e[0]==='locked-boundary')<state.events.findIndex(e=>e[0]==='sql'));
  state.reports=[{reportId:id,studentId:'00000000-0000-4000-8000-000000000002',enrollmentId:id,version:1,stage:'draft',returnReason:null}];
  assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'unavailable'});
 });}finally{f.close();}
});
test('actual index permits current admin without requiring a teacher assignment',async()=>{
 const state=workspaceState();state.lockedRole='admin';
 const f=await load('src/server/academics/report-card-staging-workspace.ts',state);
 try{await withEnv(async()=>{
  const result=await f.module.readLocalStagingWorkspace('primary5');
  assert.equal(result.ok,true);assert.equal(result.workspace.role,'admin');assert.equal(result.workspace.pupils.length,1);
  assert.equal(state.events.some(e=>e[0]==='sql'&&e[1].includes('teacher_class_assignments')),false);
 });}finally{f.close();}
});
test('actual index fails closed on missing scope metadata and conflicting live releases',async()=>{
 const state=workspaceState(),f=await load('src/server/academics/report-card-staging-workspace.ts',state);
 try{await withEnv(async()=>{
  const scope=state.scope;state.scope=null;
  assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'unavailable'});assert.equal(state.events.some(e=>e[0]==='sql'&&e[1].includes('public.students')),false);
  state.scope=scope;state.reports=[{reportId:id,studentId:id,enrollmentId:id,version:4,stage:'published',returnReason:null}];state.releases=[{id,reportId:id},{id,reportId:id}];
  assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'unavailable'});
 });}finally{f.close();}
});
test('index uses seven scoped reads for three pupils/reports without any grade-source discovery',async()=>{
 const state=workspaceState(),selector=policy.stagingSelector('primary5');
 const ids=[id,'00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
 state.enrollments=ids.map(id=>({id,studentId:id,schoolId,sessionId:selector.sessionId,classId:selector.classId,status:'active'}));
 state.labels=ids.map((id,i)=>({id,schoolId,status:'active',firstName:'Fixture',lastName:'Pupil '+i}));
 state.reports=ids.map(id=>({reportId:id,studentId:id,enrollmentId:id,version:1,stage:'draft',returnReason:null}));
 const f=await load('src/server/academics/report-card-staging-workspace.ts',state);
 try{await withEnv(async()=>{const r=await f.module.readLocalStagingWorkspace('primary5');assert.equal(r.ok,true);assert.equal(r.workspace.pupils.length,3);assert.equal(r.workspace.reports.length,3);const calls=state.events.filter(e=>e[0]==='sql');assert.equal(calls.length,7);assert.equal(calls.some(e=>/assessment_scores|assessment_finalizations|assessment_source_versions/.test(e[1])),false);assert.equal(state.events.some(e=>e[0]==='verified-source'),false);});}finally{f.close();}
});
test('batched reads reject duplicate/missing pupil labels and foreign live releases',async()=>{
 for(const mutation of ['labels','release']){
  const state=workspaceState();
  if(mutation==='labels')state.labels=[];
  else{state.reports=[{reportId:id,studentId:id,enrollmentId:id,version:1,stage:'draft',returnReason:null}];state.releases=[{id,reportId:'foreign'}];}
  const f=await load('src/server/academics/report-card-staging-workspace.ts',state);
  try{await withEnv(async()=>assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'unavailable'}));}finally{f.close();}
 }
});
test('index rejects ended/ambiguous teacher assignments before scope or pupil discovery',async()=>{
 for(const assignments of [[],[{id},{id}]]){
  const state=workspaceState();state.assignments=assignments;
  const f=await load('src/server/academics/report-card-staging-workspace.ts',state);
  try{await withEnv(async()=>{assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'forbidden'});assert.equal(state.events.filter(e=>e[0]==='sql').length,1);});}finally{f.close();}
 }
});
test('index rejects foreign scope, inactive structure, invalid progression and term/session dates',async()=>{
 for(const mutation of [{schoolId:id},{classId:id},{sessionId:id},{termId:id},{revision:0},{revision:'2'},{levelActive:false},{sectionActive:false},{stage:'secondary'},{primaryYear:6},{primaryYear:null},{termStartsOn:'2026-02-30'},{termStartsOn:'2026-08-01'},{termEndsOn:'2028-01-01'},{sessionEndsOn:'2025-01-01'}]){
  const state=workspaceState();Object.assign(state.scope,mutation);
  const f=await load('src/server/academics/report-card-staging-workspace.ts',state);
  try{await withEnv(async()=>{assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'unavailable'});assert.equal(state.events.some(e=>e[0]==='sql'&&e[1].includes('FROM public.enrollments')),false);});}finally{f.close();}
 }
});
test('index does not conceal duplicate or cross-class active session enrollments',async()=>{
 for(const mutation of ['duplicate','other-class','foreign-school','other-session','withdrawn']){
  const state=workspaceState();const enrollment=state.enrollments[0];
  if(mutation==='duplicate')state.enrollments.push({...enrollment,id:'00000000-0000-4000-8000-000000000002'});
  else if(mutation==='other-class')enrollment.classId=id;
  else if(mutation==='foreign-school')enrollment.schoolId=id;
  else if(mutation==='other-session')enrollment.sessionId=id;
  else enrollment.status='withdrawn';
  const f=await load('src/server/academics/report-card-staging-workspace.ts',state);
  try{await withEnv(async()=>{assert.deepEqual(await f.module.readLocalStagingWorkspace('primary5'),{ok:false,code:'unavailable'});assert.equal(state.events.some(e=>e[0]==='sql'&&e[1].includes('public.students')),false);});}finally{f.close();}
 }
});
test('index allows an empty roster without claiming readiness, but denies invalid subject and student bindings',async()=>{
 for(const mutation of ['empty-roster','duplicate-roster','foreign-label','inactive-student']){
  const state=workspaceState();
  if(mutation==='empty-roster')state.roster=[];
  if(mutation==='duplicate-roster')state.roster.push({...state.roster[0]});
  if(mutation==='foreign-label')state.labels=[{id,schoolId:id,status:'active',firstName:'Fixture',lastName:'Pupil'}];
  if(mutation==='inactive-student')state.labels=[{id,schoolId,status:'withdrawn',firstName:'Fixture',lastName:'Pupil'}];
  const f=await load('src/server/academics/report-card-staging-workspace.ts',state);
  try{await withEnv(async()=>{const result=await f.module.readLocalStagingWorkspace('primary5');assert.equal(result.ok,mutation==='empty-roster');if(result.ok)assert.equal(result.workspace.subjectCount,0);});}finally{f.close();}
 }
});
function resultState(){
 const selector=policy.stagingSelector('primary5'),original=createApprovedSnapshotFixture();
 const replacements={school:schoolId,class:selector.classId,session:selector.sessionId,term:selector.termId,report:id,roster:'00000000-0000-4000-8000-000000000003'};
 const f=JSON.parse(JSON.stringify(original),(_k,v)=>typeof v==='string'?(replacements[v]??v):v);
 const built=materializeAssessmentSource(f.docs.input);assert.ok(built.ok);
 f.docs.source.sourceManifest=JSON.parse(built.materialized.manifest.canonicalJson);f.docs.source.contentHash=built.materialized.manifest.sha256;
 for(const final of f.docs.finals){const selected=built.materialized.subjects.find(s=>s.rosterId===final.rosterId);final.results=JSON.parse(selected.results.canonicalJson);final.contentHash=selected.results.sha256;}
 const approved=buildApprovedReportSnapshot(f.binding,f.docs);assert.ok(approved.ok);
 const state={events:[],identity:{schoolId},lockedRole:'admin',denied:false,assignment:true,report:{...f.binding,version:4,stage:'published'},
  snapshot:{id:'snapshot',schoolId,reportId:id,reportVersion:3,enrollmentId:f.binding.enrollmentId,assessmentScopeId:f.binding.assessmentScopeId,assessmentSourceVersionId:f.binding.assessmentSourceVersionId,assessmentRevision:f.binding.assessmentRevision,canonicalPayload:JSON.parse(approved.snapshot.canonicalJson),contentHash:approved.snapshot.sha256,sourceVersions:approved.snapshot.sourceVersions},
  source:f.docs.source,finals:f.docs.finals,reviews:f.docs.reviews,
  audit:{actorMembershipId:f.binding.approvedBy,snapshotId:'snapshot',snapshotReportVersion:3,afterVersion:3,occurredAt:f.binding.approvedAt},
  releases:[{id:'release',schoolId,reportId:id,reportVersion:4,snapshotId:'snapshot',snapshotReportVersion:3,revokedAt:null}]};
 state.query=async (sql,params)=>{state.events.push(['sql',sql,params]);assert.doesNotMatch(sql,/^(INSERT|UPDATE|DELETE|TRUNCATE)/);
  if(sql.includes('FROM public.report_cards'))return[state.report];
  if(sql.includes('FROM public.teacher_class_assignments'))return state.assignment?[{id:'assignment'}]:[];
  if(sql.includes('FROM public.assessment_teacher_subjects'))return state.snapshot.sourceVersions.map(v=>({rosterId:v.rosterId}));
  if(sql.includes('FROM public.report_card_snapshots'))return[state.snapshot];
  if(sql.includes('FROM public.assessment_source_versions'))return[state.source];
  if(sql.includes('WITH\n        locked_finals'))return state.evidence??[{finals:state.finals,reviews:state.reviews,audits:[state.audit],releases:state.releases,pupils:[{firstName:'Current',lastName:'Directory label'}]}];
  if(sql.includes('FROM public.assessment_teacher_reviews'))return state.reviews;
  if(sql.includes('FROM public.report_card_audit'))return[state.audit];
  if(sql.includes('FROM public.report_card_releases'))return state.releases;
  if(sql.includes('FROM public.students'))return[{firstName:'Current',lastName:'Directory label'}];
  throw Error('Unexpected approved result query');};return state;
}
test('actual approved reader reconstructs only the pinned old source and returns selected result plus current directory label',async()=>{
 for(const role of ['admin','teacher']){
  const state=resultState();state.lockedRole=role;const f=await load('src/server/academics/report-card-staging-result.ts',state);
  try{await withEnv(async()=>{const r=await f.module.readLocalStagingResult(id);assert.equal(r.ok,true);assert.equal(r.directoryName,'Current Directory label');assert.equal(r.view.subjects.length,1);assert.equal(r.view.approvedVersion,3);assert.equal(state.events.some(e=>e[0]==='sql'&&e[1].includes('assessment_scores')),false);});}finally{f.close();}
 }
});
test('actual approved reader denies missing identity, changed complete authority and ended teacher assignment before snapshot reads',async()=>{
 for(const change of ['identity','boundary','assignment']){
  const state=resultState();if(change==='identity')state.identity=null;if(change==='boundary')state.denied=true;if(change==='assignment'){state.lockedRole='teacher';state.assignment=false;}
  const f=await load('src/server/academics/report-card-staging-result.ts',state);
  try{await withEnv(async()=>{assert.deepEqual(await f.module.readLocalStagingResult(id),{ok:false,code:'forbidden'});assert.equal(state.events.some(e=>e[0]==='sql'&&e[1].includes('report_card_snapshots')),false);});}finally{f.close();}
 }
});
test('actual approved reader rejects withdrawn reports, substituted snapshots and revoked releases',async()=>{
 for(const change of ['withdrawn','snapshot','release']){
  const state=resultState();if(change==='withdrawn')state.report.stage='draft';if(change==='snapshot')state.snapshot.enrollmentId='substituted';if(change==='release')state.releases[0].revokedAt='2026-10-20T00:00:00Z';
  const f=await load('src/server/academics/report-card-staging-result.ts',state);
  try{await withEnv(async()=>{const r=await f.module.readLocalStagingResult(id);assert.equal(r.ok,false);});}finally{f.close();}
 }
});
test('actual approved reader denies a teacher without all pinned subject links before source document reads',async()=>{
 const state=resultState();state.lockedRole='teacher';
 state.snapshot.sourceVersions=[{rosterId:'00000000-0000-4000-8000-000000000003'}];
 const prior=state.query;state.query=sql=>sql.includes('FROM public.assessment_teacher_subjects')?Promise.resolve([]):prior(sql);
 const f=await load('src/server/academics/report-card-staging-result.ts',state);
 try{await withEnv(async()=>{assert.deepEqual(await f.module.readLocalStagingResult(id),{ok:false,code:'forbidden'});assert.equal(state.events.some(e=>e[0]==='sql'&&e[1].includes('assessment_source_versions')),false);});}finally{f.close();}
});

test('actual approved reader batches locked evidence without dropping verification or row cardinality',async()=>{
 const state=resultState(),f=await load('src/server/academics/report-card-staging-result.ts',state);
 try{await withEnv(async()=>{
  assert.equal((await f.module.readLocalStagingResult(id)).ok,true);
  const calls=state.events.filter(e=>e[0]==='sql');assert.equal(calls.length,4);
  const batch=calls.find(e=>e[1].includes('locked_finals'));assert.deepEqual(batch[2],[schoolId,state.report.assessmentScopeId,state.report.assessmentSourceVersionId,id,state.snapshot.id,3,state.report.studentId]);const sql=batch[1];assert.equal((sql.match(/FOR SHARE/g)??[]).length,5);assert.equal((sql.match(/AS MATERIALIZED/g)??[]).length,5);
  assert.match(sql,/school_id=\$1::uuid AND id=\$7::uuid/);
 });}finally{f.close();}
});
test('actual approved reader rejects malformed batched JSON and missing or duplicate approval evidence',async()=>{
 for(const change of ['encoded','missing-audit','duplicate-audit','missing-pupil','tampered-final']){
  const state=resultState();state.evidence=[{finals:state.finals,reviews:state.reviews,audits:[state.audit],releases:state.releases,pupils:[{firstName:'Current',lastName:'Directory label'}]}];const e=state.evidence[0];
  if(change==='encoded')e.finals=JSON.stringify(e.finals);if(change==='missing-audit')e.audits=[];if(change==='duplicate-audit')e.audits.push(state.audit);if(change==='missing-pupil')e.pupils=[];if(change==='tampered-final')e.finals[0].contentHash='f'.repeat(64);
  const f=await load('src/server/academics/report-card-staging-result.ts',state);
  try{await withEnv(async()=>assert.deepEqual(await f.module.readLocalStagingResult(id),{ok:false,code:'unavailable'}));}finally{f.close();}
 }
});

test('actual staff dashboard lookup verifies provider identity then calls only the zero-argument staff RPC',async()=>{
 for(const role of ['admin','teacher','bursar']){
  const state={events:[],client:{auth:{async getUser(){state.events.push(['user']);return{data:{user:{id:'auth'}},error:null};}},async rpc(...args){state.events.push(['rpc',args]);return{data:[{auth_user_id:'auth',school_id:schoolId,school_user_id:'user',membership_id:'member',role,status:'active',school_user_count:1,active_membership_count:1}],error:null};}}};
  const f=await load('src/server/accounts/staging-staff-account.ts',state);
  try{await withEnv(async()=>{assert.equal(await f.module.readStagingStaffAccount(),role);assert.deepEqual(state.events.find(e=>e[0]==='rpc')[1],['resolve_staging_staff_account']);});}finally{f.close();}
 }
});
test('actual staff lookup denies provider and RPC errors without querying legacy memberships or using report authority fallback',async()=>{
 for(const mode of ['disabled','auth','rpc']){
  const state={events:[],client:{auth:{async getUser(){return{data:{user:{id:'auth'}},error:mode==='auth'?{}:null};}},async rpc(){state.events.push(['rpc']);return{data:null,error:{}};}}};const f=await load('src/server/accounts/staging-staff-account.ts',state);
  try{await withEnv(async()=>{assert.equal(await f.module.readStagingStaffAccount(),null);assert.equal(state.events.some(e=>e[0]==='rpc'),mode==='rpc');},mode==='disabled'?{GREENFIELD_STAGING_UI:''}:{});}finally{f.close();}
 }
});

test('actual root proxy sends ordinary local-staging entry paths to dashboard and delegates explicit staging pages',async()=>{
 const state={Response,events:[],delegate:async req=>{state.events.push(req.nextUrl.pathname);return{delegated:true};}},f=await load('src/proxy.ts',state);
 try{await withEnv(async()=>{
  for(const path of ['/', '/login', '/students?next=foreign']){const r=await f.module.proxy(request(path));assert.equal(r.destination,'/staging/dashboard');}
  for(const path of ['/staging/dashboard','/staging/report-cards','/staging/login'])assert.deepEqual(await f.module.proxy(request(path)),{delegated:true});
  assert.deepEqual(state.events,['/staging/dashboard','/staging/report-cards','/staging/login']);
 });}finally{f.close();}
});

test('actual dashboard adapter excludes bursar academic reads and rejects changed role or incomplete class reads',async()=>{
 for(const mode of ['bursar','changed','failed','teacher']){
  const state={calls:[],async readWorkspace(choice){state.calls.push(choice);if(mode==='failed')return{ok:false,code:'unavailable'};if(mode==='teacher'&&state.calls.length===1)return{ok:false,code:'forbidden'};return{ok:true,workspace:{role:mode==='changed'?'teacher':mode==='teacher'?'teacher':'admin',pupils:[],reports:[],assessmentRevision:2,subjectCount:1}};}};
  const f=await load('src/server/accounts/staging-dashboard.ts',state);
  try{const r=await f.module.readStagingDashboard(mode==='bursar'?'bursar':mode==='teacher'?'teacher':'admin');if(mode==='teacher'){assert.ok(r);assert.equal(r.metrics[1][0],'1');}else assert.equal(r,null);if(mode==='bursar')assert.deepEqual(state.calls,[]);}finally{f.close();}
 }
});

test('actual academic page entry authorizes each direct route before academic data reads',async()=>{
 for(const role of ['admin','teacher','bursar'])for(const view of ['students','classes','reports']){
  const state={events:[],staffRole:role,dashboard:{classes:[{key:'primary5'}]},client:{auth:{async getUser(){return{data:{user:{id}},error:null};}}}};
  const f=await load('src/server/accounts/staging-academic-entry.ts',state);
  try{await withEnv(async()=>{const r=await f.module.readStagingStaffPage(view);const allowed=academicPages.canOpenAcademicPage(role,view);assert.equal(r.kind,allowed?'ready':'not-found');assert.equal(state.events.some(e=>e[0]==='academic-data'),allowed);});}finally{f.close();}
 }
});
test('actual academic page entry denies missing identities, membership and unowned class selections without role fallback',async()=>{
 for(const mode of ['disabled','auth','membership','class','unknown-class','data-failure']){
  const state={events:[],staffRole:mode==='membership'?null:'teacher',dashboard:mode==='data-failure'?null:{classes:[{key:'primary5'}]},client:{auth:{async getUser(){return{data:{user:mode==='auth'?null:{id}},error:null};}}}};
  const f=await load('src/server/accounts/staging-academic-entry.ts',state);
  try{await withEnv(async()=>{
   const r=await f.module.readStagingStaffPage('reports',mode==='class'?'creche':mode==='unknown-class'?'foreign':'all');
   assert.equal(r.kind,mode==='auth'?'sign-in':mode==='membership'?'unavailable':mode==='data-failure'?'ready':'not-found');
   if(mode==='data-failure')assert.equal(r.data,null);if(['disabled','auth','membership','unknown-class'].includes(mode))assert.equal(state.events.some(e=>e[0]==='academic-data'),false);
  },mode==='disabled'?{GREENFIELD_STAGING_UI:''}:{});}finally{f.close();}
 }
});
