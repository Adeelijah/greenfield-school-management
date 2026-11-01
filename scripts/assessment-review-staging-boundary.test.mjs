import test,{beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {managedAssessmentReviewSqlScope,lockReportSqlScopeAuthority,isReportSqlScope} from '../src/lib/academics/report-card-sql-scope.ts';
import {parseAssessmentReviewCommand,decodeAssessmentReviewSuccess} from '../src/lib/academics/assessment-review-command.ts';
import {createApprovedSnapshotFixture} from '../src/lib/academics/report-card-canonical-test-fixtures.ts';
import {materializeAssessmentSource} from '../src/lib/academics/assessment-canonical-source.ts';
const root=new URL('../',import.meta.url),file=new URL('src/lib/academics/assessment-postgres-review-fixture.ts',root),key=Symbol.for('review-fixture-'+randomUUID());
const id=()=>randomUUID(),school='0c594571-74c5-46fe-a835-a9b217a3a199',teacher=id(),admin=id(),teacherAuth=id(),adminAuth=id();let state;
const login='greenfield_assessment_review_app',runtime='greenfield_assessment_review_runtime';
const edge=role=>({role,set:true,inherit:false,admin:false});
const evidence=()=>[login,runtime].map((name,i)=>({name,login:i===0,inherit:false,superuser:false,bypass:false,creator:false,database:false,replication:false,owner:false,memberships:i===0?[edge(runtime)]:[],members:[...(i===1?[edge(login)]:[]),{role:'postgres',set:false,inherit:false,admin:true,grantor:'supabase_admin',grantorSuperuser:true,memberSuperuser:false,memberCreator:true,memberBypass:true}]}));
const originalInput=createApprovedSnapshotFixture().docs.input,map=new Map([['school',school]]);
function collect(value){if(!value||typeof value!=='object')return;for(const[k,v]of Object.entries(value)){if((k==='id'||k.endsWith('Id')||k==='updatedBy')&&typeof v==='string'&&!map.has(v))map.set(v,id());collect(v);}}
collect(originalInput);map.delete('exam');
map.set(originalInput.scope.classId,'1dbfa5e7-99b8-5094-b1f9-c872477d4bf6');map.set(originalInput.scope.sessionId,'8a9350ca-95cb-50ca-b750-2d8d5a192044');map.set(originalInput.scope.termId,'f7742f7c-ffe4-58ee-8dce-c687ec623330');
const baseInput=JSON.parse(JSON.stringify(originalInput),(_k,v)=>typeof v==='string'&&map.has(v)?map.get(v):v);
const cmd=()=>({action:'review_subject',classId:state.input.scope.classId,sessionId:state.input.scope.sessionId,termId:state.input.scope.termId,rosterId:state.input.roster[0].id,expectedScopeRevision:state.input.scope.revision,operationKey:'fixture-review-1'});
function reset(){const input=structuredClone(baseInput);input.scope.schoolId=school;state={login,execution:login,graph:evidence(),input,role:'teacher',events:[],sources:[],reviews:[],finals:[],audit:[],receipts:[],activeReviewer:true,permission:true};globalThis[key]={sdk:async()=>({auth:{getUser:async()=>{state.events.push('sdk');if(state.authMutate)state.authMutate();if(state.authThrow)throw Error('provider secret');return{error:state.authError?{}:null,data:{user:state.noAuth?null:{id:state.role==='admin'?adminAuth:teacherAuth}}};}}}),actor:async(tx,scope,identity)=>{state.events.push('actor');const verified=await identity();const complete=await lockReportSqlScopeAuthority(tx,scope,verified?.authUserId);return state.actorFailure||!complete?{ok:false}:{ok:true,authUserId:state.role==='admin'?adminAuth:teacherAuth,identity:{school:{id:school,finalPrimaryYear:5},membership:{id:state.role==='admin'?admin:teacher,role:state.role}}};},candidate:async()=>{state.events.push('candidate');const built=materializeAssessmentSource(state.input);assert.equal(built.ok,true);return state.incomplete?{ok:false,code:'incomplete_source'}:{ok:true,identity:{membership:{id:state.role==='admin'?admin:teacher}},input:state.input,materialized:built.materialized};}};}
const context=`globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(key))})]`;
const entry=new URL('src/server/academics/assessment-review-staging-entry.ts',root);
const aliases=new Map(['assessment-review-staging-runtime','assessment-review-staging-policy','assessment-review-command','assessment-postgres-review-fixture','report-card-sql-scope','report-card-staging-ui'].map(n=>['@/lib/academics/'+n,new URL('src/lib/academics/'+n+'.ts',root).href]));
const hooks=registerHooks({resolve(s,c,next){
 if(c.parentURL===entry.href){if(s==='server-only')return{url:'review-mock:server',shortCircuit:true};if(s==='@/lib/supabase/server')return{url:'review-mock:sdk',shortCircuit:true};if(s==='./assessment-review-staging-connection')return{url:'review-mock:connection',shortCircuit:true};if(aliases.has(s))return{url:aliases.get(s),shortCircuit:true};throw Error('Unexpected review server dependency '+s);}
 if(c.parentURL===file.href&&s==='./report-card-postgres-command-context.ts')return{url:'review-mock:actor',shortCircuit:true};if(c.parentURL===file.href&&s==='./assessment-postgres-canonical-reader.ts')return{url:'review-mock:candidate',shortCircuit:true};return next(s,c);
},load(u,c,next){
 if(u===file.href||u===entry.href)return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(u),'utf8')),shortCircuit:true};
 if(u==='review-mock:server')return{format:'module',source:'export {};',shortCircuit:true};
 if(u==='review-mock:sdk')return{format:'module',source:`export const createSupabaseServerClient=()=>${context}.sdk();`,shortCircuit:true};
 if(u==='review-mock:connection')return{format:'module',source:'export function getStagingAssessmentReviewDatabase(){throw Error("No live connection in offline tests");}',shortCircuit:true};
 if(u==='review-mock:actor')return{format:'module',source:`export const lockReportActorInScope=(...a)=>${context}.actor(...a);`,shortCircuit:true};if(u==='review-mock:candidate')return{format:'module',source:`export const loadCompleteAssessmentInScope=(...a)=>${context}.candidate(...a);`,shortCircuit:true};return next(u,c);
}});
const {createVerifiedAssessmentReviewEntry}=await import(entry.href);
const db={unsafe(){throw Error('outer SQL forbidden');},async begin(work){const before=structuredClone({sources:state.sources,reviews:state.reviews,finals:state.finals,audit:state.audit,receipts:state.receipts});try{const result=await work({unsafe:query});if(state.outerFail)throw Error('outer failure');state.events.push('commit');return result;}catch(e){Object.assign(state,before);state.events.push('rollback');throw e;}finally{state.execution=state.login;}}};
async function query(sql,p=[]){state.events.push(sql);
 if(sql.includes('session_user AS \"loginRole\"'))return[{loginRole:state.login,executionRole:state.execution}];
 if(sql.includes('pg_catalog.pg_roles r WHERE'))return state.graph;
 if(sql==='SET LOCAL ROLE \"'+runtime+'\"'){state.execution=runtime;return[];}
 if(sql.includes('assessment_source_write_gate'))return[{id:1}];
 if(sql.includes('public.lock_report_card_actor'))return[{auth_user_id:p[0],school_user_id:p[0],school_user_count:1,active_membership_count:state.hiddenMembership?2:1,membership_id:p[0]===teacherAuth?teacher:admin,school_id:school,role:p[0]===teacherAuth?'teacher':'admin',status:'active',final_primary_year:5}];if(state.fail&&sql.startsWith('INSERT INTO')&&sql.includes('"'+state.fail+'"'))throw Error('private database failure');
 if(sql.includes('r.rolsuper AS superuser'))return[{login:'fixture_operator',execution:'fixture_operator',superuser:!state.restrictedPlain}];
 if(sql.includes('fixture_source_write_gate'))return[{id:1}];
 if(sql.startsWith('SELECT sc.id AS id'))return state.scopeMissing?[]:[{id:state.input.scope.id,revision:state.input.scope.revision}];
 if(sql.startsWith('SELECT id FROM')&&sql.includes('assessment_subject_roster'))return state.rosterMissing?[]:[{id:cmd().rosterId}];
 if(sql.startsWith('SELECT id FROM')&&(sql.includes('teacher_class_assignments')||sql.includes('assessment_teacher_subjects')))return state.permission?[{id:id()}]:[];
 if(sql.startsWith('SELECT scope_id'))return state.receipts.filter(r=>r.actor===p[1]&&r.key===p[2]);
 if(sql.startsWith('SELECT id,source_manifest'))return state.sources.filter(r=>r.revision===p[2]);
 if(sql.startsWith('SELECT id FROM')&&sql.includes('assessment_teacher_reviews'))return state.reviews.filter(r=>r.roster===p[1]&&r.source===p[2]&&r.reviewer===p[3]);
 if(sql.startsWith('SELECT reviewer_membership_id'))return state.reviews.filter(r=>r.id===p[1]&&r.source===p[4]&&r.roster===p[3]).map(r=>({reviewer:r.reviewer}));
 if(sql.startsWith('SELECT m.id'))return state.activeReviewer?[{id:teacher,userId:teacher,authUserId:state.samePrincipal?adminAuth:teacherAuth}]:[];
 if(sql.startsWith('SELECT id FROM')&&sql.includes('memberships'))return state.ambiguousReviewer?[{id:teacher},{id:id()}]:[{id:teacher}];
 if(sql.startsWith('SELECT id FROM')&&sql.includes('assessment_finalizations'))return state.finals.filter(r=>r.source===p[1]&&r.roster===p[2]);
 if(sql.startsWith('INSERT INTO')){if(sql.includes('assessment_source_versions'))state.sources.push({id:p[0],revision:p[3],manifest:JSON.parse(p[4]),hash:p[5]});else if(sql.includes('assessment_teacher_reviews'))state.reviews.push({id:p[0],roster:p[3],source:p[4],reviewer:p[5]});else if(sql.includes('assessment_finalizations'))state.finals.push({id:p[0],source:p[4],roster:p[3],review:p[5],result:JSON.parse(p[7]),hash:p[8]});else if(sql.includes('assessment_audit'))state.audit.push(p);else if(sql.includes('assessment_operation_receipts'))state.receipts.push({scopeId:p[2],actor:p[3],key:p[4],fingerprint:p[5],revision:p[6],outcome:JSON.parse(p[7])});else throw Error('Unexpected write');return[];}
 throw Error('Unexpected SQL '+sql);
}
const run=raw=>createVerifiedAssessmentReviewEntry(db).run(raw??cmd());
beforeEach(reset);after(()=>{hooks.deregister();delete globalThis[key];});
test('managed review scope is issued, fixed-school and cannot be forged or widened to report/owner roles',async()=>{
 const scope=managedAssessmentReviewSqlScope();assert.equal(isReportSqlScope(scope),true);assert.equal(isReportSqlScope({...scope}),false);assert.equal(scope.schema,'public');assert.equal(scope.sourceGate,'assessment_source_write_gate');
 for(const execution of ['postgres','greenfield_report_card_runtime','greenfield_assessment_runtime']){state.execution=execution;assert.equal((await run()).code,'unavailable');assert.equal(state.sources.length,0);}
});
test('closed staging commands and foreign class/session selectors reject before SDK or SQL',async()=>{for(const patch of [{schoolId:school},{role:'admin'},{results:{}},{classId:id()},{sessionId:id()},{expectedScopeRevision:0}]){assert.equal((await run({...cmd(),...patch})).code,'invalid');assert.deepEqual(state.events,[]);}});
test('missing, rejected and throwing SDK identities deny before transactions',async()=>{for(const patch of [{noAuth:true},{authError:true},{authThrow:true}]){reset();Object.assign(state,patch);assert.equal((await run()).code,'forbidden');assert.deepEqual(state.events,['sdk']);}});
test('actual SDK entry and managed runtime execute the canonical review writer under the dedicated public scope and preserve retry history',async()=>{
 const command=cmd(),roster=command.rosterId;state.authMutate=()=>{command.rosterId=id();};const result=await run(command);assert.equal(result.ok,true);assert.equal(state.reviews[0].roster,roster);assert.equal(state.events[0],'sdk');assert.ok(state.events.indexOf('SELECT id FROM "public"."assessment_source_write_gate" WHERE id=1 FOR UPDATE')<state.events.indexOf('actor'));
 state.authMutate=null;const replay=await run({...command,rosterId:roster});assert.deepEqual(replay,{...result,kind:'replay'});assert.equal(state.reviews.length,1);assert.equal(state.input.scope.revision,result.revision);assert.equal(state.execution,login);
});
test('actual managed finalization pins the independent teacher review and returns only seven safe scalar fields',async()=>{const review=await run();assert.equal(review.ok,true);state.role='admin';const command={...cmd(),action:'finalize_subject',teacherReviewId:review.reviewId,operationKey:'managed-final-1'};const result=await run(command);assert.equal(result.ok,true);assert.equal(Object.keys(result).length,7);assert.equal(result.sourceVersionId,review.sourceVersionId);assert.deepEqual(await run(command),{...result,kind:'replay'});assert.equal(state.finals.length,1);});
test('managed authority ambiguity, bursar and ended subject assignment deny before historical receipt access',async()=>{const command=cmd();assert.equal((await run(command)).ok,true);for(const patch of [{hiddenMembership:true},{role:'bursar'},{permission:false}]){Object.assign(state,patch);state.events=[];assert.equal((await run(command)).code,'forbidden');assert.ok(!state.events.some(e=>e.startsWith('SELECT scope_id')));Object.assign(state,{hiddenMembership:false,role:'teacher',permission:true});}});
test('every managed persistence failure and outer rejection rolls back complete history; the same key recovers and replays',async()=>{for(const fail of ['assessment_source_versions','assessment_teacher_reviews','assessment_audit','assessment_operation_receipts','outer']){reset();state.fail=fail;state.outerFail=fail==='outer';const command=cmd();assert.equal((await run(command)).code,'unavailable');assert.deepEqual([state.sources,state.reviews,state.audit,state.receipts],[[],[],[],[]]);state.fail=null;state.outerFail=false;const result=await run(command);assert.equal(result.ok,true);assert.deepEqual(await run(command),{...result,kind:'replay'});}});
test('managed finalization rechecks complete teacher-reviewer authority and rolls back every finalization persistence failure',async()=>{
 const review=await run();state.role='admin';const command={...cmd(),action:'finalize_subject',teacherReviewId:review.reviewId,operationKey:'managed-final-failures'};
 for(const fail of ['assessment_finalizations','assessment_audit','assessment_operation_receipts']){state.fail=fail;assert.equal((await run(command)).code,'unavailable');assert.equal(state.finals.length,0);assert.equal(state.reviews.length,1);assert.equal(state.receipts.length,1);}
 state.fail=null;state.ambiguousReviewer=true;assert.equal((await run(command)).code,'forbidden');assert.equal(state.finals.length,0);state.ambiguousReviewer=false;assert.equal((await run(command)).ok,true);
});
test('managed historical replay survives a stale source but rechecks current complete authority before receipt access',async()=>{
 const command=cmd(),result=await run(command);state.input.scope.revision++;state.incomplete=true;assert.deepEqual(await run(command),{...result,kind:'replay'});state.hiddenMembership=true;state.events=[];assert.equal((await run(command)).code,'forbidden');assert.ok(!state.events.some(e=>e.startsWith('SELECT scope_id')));
});
