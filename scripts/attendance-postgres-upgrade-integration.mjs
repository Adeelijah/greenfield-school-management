// Local disposable schema-faithful attendance rehearsal; never a managed installer.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {attendanceUpgradePlan} from './lib/attendance-upgrade-plan.mjs';
import {reportReleaseGuardDDL} from './lib/report-release-disposable-guards.mjs';
import {executeAttendanceUpgradeFixture} from '../src/lib/attendance/attendance-postgres-fixture.ts';
import {readAttendanceUpgradeFixture} from '../src/lib/attendance/attendance-postgres-history.ts';
const url=process.env.REPORT_CARD_TEST_DATABASE_URL;
if(!url||process.env.REPORT_CARD_TEST_CONFIRM!=='DISPOSABLE_REPORT_CARD_TEST_ONLY'||process.env.REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM!=='DISPOSABLE_ROLE_ADMIN_TEST_ONLY'){
 console.error('SKIPPED: local disposable URL and both explicit confirmations are required.');process.exitCode=2;
}else{
 const target=new URL(url),database=decodeURIComponent(target.pathname.slice(1));
 if(!['postgres:','postgresql:'].includes(target.protocol)||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.search||target.hash||!/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(database))throw Error('Only the named local disposable database is permitted');
 // Metadata/driver imports occur only after the opt-in and URL gate.
 const [{default:postgres},{assessmentFixtureDDL},{reportUpgradeSourcePlan,reportUpgradeProposalPlan},{reportUpgradeGuardPlan},{fixtureSecurityPlan}]=await Promise.all([
  import('postgres'),import('./lib/assessment-disposable-schema.mjs'),import('./lib/report-card-upgrade-plan.mjs'),import('./lib/report-card-upgrade-guards.mjs'),import('./lib/assessment-disposable-security-plan.mjs'),
 ]);
 const schema='rc_it_'+randomBytes(8).toString('hex'),q='"'+schema+'"',t=name=>q+'."'+name+'"';
 const ids=Object.fromEntries(['school','foreignSchool','primary5ClassId','crecheClassId','primaryLevel','crecheLevel','primarySection','crecheSection','session','term','scope','teacherUser','teacherAuth','teacher','adminUser','adminAuth','admin','bursarUser','bursarAuth','bursar','pupil','enrollment','assignment','hidden'].map(key=>[key,randomUUID()]));
 const plan=attendanceUpgradePlan(schema,{schoolId:ids.school,primary5ClassId:ids.primary5ClassId,crecheClassId:ids.crecheClassId});
 const security=fixtureSecurityPlan(schema,ids.school),existingReleaseGuards=new Set(reportReleaseGuardDDL(schema).statements),roles=[...Object.values(plan.roles),...Object.values(security.roles)];
 const [baseline,dependencies]=await Promise.all([readFile(new URL('../drizzle/0000_broad_slayback.sql',import.meta.url),'utf8'),readFile(new URL('../docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql',import.meta.url),'utf8')]);
 const source=reportUpgradeSourcePlan(schema,baseline,dependencies),proposal=reportUpgradeProposalPlan(schema,assessmentFixtureDDL(schema,{includeReports:true}).statements),guards=reportUpgradeGuardPlan(schema);
 const options={max:1,prepare:false,connect_timeout:5,connection:{search_path:'pg_catalog',statement_timeout:15000,lock_timeout:10000},onnotice:()=>{}};
 const owner=postgres(url,options),parentClient=postgres(url,options);let one,two,claimed=false,phase='operator-preflight',releaseParent,lastSqlCode='none';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const calendar=['year','month','day'].map(type=>today.find(p=>p.type===type).value).join('-');
 const date=offset=>new Date(Date.parse(calendar+'T12:00:00Z')-86400000*offset).toISOString().slice(0,10);
 const command=(key,offset=1)=>({action:'save_register',classKey:'primary5',date:date(offset),expectedVersion:0,operationKey:key,reason:null,marks:{[ids.pupil]:'present'}});
 const run=async(tx,statements)=>{for(const sql of statements)await tx.unsafe(sql);};
 const db=client=>({async begin(work){return client.begin(async tx=>{const session=await tx.unsafe('SELECT session_user AS login,current_user AS execution');assert.deepEqual([session[0].login,session[0].execution],[plan.roles.login,plan.roles.login]);await tx.unsafe('SET LOCAL ROLE "'+plan.roles.worker+'"');return work({unsafe:async(sql,params)=>{try{return await tx.unsafe(sql,params);}catch(error){lastSqlCode=typeof error?.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:'unavailable';throw error;}}});});}});
 const save=(client,c,auth=ids.teacherAuth)=>executeAttendanceUpgradeFixture(db(client),schema,async()=>({authUserId:auth}),c);
 const read=(client,day=date(1),auth=ids.teacherAuth)=>readAttendanceUpgradeFixture(db(client),schema,async()=>({authUserId:auth}),{classKey:'primary5',date:day});
 const snapshot=async names=>{const rows={};for(const name of names)rows[name]=await owner.unsafe('SELECT to_jsonb(x) AS row FROM '+t(name)+' x ORDER BY to_jsonb(x)::text');return JSON.stringify(rows);};
 try{
  assert.equal((await owner.unsafe('SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user'))[0].rolsuper,true,'Authorized local disposable superuser required');
  const collision=await owner.unsafe('SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1) OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=ANY($2::text[])) AS present',[schema,roles]);assert.equal(collision[0].present,false);claimed=true;
  phase='schema-faithful-install';
  await owner.begin(async tx=>{
   await tx.unsafe('CREATE SCHEMA '+q);
   await run(tx,[...source.baselineStatements,...source.dependencyStatements,...proposal,...guards.statements]);
   await tx.unsafe('INSERT INTO '+t('schools')+' (id,name,slug,final_primary_year) VALUES($1,\'Attendance upgrade school\',\'attendance-upgrade\',5),($2,\'Foreign fixture\',\'attendance-foreign\',5)',[ids.school,ids.foreignSchool]);
   for(const role of ['teacher','admin','bursar']){await tx.unsafe('INSERT INTO '+t('school_users')+' (id,auth_user_id,display_name) VALUES($1,$2,$3)',[ids[role+'User'],ids[role+'Auth'],'Test '+role]);await tx.unsafe('INSERT INTO '+t('memberships')+' (id,school_id,user_id,role) VALUES($1,$2,$3,$4)',[ids[role],ids.school,ids[role+'User'],role]);}
   for(const [stage,year,order] of [['primary',5,2],['creche',null,1]]){
    const key=stage==='primary'?'primary':'creche',classId=stage==='primary'?ids.primary5ClassId:ids.crecheClassId;
    await tx.unsafe('INSERT INTO '+t('academic_levels')+' (id,school_id,name,stage,primary_year,progression_order) VALUES($1,$2,$3,$4,$5,$6)',[ids[key+'Level'],ids.school,'Test '+stage,stage,year,order]);
    await tx.unsafe('INSERT INTO '+t('academic_sections')+' (id,school_id,level_id,name,display_order) VALUES($1,$2,$3,\'A\',1)',[ids[key+'Section'],ids.school,ids[key+'Level']]);
    await tx.unsafe('INSERT INTO '+t('classes')+' (id,school_id,name,section,level_id,section_id) VALUES($1,$2,$3,\'A\',$4,$5)',[classId,ids.school,'Test '+stage,ids[key+'Level'],ids[key+'Section']]);
   }
   await tx.unsafe('INSERT INTO '+t('academic_sessions')+' (id,school_id,label,starts_on,ends_on,is_current) VALUES($1,$2,\'Attendance test\',$3::text::date-365,$3::text::date+365,true)',[ids.session,ids.school,calendar]);
   await tx.unsafe('INSERT INTO '+t('terms')+' (id,school_id,session_id,name,starts_on,ends_on,is_current) VALUES($1,$2,$3,\'Test term\',$4::text::date-100,$4::text::date+100,true)',[ids.term,ids.school,ids.session,calendar]);
   await tx.unsafe('INSERT INTO '+t('students')+' (id,school_id,admission_number,first_name,last_name) VALUES($1,$2,\'TEST-ATT-1\',\'Test\',\'Pupil\')',[ids.pupil,ids.school]);
   await tx.unsafe('INSERT INTO '+t('enrollments')+' (id,school_id,student_id,class_id,session_id) VALUES($1,$2,$3,$4,$5)',[ids.enrollment,ids.school,ids.pupil,ids.primary5ClassId,ids.session]);
   await tx.unsafe('INSERT INTO '+t('teacher_class_assignments')+' (id,school_id,teacher_membership_id,class_id,session_id) VALUES($1,$2,$3,$4,$5)',[ids.assignment,ids.school,ids.teacher,ids.primary5ClassId,ids.session]);
   await tx.unsafe('INSERT INTO '+t('assessment_scopes')+' (id,school_id,class_id,session_id,term_id,revision) VALUES($1,$2,$3,$4,$5,1)',[ids.scope,ids.school,ids.primary5ClassId,ids.session,ids.term]);
   for(const role of Object.values(security.roles))await tx.unsafe('CREATE ROLE "'+role+'" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION');
   await run(tx,security.statements.filter(sql=>!existingReleaseGuards.has(sql)));await run(tx,plan.statements);
   const password=randomBytes(32).toString('hex');
   await tx.unsafe('CREATE ROLE "'+plan.roles.login+'" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD \''+password+'\'');
   await tx.unsafe('GRANT "'+plan.roles.worker+'" TO "'+plan.roles.login+'" WITH ADMIN FALSE,INHERIT FALSE,SET TRUE');
   await tx.unsafe('GRANT CONNECT ON DATABASE "'+database+'" TO "'+plan.roles.login+'"');
   const loginUrl=new URL(url);loginUrl.username=plan.roles.login;loginUrl.password=password;
   one=postgres(loginUrl.toString(),options);two=postgres(loginUrl.toString(),options);
  });
  const preserved=await snapshot(['assessment_scopes','fixture_source_write_claims','report_cards','report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases']);
  phase='dedicated-login-role-preflight';
  const roleRows=await owner.unsafe('SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[])',[Object.values(plan.roles)]);
  assert.equal(roleRows.length,3);
  for(const row of roleRows){assert.equal(row.rolcanlogin,row.rolname===plan.roles.login);for(const key of ['rolinherit','rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication'])assert.equal(row[key],false);}
  const edges=await owner.unsafe('SELECT granted.rolname AS role,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles member ON member.oid=m.member JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid WHERE member.rolname=ANY($1::text[])',[Object.values(plan.roles)]);
  assert.deepEqual(Array.from(edges,r=>[r.role,r.admin_option,r.inherit_option,r.set_option]),[[plan.roles.worker,false,false,true]]);
  phase='dedicated-login-read-save-history';
  assert.deepEqual(await read(one),{ok:true,register:null});
  assert.deepEqual(await save(one,command('upgrade-save-01')),{ok:true,kind:'applied',version:1});
  assert.deepEqual(await save(two,command('upgrade-save-01')),{ok:true,kind:'replay',version:1});
  const correction={...command('upgrade-correct-01'),expectedVersion:1,reason:'Reviewed late arrival',marks:{[ids.pupil]:'late'}};
  assert.deepEqual(await save(two,correction,ids.adminAuth),{ok:true,kind:'applied',version:2});
  const history=await read(one);assert.equal(history.ok,true);assert.equal(history.register.version,2);assert.deepEqual(history.register.history.map(h=>[h.version,h.reason,h.marks[ids.pupil]]),[[1,null,'present'],[2,correction.reason,'late']]);
  assert.equal(await snapshot(['assessment_scopes','fixture_source_write_claims','report_cards','report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases']),preserved);
  console.log('PASS: real upgraded keys and coordinated guards support dedicated LOGIN save/replay/correction and immutable register history without source/report writes');
  phase='current-authority-and-hidden-membership';
  assert.deepEqual(await read(one,date(1),ids.bursarAuth),{ok:false,code:'forbidden'});
  await owner.unsafe('INSERT INTO '+t('memberships')+' (id,school_id,user_id,role) VALUES($1,$2,$3,\'teacher\')',[ids.hidden,ids.foreignSchool,ids.teacherUser]);
  assert.deepEqual(await read(one),{ok:false,code:'forbidden'});assert.deepEqual(await save(one,command('upgrade-save-01')),{ok:false,code:'forbidden'});
  await owner.unsafe('UPDATE '+t('memberships')+' SET status=\'suspended\' WHERE id=$1',[ids.hidden]);assert.equal((await read(one)).ok,true);
  console.log('PASS: private attendance authority sees a hidden second active school and denies both saved history and old receipts; suspended history recovers');
  phase='dedicated-login-race-and-rollback';
  const pids=await Promise.all([one.unsafe('SELECT pg_backend_pid() AS pid'),two.unsafe('SELECT pg_backend_pid() AS pid')]);assert.notEqual(pids[0][0].pid,pids[1][0].pid);
  const request=command('upgrade-race-01',2),race=await Promise.all([save(one,request),save(two,request)]);assert.deepEqual(race.map(r=>r.kind).sort(),['applied','replay']);
  const beforeFailure=await snapshot(plan.attendance),retry=command('upgrade-retry-01',3);
  await owner.unsafe('CREATE FUNCTION '+t('attendance_injected_failure')+'() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'Injected attendance receipt failure\'; END $$');await owner.unsafe('CREATE TRIGGER injected BEFORE INSERT ON '+t('attendance_receipts')+' FOR EACH STATEMENT EXECUTE FUNCTION '+t('attendance_injected_failure')+'()');
  assert.deepEqual(await save(one,retry),{ok:false,code:'unavailable'});assert.equal(await snapshot(plan.attendance),beforeFailure);
  await owner.unsafe('DROP TRIGGER injected ON '+t('attendance_receipts'));await owner.unsafe('DROP FUNCTION '+t('attendance_injected_failure')+'()');assert.deepEqual(await save(one,retry),{ok:true,kind:'applied',version:1});
  console.log('PASS: distinct unprivileged LOGIN backends apply/replay once and a receipt failure rolls back register/marks/history with same-key retry');
  phase='source-gate-parent-blocking';
  let acquired;const ready=new Promise(resolve=>{acquired=resolve;}),held=new Promise(resolve=>{releaseParent=resolve;});
  const parent=parentClient.begin(async tx=>{await tx.unsafe('UPDATE '+t('teacher_class_assignments')+' SET ended_at=clock_timestamp() WHERE id=$1',[ids.assignment]);acquired();await held;});
  let timer;try{await Promise.race([ready,parent.then(()=>{throw Error('Parent ended before rendezvous');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Parent gate deadline')),20000);})]);}finally{clearTimeout(timer);}
  const waiting=read(one);let blocked=false;
  try{for(let n=0;n<150;n++){const rows=await owner.unsafe('SELECT cardinality(pg_catalog.pg_blocking_pids($1::integer)) AS n',[pids[0][0].pid]);if(Number(rows[0].n)>0){blocked=true;break;}await delay(20);}assert.equal(blocked,true);}finally{releaseParent();}await parent;assert.deepEqual(await waiting,{ok:false,code:'forbidden'});
  console.log('PASS: actual upgraded parent guards block attendance history before discovery and committed assignment loss denies later history access');
  phase='login-no-privilege-fallback';
  for(const sql of ['SELECT * FROM '+t('attendance_marks'),'SELECT * FROM '+t('students'),'SET ROLE "'+plan.roles.owner+'"','SET ROLE "'+security.roles.writer+'"'])await assert.rejects(one.unsafe(sql),error=>error.code==='42501');
  await one.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE "'+plan.roles.worker+'"');const r=await tx.unsafe('SELECT pg_catalog.has_table_privilege(current_user,$1::text,\'SELECT,INSERT,UPDATE,DELETE\') AS allowed',[schema+'.attendance_marks']);assert.equal(r[0].allowed,false);});
  assert.equal((await one.unsafe('SELECT current_user AS role'))[0].role,plan.roles.login);
  console.log('PASS: dedicated LOGIN cannot read data directly or switch to attendance owner/report writer; transaction end returns to the unprivileged LOGIN');
 }catch(error){console.error('FAIL: attendance upgraded rehearsal; phase='+phase+'; code='+(typeof error?.code==='string'?error.code:'unavailable')+'; sql_code='+lastSqlCode+'; outcome='+(error?.actual?.ok===false?error.actual.code:'unavailable'));process.exitCode=1;
 }finally{
  if(releaseParent)releaseParent();await Promise.allSettled([one?.end({timeout:2}),two?.end({timeout:2}),parentClient.end({timeout:2})]);
  if(claimed){try{await owner.begin(async tx=>{await tx.unsafe('DROP SCHEMA IF EXISTS '+q+' CASCADE');if((await tx.unsafe('SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=$1) AS present',[plan.roles.login]))[0].present)await tx.unsafe('REVOKE CONNECT ON DATABASE "'+database+'" FROM "'+plan.roles.login+'"');for(const role of roles)await tx.unsafe('DROP ROLE IF EXISTS "'+role+'"');});const rows=await owner.unsafe('SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1) OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=ANY($2::text[])) AS present',[schema,roles]);assert.equal(rows[0].present,false);console.log('PASS: exact generated upgrade schema, attendance LOGIN/roles and fixture report roles removed');}catch{console.error('FAIL: attendance upgrade cleanup; schema='+schema);process.exitCode=1;}}
  await owner.end({timeout:2});
 }
}
