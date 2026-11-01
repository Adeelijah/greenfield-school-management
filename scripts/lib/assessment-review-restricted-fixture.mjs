// Opt-in exact generated LOGIN lifecycle. Called only after the local upgrade gate.
import postgres from 'postgres';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {assessmentReviewSecurityPlan} from './assessment-review-security-plan.mjs';
import {createFixtureReviewRuntime} from '../../src/lib/academics/assessment-review-fixture-runtime.ts';
export async function withAssessmentReviewFixture(owner,adminURL,schema,schoolId,work){
 const target=new URL(adminURL),database=decodeURIComponent(target.pathname.slice(1));
 if(!['postgres:','postgresql:'].includes(target.protocol)||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.search||target.hash)throw Error('Local disposable review fixture only');
 const password=randomBytes(32).toString('hex'),plan=assessmentReviewSecurityPlan(schema,schoolId,database,password),marker='greenfield.review.fixture.'+randomBytes(16).toString('hex');
 const authorityBefore=JSON.stringify(Array.from(await owner.unsafe('SELECT p.proowner,p.proconfig,p.proacl::text AS acl,pg_catalog.pg_get_functiondef(p.oid) AS definition FROM pg_catalog.pg_proc p WHERE p.oid=$1::regprocedure',['"'+schema+'".lock_report_card_actor(uuid)'])));
 let installed=false,one,two;
 try{
  try{await owner.begin(async tx=>{for(const sql of plan.statements)await tx.unsafe(sql);for(const role of Object.values(plan.roles))await tx.unsafe('COMMENT ON ROLE "'+role+'" IS \''+marker+'\'');});installed=true;}catch(e){throw Error('Review fixture role setup failed; SQLSTATE='+(/^[A-Z0-9]{5}$/.test(e?.code)?e.code:'unavailable')+'; private setup text suppressed');}
  target.username=plan.roles.login;target.password=password;
  const options={max:1,prepare:false,connect_timeout:5,connection:{search_path:'pg_catalog',statement_timeout:15000,lock_timeout:10000},onnotice:()=>{}};
  one=postgres(target.toString(),options);two=postgres(target.toString(),options);
  const wrap=client=>createFixtureReviewRuntime({unsafe(){throw Error('Transaction only');},begin:fn=>client.begin(tx=>fn({unsafe:async(q,p)=>Array.from(await tx.unsafe(q,p))}))},schema);
  const first=(await one.unsafe('SELECT pg_backend_pid() AS pid,session_user AS login,current_user AS role'))[0],second=(await two.unsafe('SELECT pg_backend_pid() AS pid,session_user AS login,current_user AS role'))[0];
  assert.notEqual(first.pid,second.pid);for(const evidence of [first,second])assert.deepEqual([evidence.login,evidence.role],[plan.roles.login,plan.roles.login]);
  const context={database:wrap(one),secondDatabase:wrap(two),roles:plan.roles,schoolId};
  const denied=operation=>assert.rejects(operation,e=>['42501','P0001'].includes(e.code));
  await denied(()=>one.unsafe('SELECT id FROM "'+schema+'".schools'));
  for(const role of ['postgres',schema+'_authority_owner',schema+'_writer'])await denied(()=>one.begin(tx=>tx.unsafe('SET LOCAL ROLE "'+role+'"')));
  for(const name of plan.targets)await denied(()=>context.database.begin(tx=>tx.unsafe('UPDATE "'+schema+'"."'+name+'" SET id=id WHERE false')));
  for(const name of ['report_cards','report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases','fixture_source_write_claims','admissions','audit_events','guardians','student_guardians'])await denied(()=>context.database.begin(tx=>tx.unsafe('SELECT * FROM "'+schema+'"."'+name+'"')));
  for(const fn of ['fixture_mark_source_scope(uuid)','fixture_lock_source_write()','fixture_review_service_guard()']){const rows=await context.database.begin(tx=>tx.unsafe("SELECT has_function_privilege(current_user,$1::text,'EXECUTE') AS allowed",['"'+schema+'".'+fn]));assert.equal(rows[0].allowed,false);}
  await denied(()=>context.database.begin(tx=>tx.unsafe('SELECT "'+schema+'".fixture_mark_source_scope(NULL::uuid)')));
  await denied(()=>context.database.begin(tx=>tx.unsafe('INSERT INTO "'+schema+'".assessment_scores DEFAULT VALUES')));
  await denied(()=>context.database.begin(tx=>tx.unsafe('TRUNCATE "'+schema+'".assessment_audit')));
  console.log('PASS: dedicated review LOGIN has SET-only execution, no owner/report fallback, no source/report/legacy mutation access and denies zero-row history updates');
  const result=await work(context);
  for(const client of [one,two]){const reset=(await client.unsafe('SELECT session_user AS login,current_user AS role'))[0];assert.deepEqual([reset.login,reset.role],[plan.roles.login,plan.roles.login]);}
  console.log('PASS: independent review sessions reset to their unprivileged LOGIN without role or privilege drift');return result;
 }finally{
  if(one)await one.end({timeout:5});if(two)await two.end({timeout:5});
  if(installed){await owner.begin(async tx=>{
   for(const role of Object.values(plan.roles)){const rows=await tx.unsafe("SELECT pg_catalog.shobj_description(oid,'pg_authid') AS marker FROM pg_catalog.pg_roles WHERE rolname=$1",[role]);if(rows.length!==1||rows[0].marker!==marker)throw Error('Refusing cleanup without exact generated review role acknowledgement');}
   for(const sql of plan.cleanup)await tx.unsafe(sql);
  });const left=await owner.unsafe('SELECT rolname FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[])',[Object.values(plan.roles)]);assert.equal(left.length,0);assert.equal(JSON.stringify(Array.from(await owner.unsafe('SELECT p.proowner,p.proconfig,p.proacl::text AS acl,pg_catalog.pg_get_functiondef(p.oid) AS definition FROM pg_catalog.pg_proc p WHERE p.oid=$1::regprocedure',['"'+schema+'".lock_report_card_actor(uuid)']))),authorityBefore);console.log('PASS: exact nonce-acknowledged review roles, policies, guard and grants removed; existing report security preserved');}
 }
}
