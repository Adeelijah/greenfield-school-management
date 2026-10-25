// Opt-in local disposable fixture only. No application env loader, staging URL or public SQL.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {attendanceFixturePlan} from './lib/attendance-disposable-plan.mjs';
import {executeAttendanceFixture} from '../src/lib/attendance/attendance-postgres-fixture.ts';
const url=process.env.REPORT_CARD_TEST_DATABASE_URL;
if(!url||process.env.REPORT_CARD_TEST_CONFIRM!=='DISPOSABLE_REPORT_CARD_TEST_ONLY'||process.env.REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM!=='DISPOSABLE_ROLE_ADMIN_TEST_ONLY'){
 console.error('SKIPPED: local disposable URL plus explicit test and role-admin confirmations are required.');process.exitCode=2;
}else{
 const target=new URL(url);
 if(!['postgres:','postgresql:'].includes(target.protocol)||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.search||target.hash||!/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(target.pathname.slice(1))))throw Error('Only the named local disposable database without URL options is allowed');
 const {default:postgres}=await import('postgres');
 const schema='at_it_'+randomBytes(8).toString('hex'),plan=attendanceFixturePlan(schema),q='"'+schema+'"',t=name=>q+'."'+name+'"';
 const options={max:1,prepare:false,connect_timeout:5,connection:{search_path:'pg_catalog',statement_timeout:15000,lock_timeout:10000},onnotice:()=>{}};
 const admin=postgres(url,options),one=postgres(url,options),two=postgres(url,options),parentClient=postgres(url,options);
 const ids=Object.fromEntries(['school','foreign','teacherUser','teacherAuth','teacher','adminUser','adminAuth','admin','bursarUser','bursarAuth','bursar','klass','otherClass','session','pupil1','pupil2','enrollment1','enrollment2','assignment'].map(k=>[k,randomUUID()]));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const deadline=async(promise,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timed out: '+label)),20000);})]);}finally{clearTimeout(timer);}};
 const date=offset=>new Date(Date.parse(today+'T12:00:00Z')-offset*86400000).toISOString().slice(0,10);
 const cmd=(key,offset=1)=>({action:'save_register',classKey:'primary5',date:date(offset),expectedVersion:0,operationKey:key,reason:null,marks:{[ids.pupil1]:'present',[ids.pupil2]:'late'}});
 const run=async(tx,statements)=>{for(const statement of statements)await tx.unsafe(statement);};
 let lastSqlCode='none';
 const safeSqlCode=error=>typeof error?.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:'unavailable';
 const db=client=>({async begin(work){return client.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE "'+plan.names.worker+'"');return work({unsafe:async(sql,params)=>{try{return await tx.unsafe(sql,params);}catch(error){lastSqlCode=safeSqlCode(error);throw error;}}});});}});
 const save=async(client,command,actor=ids.teacherAuth)=>{lastSqlCode='none';return executeAttendanceFixture(db(client),schema,async()=>({authUserId:actor}),command);};
 const snapshot=async()=>{
  const state={};for(const table of ['attendance_registers','attendance_marks','attendance_audit','attendance_receipts'])state[table]=await admin.unsafe('SELECT to_jsonb(x) AS row FROM '+t(table)+' x ORDER BY to_jsonb(x)::text');return JSON.stringify(state);
 };
 const waitBlocked=async(pid)=>{for(let attempt=0;attempt<150;attempt++){const rows=await admin.unsafe('SELECT cardinality(pg_catalog.pg_blocking_pids($1::integer)) AS n',[pid]);if(Number(rows[0].n)>0)return;await delay(20);}throw Error('Expected fixture session to block');};
 const releases=[];
 let created=false,phase='fixture-preflight';
 try{
  const operator=await admin.unsafe('SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user');
  assert.equal(operator[0]?.rolsuper,true,'This generated-role fixture requires a local disposable superuser; no role grants are inferred');
  const collision=await admin.unsafe('SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1) OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ($2,$3)) AS present',[schema,plan.names.owner,plan.names.worker]);
  assert.equal(collision[0].present,false,'Generated fixture names must be absent before installation');
  created=true;
  phase='fixture-install';
  await admin.begin(async tx=>{
   await tx.unsafe('CREATE ROLE "'+plan.names.owner+'" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION');
   await tx.unsafe('CREATE ROLE "'+plan.names.worker+'" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION');
   await tx.unsafe('CREATE SCHEMA '+q+' AUTHORIZATION "'+plan.names.owner+'"');
   await tx.unsafe('SET LOCAL ROLE "'+plan.names.owner+'"');await run(tx,plan.statements);
   await tx.unsafe('INSERT INTO '+t('schools')+' VALUES($1),($2)',[ids.school,ids.foreign]);
   for(const role of ['teacher','admin','bursar']){
    await tx.unsafe('INSERT INTO '+t('school_users')+' VALUES($1,$2)',[ids[role+'User'],ids[role+'Auth']]);
    await tx.unsafe('INSERT INTO '+t('memberships')+' VALUES($1,$2,$3,$4,\'active\')',[ids[role],ids.school,ids[role+'User'],role]);
   }
   await tx.unsafe('INSERT INTO '+t('classes')+' VALUES($1,$2,\'primary5\'),($3,$2,\'creche\')',[ids.klass,ids.school,ids.otherClass]);
   await tx.unsafe('INSERT INTO '+t('academic_sessions')+' VALUES($1,$2,$3::date-365,$3::date+365,true)',[ids.session,ids.school,today]);
   for(const n of [1,2]){
    await tx.unsafe('INSERT INTO '+t('students')+' VALUES($1,$2,\'active\')',[ids['pupil'+n],ids.school]);
    await tx.unsafe('INSERT INTO '+t('enrollments')+' VALUES($1,$2,$3,$4,$5,\'active\')',[ids['enrollment'+n],ids.school,ids['pupil'+n],ids.klass,ids.session]);
   }
   await tx.unsafe('INSERT INTO '+t('teacher_class_assignments')+' VALUES($1,$2,$3,$4,$5,NULL)',[ids.assignment,ids.school,ids.teacher,ids.klass,ids.session]);
  });
  phase='first-save-apply';
  assert.deepEqual(await save(one,cmd('first-save-01')),{ok:true,kind:'applied',version:1});
  phase='first-save-replay';
  assert.deepEqual(await save(one,cmd('first-save-01')),{ok:true,kind:'replay',version:1});
  const first=await snapshot();
  phase='enrollment-binding-constraint';
  const wrongRegister=randomUUID();
  await assert.rejects(admin.begin(async tx=>{await tx.unsafe('INSERT INTO '+t('attendance_registers')+' VALUES($1,$2,$3,$4,$5::date,1)',[wrongRegister,ids.school,ids.otherClass,ids.session,date(12)]);await tx.unsafe('INSERT INTO '+t('attendance_marks')+' VALUES($1,$2,$3,$4,$5,$6,$7::date,\'present\')',[ids.school,wrongRegister,ids.pupil1,ids.enrollment1,ids.otherClass,ids.session,date(12)]);}),error=>error.code==='23503');
  assert.equal(await snapshot(),first);
  phase='changed-key-and-stale-version';
  assert.deepEqual(await save(one,{...cmd('first-save-01'),marks:{[ids.pupil1]:'absent',[ids.pupil2]:'late'}}),{ok:false,code:'conflict'});
  assert.deepEqual(await save(one,cmd('competing-key')),{ok:false,code:'conflict'});
  assert.equal(await snapshot(),first);
  phase='reasoned-correction-save';
  const correction={...cmd('correction-01'),expectedVersion:1,reason:'Verified late arrival',marks:{[ids.pupil1]:'late',[ids.pupil2]:'present'}};
  assert.deepEqual(await save(one,correction,ids.adminAuth),{ok:true,kind:'applied',version:2});
  phase='correction-persisted-history';
  assert.equal((await admin.unsafe('SELECT count(*)::integer AS n FROM '+t('attendance_audit')))[0].n,2);
  const savedMarks=await admin.unsafe('SELECT student_id,status FROM '+t('attendance_marks')+' ORDER BY student_id');
  assert.deepEqual(Object.fromEntries(savedMarks.map(r=>[r.student_id,r.status])),correction.marks);
  const savedAudit=await admin.unsafe('SELECT version,reason,marks FROM '+t('attendance_audit')+' ORDER BY version');
  assert.deepEqual(savedAudit.map(r=>[r.version,r.reason,r.marks]),[[1,null,cmd('first-save-01').marks],[2,correction.reason,correction.marks]]);
  console.log('PASS: durable register and exact enrollment marks save once; replay, stale keys and reasoned correction preserve audit history');
  phase='current-authority-and-roster';
  const beforeDenied=await snapshot();
  for(const candidate of [cmd('bursar-denied',2),{...cmd('wrong-class-01',2),classKey:'creche'},{...cmd('missing-mark-01',2),marks:{[ids.pupil1]:'present'}}]){
   const outcome=await save(one,candidate,candidate.operationKey==='bursar-denied'?ids.bursarAuth:ids.teacherAuth);assert.equal(outcome.ok,false);
  }
  assert.equal(await snapshot(),beforeDenied);
  await admin.unsafe('UPDATE '+t('memberships')+' SET status=\'suspended\' WHERE id=$1',[ids.teacher]);
  assert.deepEqual(await save(one,cmd('first-save-01')),{ok:false,code:'forbidden'});
  await admin.unsafe('UPDATE '+t('memberships')+' SET status=\'active\' WHERE id=$1',[ids.teacher]);
  const hiddenMembership=randomUUID();await admin.unsafe('INSERT INTO '+t('memberships')+' VALUES($1,$2,$3,\'teacher\',\'active\')',[hiddenMembership,ids.foreign,ids.teacherUser]);
  assert.deepEqual(await save(one,cmd('first-save-01')),{ok:false,code:'forbidden'});
  await admin.unsafe('UPDATE '+t('memberships')+' SET status=\'suspended\' WHERE id=$1',[hiddenMembership]);
  assert.deepEqual(await save(one,cmd('first-save-01')),{ok:true,kind:'replay',version:1});
  console.log('PASS: bursar, unassigned class, incomplete roster, suspended membership and a second active school are denied before historical receipt access');
  // Every persistence phase is failed by an owner-installed fixture trigger, never caller settings.
  for(const table of ['attendance_registers','attendance_marks','attendance_audit','attendance_receipts']){
   phase='rollback-'+table;
   const before=await snapshot(),request=cmd('fail-'+table,3+['attendance_registers','attendance_marks','attendance_audit','attendance_receipts'].indexOf(table));
   await admin.unsafe('CREATE FUNCTION '+t('injected_failure')+'() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'Injected fixture persistence failure\'; END $$');
   await admin.unsafe('CREATE TRIGGER injected BEFORE INSERT ON '+t(table)+' FOR EACH STATEMENT EXECUTE FUNCTION '+t('injected_failure')+'()');
   assert.deepEqual(await save(one,request),{ok:false,code:'unavailable'});assert.equal(await snapshot(),before);
   await admin.unsafe('DROP TRIGGER injected ON '+t(table));await admin.unsafe('DROP FUNCTION '+t('injected_failure')+'()');
   assert.equal((await save(one,request)).ok,true);assert.equal((await save(one,request)).kind,'replay');
  }
  phase='outer-post-write-rollback';
  const beforeOuter=await snapshot(),outerCommand=cmd('outer-failure-01',7);
  const failingOuter={async begin(work){return one.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE "'+plan.names.worker+'"');await work({unsafe:(sql,params)=>tx.unsafe(sql,params)});throw Error('Injected owning transaction failure');});}};
  assert.deepEqual(await executeAttendanceFixture(failingOuter,schema,async()=>({authUserId:ids.teacherAuth}),outerCommand),{ok:false,code:'unavailable'});assert.equal(await snapshot(),beforeOuter);
  assert.deepEqual(await save(one,outerCommand),{ok:true,kind:'applied',version:1});
  console.log('PASS: all four persistence failures and an outer post-write failure roll back every write; same-key retry/replay succeeds');
  // Pair uses separate physical sessions and a gate held after a completed save.
  phase='independent-session-race';
  const paired=cmd('paired-save-01',10);let release;let signal;const ready=new Promise(resolve=>{signal=resolve;});const held=new Promise(resolve=>{release=resolve;releases.push(resolve);});
  const firstPair=one.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE "'+plan.names.worker+'"');const rows=await tx.unsafe('SELECT '+t('save_attendance')+'($1::uuid,$2::text::jsonb) AS outcome',[ids.teacherAuth,JSON.stringify(paired)]);signal();await held;return rows[0].outcome;});
  await deadline(Promise.race([ready,firstPair.then(()=>{throw Error('Pair ended before rendezvous');})]),'first attendance save');const pid=(await two.unsafe('SELECT pg_backend_pid() AS pid'))[0].pid;
  const parentPid=(await parentClient.unsafe('SELECT pg_backend_pid() AS pid'))[0].pid;
  const secondPair=save(two,paired);
  const zeroWriter=parentClient.unsafe('UPDATE '+t('teacher_class_assignments')+' SET ended_at=ended_at WHERE false');
  void zeroWriter.catch(()=>{});
  try{await waitBlocked(pid);await waitBlocked(parentPid);}finally{release();}
  await zeroWriter;
  assert.deepEqual(await firstPair,{ok:true,kind:'applied',version:1});assert.deepEqual(await secondPair,{ok:true,kind:'replay',version:1});
  const races=await Promise.all([save(one,cmd('stale-race-01',11)),save(two,cmd('stale-race-02',11))]);assert.equal(races.filter(r=>r.ok).length,1);assert.equal(races.filter(r=>!r.ok&&r.code==='conflict').length,1);
  console.log('PASS: independent restricted execution sessions serialize same-key and stale-key races; an in-flight save blocks zero-row parent writes before discovery');
  // A parent writer holds the same statement gate before discovery; later replay rechecks authority.
  phase='parent-gate-and-departed-roster';
  let unblock;let acquired;const parentReady=new Promise(resolve=>{acquired=resolve;});const parentHeld=new Promise(resolve=>{unblock=resolve;releases.push(resolve);});
  const parent=one.begin(async tx=>{await tx.unsafe('UPDATE '+t('teacher_class_assignments')+' SET ended_at=clock_timestamp() WHERE id=$1',[ids.assignment]);acquired();await parentHeld;});
  await deadline(Promise.race([parentReady,parent.then(()=>{throw Error('Parent ended before rendezvous');})]),'parent attendance gate');const waiting=save(two,paired);try{await waitBlocked(pid);}finally{unblock();}await parent;
  assert.deepEqual(await waiting,{ok:false,code:'forbidden'});
  await admin.unsafe('UPDATE '+t('teacher_class_assignments')+' SET ended_at=NULL WHERE id=$1',[ids.assignment]);
  // Historical replay survives enrollment departure, while new correction cannot rewrite its identity.
  await admin.unsafe('UPDATE '+t('enrollments')+' SET status=\'withdrawn\' WHERE id=$1',[ids.enrollment2]);
  assert.deepEqual(await save(two,paired),{ok:true,kind:'replay',version:1});
  assert.equal((await save(two,{...paired,operationKey:'changed-roster-01',expectedVersion:1,reason:'Roster changed',marks:{[ids.pupil1]:'present'}})).ok,false);
  await admin.unsafe('UPDATE '+t('enrollments')+' SET status=\'active\' WHERE id=$1',[ids.enrollment2]);
  console.log('PASS: assignment writer blocks requests before discovery; ended assignment denies replay and departed rosters cannot overwrite historical marks');
  phase='restricted-privileges-and-history';
  for(const query of ['SELECT * FROM '+t('attendance_marks'),'UPDATE '+t('attendance_audit')+' SET reason=\'forged\'','SELECT '+t('lock_attendance_parents')+'()']){
   await assert.rejects(one.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE "'+plan.names.worker+'"');await tx.unsafe(query);}),error=>error.code==='42501');
  }
  for(const table of ['attendance_audit','attendance_receipts'])for(const verb of ['UPDATE','DELETE','TRUNCATE']){
   const query=verb==='UPDATE'?'UPDATE '+t(table)+' SET version=version WHERE false':verb==='DELETE'?'DELETE FROM '+t(table)+' WHERE false':'TRUNCATE '+t(table);
   await assert.rejects(admin.unsafe(query),error=>error.code==='42501');
  }
  console.log('PASS: worker has no direct table or helper access; zero-row audit/receipt mutations and truncate remain denied');
 }catch(error){console.error('FAIL: attendance disposable rehearsal; phase='+phase+'; code='+(typeof error?.code==='string'?error.code:'assertion_or_setup')+'; sql_code='+lastSqlCode+'; actual_outcome='+(error?.actual?.ok===false&&['invalid','forbidden','conflict','unavailable'].includes(error.actual.code)?error.actual.code:'unavailable'));process.exitCode=1;
 }finally{
  for(const release of releases)release();
  await Promise.allSettled([one.end({timeout:2}),two.end({timeout:2}),parentClient.end({timeout:2})]);
  if(created){try{await admin.begin(async tx=>{await tx.unsafe('DROP SCHEMA IF EXISTS '+q+' CASCADE');for(const role of [plan.names.worker,plan.names.owner])await tx.unsafe('DROP ROLE IF EXISTS "'+role+'"');});const rows=await admin.unsafe('SELECT (SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname=$1)::integer AS schemas,(SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ($2,$3))::integer AS roles',[schema,plan.names.owner,plan.names.worker]);assert.deepEqual([rows[0].schemas,rows[0].roles],[0,0]);console.log('PASS: only the exact generated attendance schema and two fixture roles were removed');}catch{console.error('FAIL: generated attendance fixture cleanup; retain schema name '+schema);process.exitCode=1;}}
  await admin.end({timeout:2});
 }
}
