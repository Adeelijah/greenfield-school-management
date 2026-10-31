// Opt-in schema-faithful local score-save rehearsal. No hosted URL is accepted.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {assessmentScoreUpgradePlan} from './lib/assessment-score-upgrade-plan.mjs';
import {reportReleaseGuardDDL} from './lib/report-release-disposable-guards.mjs';
import {executeSubjectScoreFixture} from '../src/lib/academics/assessment-score-postgres-fixture.ts';
const url=process.env.REPORT_CARD_TEST_DATABASE_URL;
if(!url||process.env.REPORT_CARD_TEST_CONFIRM!=='DISPOSABLE_REPORT_CARD_TEST_ONLY'||process.env.REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM!=='DISPOSABLE_ROLE_ADMIN_TEST_ONLY'){
 console.error('SKIPPED: local disposable URL and both explicit confirmations are required.');process.exitCode=2;
}else{
 let target;try{target=new URL(url);}catch{throw Error('Only the named local disposable database is permitted');}
 const database=decodeURIComponent(target.pathname.slice(1));
 if(!['postgres:','postgresql:'].includes(target.protocol)||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.search||target.hash||!/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(database))throw Error('Only the named local disposable database is permitted');
 const [{default:postgres},{assessmentFixtureDDL},{reportUpgradeSourcePlan,reportUpgradeProposalPlan},{reportUpgradeGuardPlan},{fixtureSecurityPlan}]=await Promise.all([import('postgres'),import('./lib/assessment-disposable-schema.mjs'),import('./lib/report-card-upgrade-plan.mjs'),import('./lib/report-card-upgrade-guards.mjs'),import('./lib/assessment-disposable-security-plan.mjs')]);
 const schema='rc_it_'+randomBytes(8).toString('hex'),q='"'+schema+'"',t=n=>q+'."'+n+'"';
 const ids=Object.fromEntries(['schoolId','foreignSchool','primary5ClassId','crecheClassId','primaryLevel','crecheLevel','primarySection','crecheSection','sessionId','termId','otherTerm','primaryScope','crecheScope','otherScope','teacherUser','teacherAuth','teacher','adminUser','adminAuth','admin','bursarUser','bursarAuth','bursar','pupil','enrollment','pupil2','enrollment2','crechePupil','crecheEnrollment','primaryAssignment','crecheAssignment','primarySubject','crecheSubject','primaryConfig','crecheConfig','primaryRoster','crecheRoster','primaryLink','crecheLink','hidden'].map(k=>[k,randomUUID()]));
 const plan=assessmentScoreUpgradePlan(schema,Object.fromEntries(['schoolId','primary5ClassId','crecheClassId','sessionId','termId'].map(k=>[k,ids[k]]))),security=fixtureSecurityPlan(schema,ids.schoolId),roles=[...Object.values(plan.roles),...Object.values(security.roles)];
 const [baseline,dependencies]=await Promise.all([readFile(new URL('../drizzle/0000_broad_slayback.sql',import.meta.url),'utf8'),readFile(new URL('../docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql',import.meta.url),'utf8')]);
 const source=reportUpgradeSourcePlan(schema,baseline,dependencies),proposal=reportUpgradeProposalPlan(schema,assessmentFixtureDDL(schema,{includeReports:true}).statements),guards=reportUpgradeGuardPlan(schema),releaseGuards=new Set(reportReleaseGuardDDL(schema).statements);
 const options={max:1,prepare:false,connect_timeout:5,connection:{search_path:'pg_catalog',statement_timeout:15000,lock_timeout:10000},onnotice:()=>{}};
 const marker='greenfield.score.fixture.'+randomBytes(16).toString('hex');
 const owner=postgres(url,options),parentClient=postgres(url,options);let one,two,claimed=false,phase='operator-preflight',lastSqlCode='none',releaseParent;
 const execute=async(tx,statements)=>{for(const sql of statements)await tx.unsafe(sql);};
 const insert=(tx,name,row)=>{const keys=Object.keys(row),values=keys.map(k=>row[k]!==null&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]);return tx.unsafe('INSERT INTO '+t(name)+' ('+keys.map(k=>'"'+k+'"').join(',')+') VALUES('+keys.map((k,i)=>'$'+(i+1)+(row[k]!==null&&typeof row[k]==='object'?'::text::jsonb':'')).join(',')+')',values);};
 const db=client=>({unsafe(){throw Error('Transaction only');},async begin(work){return client.begin(async tx=>{const r=await tx.unsafe('SELECT session_user AS login,current_user AS execution');assert.deepEqual([r[0].login,r[0].execution],[plan.roles.login,plan.roles.login]);await tx.unsafe('SET LOCAL ROLE "'+plan.roles.runtime+'"');return work({unsafe:async(sql,params)=>{try{return Array.from(await tx.unsafe(sql,params));}catch(e){lastSqlCode=e?.code??'unavailable';throw e;}}});});}});
 const save=(client,c,auth=ids.teacherAuth)=>executeSubjectScoreFixture(db(client),schema,async()=>({authUserId:auth}),c);
 const mutable=['assessment_scopes','fixture_source_write_claims','assessment_scores','assessment_audit','assessment_operation_receipts'];
 const protectedTables=['assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','report_cards','report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases'];
 const snapshot=async names=>{const all={};for(const name of names)all[name]=Array.from(await owner.unsafe('SELECT to_jsonb(r) AS row FROM '+t(name)+' r ORDER BY to_jsonb(r)::text'));return JSON.stringify(all);};
 const make=async(key,classKey='primary5')=>{
  const prefix=classKey==='primary5'?'primary':'creche',scope=(await owner.unsafe('SELECT revision FROM '+t('assessment_scopes')+' WHERE id=$1',[ids[prefix+'Scope']]))[0];
  const cells=classKey==='primary5'?[[ids.pupil,ids.enrollment],[ids.pupil2,ids.enrollment2]].flatMap(([studentId,enrollmentId])=>['ca','exam','optional'].map(componentKey=>({studentId,enrollmentId,componentKey,expectedVersion:0,numericScore:componentKey==='optional'?null:componentKey==='ca'?'25':'50',observationKey:null}))):[{studentId:ids.crechePupil,enrollmentId:ids.crecheEnrollment,componentKey:'development',expectedVersion:0,numericScore:null,observationKey:'developing'}];
  const persisted=await owner.unsafe('SELECT enrollment_id,component_key,version FROM '+t('assessment_scores')+' WHERE roster_id=$1',[ids[prefix+'Roster']]);for(const c of cells)c.expectedVersion=persisted.find(p=>p.enrollment_id===c.enrollmentId&&p.component_key===c.componentKey)?.version??0;
  return{action:'save_subject_scores',classKey,rosterId:ids[prefix+'Roster'],configVersionId:ids[prefix+'Config'],expectedConfigRevision:1,expectedRosterVersion:1,expectedScopeRevision:scope.revision,operationKey:key,reason:cells.some(c=>c.expectedVersion>0)?'Reviewed test correction':null,scores:cells};
 };
 try{
  assert.equal((await owner.unsafe('SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user'))[0].rolsuper,true,'Authorized local disposable superuser required');
  assert.equal((await owner.unsafe('SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1) OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=ANY($2::text[])) AS present',[schema,roles]))[0].present,false);
  await owner.begin(async tx=>{await tx.unsafe('CREATE SCHEMA '+q);await tx.unsafe('COMMENT ON SCHEMA '+q+" IS '"+marker+"'");});claimed=true;
  phase='schema-faithful-score-setup';
  await owner.begin(async tx=>{
   await execute(tx,[...source.baselineStatements,...source.dependencyStatements,...proposal,...guards.statements]);
   for(const [id,slug]of[[ids.schoolId,'score-upgrade'],[ids.foreignSchool,'score-foreign']])await insert(tx,'schools',{id,name:'Fictional score school',slug,final_primary_year:5});
   for(const role of ['teacher','admin','bursar']){await insert(tx,'school_users',{id:ids[role+'User'],auth_user_id:ids[role+'Auth'],display_name:'Test '+role});await insert(tx,'memberships',{id:ids[role],school_id:ids.schoolId,user_id:ids[role+'User'],role});}
   await insert(tx,'academic_sessions',{id:ids.sessionId,school_id:ids.schoolId,label:'Test session',starts_on:'2026-09-01',ends_on:'2027-07-31',is_current:true});
   for(const [id,current]of[[ids.termId,true],[ids.otherTerm,false]])await insert(tx,'terms',{id,school_id:ids.schoolId,session_id:ids.sessionId,name:current?'Test term':'Other term',starts_on:'2026-09-01',ends_on:'2026-12-18',is_current:current});
   for(const prefix of ['primary','creche']){
    const classId=prefix==='primary'?ids.primary5ClassId:ids.crecheClassId;
    await insert(tx,'academic_levels',{id:ids[prefix+'Level'],school_id:ids.schoolId,name:'Test '+prefix,stage:prefix,primary_year:prefix==='primary'?5:null,progression_order:prefix==='primary'?2:1});
    await insert(tx,'academic_sections',{id:ids[prefix+'Section'],school_id:ids.schoolId,level_id:ids[prefix+'Level'],name:'A',display_order:1});
    await insert(tx,'classes',{id:classId,school_id:ids.schoolId,name:'Test '+prefix,section:'A',level_id:ids[prefix+'Level'],section_id:ids[prefix+'Section']});
    await insert(tx,'teacher_class_assignments',{id:ids[prefix+'Assignment'],school_id:ids.schoolId,teacher_membership_id:ids.teacher,class_id:classId,session_id:ids.sessionId});
    await insert(tx,'assessment_subjects',{id:ids[prefix+'Subject'],school_id:ids.schoolId,code:prefix.toUpperCase(),name:'Test '+prefix});
    const components=prefix==='primary'?[{id:'ca',label:'CA',category:'ca',weight:30,maximumScore:30,required:true},{id:'exam',label:'Exam',category:'exam',weight:60,maximumScore:60,required:true},{id:'optional',label:'Optional',category:'other',weight:10,maximumScore:10,required:false}]:[{id:'development',label:'Development',category:'other',weight:100,maximumScore:1,required:true}];
    const grading=prefix==='primary'?{mode:'numeric',bands:[{min:0,max:100,label:'A'}]}:{mode:'observational',levels:[{id:'emerging',label:'Emerging'},{id:'developing',label:'Developing'},{id:'consistent',label:'Consistent'}]};
    await insert(tx,'assessment_config_versions',{id:ids[prefix+'Config'],school_id:ids.schoolId,config_key:randomUUID(),revision:1,level_id:ids[prefix+'Level'],session_id:ids.sessionId,term_id:ids.termId,subject_id:null,mode:grading.mode,state:'finalized',components,grading});
    await insert(tx,'assessment_scopes',{id:ids[prefix+'Scope'],school_id:ids.schoolId,class_id:classId,session_id:ids.sessionId,term_id:ids.termId,revision:1});
    await insert(tx,'assessment_subject_roster',{id:ids[prefix+'Roster'],school_id:ids.schoolId,scope_id:ids[prefix+'Scope'],subject_id:ids[prefix+'Subject'],config_version_id:ids[prefix+'Config']});
    await insert(tx,'assessment_teacher_subjects',{id:ids[prefix+'Link'],school_id:ids.schoolId,roster_id:ids[prefix+'Roster'],class_assignment_id:ids[prefix+'Assignment']});
   }
   await insert(tx,'assessment_scopes',{id:ids.otherScope,school_id:ids.schoolId,class_id:ids.primary5ClassId,session_id:ids.sessionId,term_id:ids.otherTerm,revision:1});
   for(const [p,e,c,n]of[[ids.pupil,ids.enrollment,ids.primary5ClassId,1],[ids.pupil2,ids.enrollment2,ids.primary5ClassId,2],[ids.crechePupil,ids.crecheEnrollment,ids.crecheClassId,3]]){await insert(tx,'students',{id:p,school_id:ids.schoolId,admission_number:'TEST-SCORE-'+n,first_name:'Test',last_name:'Pupil '+n});await insert(tx,'enrollments',{id:e,school_id:ids.schoolId,student_id:p,class_id:c,session_id:ids.sessionId});}
   for(const role of Object.values(security.roles))await tx.unsafe('CREATE ROLE "'+role+'" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION');
   await execute(tx,security.statements.filter(s=>!releaseGuards.has(s)));await execute(tx,plan.statements);
   const password=randomBytes(32).toString('hex');await tx.unsafe('CREATE ROLE "'+plan.roles.login+'" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD \''+password+'\'');
   for(const role of roles)await tx.unsafe('COMMENT ON ROLE "'+role+'" IS \''+marker+'\'');
   await tx.unsafe('GRANT "'+plan.roles.runtime+'" TO "'+plan.roles.login+'" WITH ADMIN FALSE,INHERIT FALSE,SET TRUE');await tx.unsafe('GRANT CONNECT ON DATABASE "'+database+'" TO "'+plan.roles.login+'"');
   const loginUrl=new URL(url);loginUrl.username=plan.roles.login;loginUrl.password=password;one=postgres(loginUrl.toString(),options);two=postgres(loginUrl.toString(),options);
  });
  phase='dedicated-score-role-preflight';
  const roleRows=await owner.unsafe('SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[])',[Object.values(plan.roles)]);assert.equal(roleRows.length,3);
  for(const row of roleRows){assert.equal(row.rolcanlogin,row.rolname===plan.roles.login);for(const flag of ['rolinherit','rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication'])assert.equal(row[flag],false);}
  const edges=await owner.unsafe('SELECT r.rolname AS role,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member JOIN pg_catalog.pg_roles r ON r.oid=m.roleid WHERE u.rolname=ANY($1::text[])',[Object.values(plan.roles)]);assert.deepEqual(Array.from(edges,r=>[r.role,r.admin_option,r.inherit_option,r.set_option]),[[plan.roles.runtime,false,false,true]]);
  const protectedBefore=await snapshot(protectedTables),otherRevision=(await owner.unsafe('SELECT revision FROM '+t('assessment_scopes')+' WHERE id=$1',[ids.otherScope]))[0].revision;
  phase='numeric-observational-save-and-replay';
  const first=await make('numeric-save-001'),applied=await save(one,first);assert.deepEqual(applied,{ok:true,kind:'applied',revision:first.expectedScopeRevision+1});assert.deepEqual(await save(two,first),{ok:true,kind:'replay',revision:applied.revision});
  assert.deepEqual(await save(one,{...first,scores:first.scores.map((s,i)=>i===0?{...s,numericScore:'24'}:s)}),{ok:false,code:'conflict'});
  const creche=await make('creche-save-001','creche');assert.equal((await save(two,creche)).ok,true);
  const correction=await make('numeric-correct-001');correction.scores.find(s=>s.componentKey==='exam').numericScore='59.9999';assert.equal((await save(one,correction,ids.adminAuth)).ok,true);
  assert.equal((await owner.unsafe('SELECT revision FROM '+t('assessment_scopes')+' WHERE id=$1',[ids.otherScope]))[0].revision,otherRevision);assert.equal(await snapshot(protectedTables),protectedBefore);
  const receipts=await owner.unsafe('SELECT outcome FROM '+t('assessment_operation_receipts')+' WHERE operation_key=$1',['numeric-correct-001']);assert.equal(receipts[0].outcome.request.reason,correction.reason);assert.equal(receipts[0].outcome.beforeScores.length,4);
  const optional=await make('optional-fill-001');optional.scores.find(s=>s.componentKey==='optional').numericScore='10';optional.scores.find(s=>s.componentKey==='exam').numericScore='60';assert.equal((await save(one,optional)).ok,true);
  const clear=await make('optional-clear-001');assert.equal((await save(one,clear)).ok,true);assert.equal(Number((await owner.unsafe('SELECT count(*) AS n FROM '+t('assessment_scores')+" WHERE component_key='optional'"))[0].n),0);
  console.log('PASS: actual upgraded numeric/observational score writes replay once, preserve correction input and old values, and invalidate only the affected scope once');
  phase='all-optional-subject-history';
  const optionalSubject=randomUUID(),optionalConfig=randomUUID(),optionalRoster=randomUUID();
  await owner.begin(async tx=>{
   await insert(tx,'assessment_subjects',{id:optionalSubject,school_id:ids.schoolId,code:'OPTIONAL-ONLY',name:'Optional test subject'});
   await insert(tx,'assessment_config_versions',{id:optionalConfig,school_id:ids.schoolId,config_key:randomUUID(),revision:1,level_id:ids.primaryLevel,session_id:ids.sessionId,term_id:ids.termId,subject_id:optionalSubject,mode:'numeric',state:'finalized',components:[{id:'optional',label:'Optional',category:'other',weight:100,maximumScore:10,required:false}],grading:{mode:'numeric',bands:[{min:0,max:100,label:'A'}]}});
   await insert(tx,'assessment_subject_roster',{id:optionalRoster,school_id:ids.schoolId,scope_id:ids.primaryScope,subject_id:optionalSubject,config_version_id:optionalConfig});
   await insert(tx,'assessment_teacher_subjects',{school_id:ids.schoolId,roster_id:optionalRoster,class_assignment_id:ids.primaryAssignment});
  });
  const emptyOptional={...await make('optional-empty-initial'),rosterId:optionalRoster,configVersionId:optionalConfig,reason:null,scores:[[ids.pupil,ids.enrollment],[ids.pupil2,ids.enrollment2]].map(([studentId,enrollmentId])=>({studentId,enrollmentId,componentKey:'optional',expectedVersion:0,numericScore:null,observationKey:null}))};
  const emptyApplied=await save(one,emptyOptional);assert.equal(emptyApplied.ok,true);
  const emptyNext={...emptyOptional,expectedScopeRevision:emptyApplied.revision,operationKey:'optional-empty-again'};assert.deepEqual(await save(one,emptyNext),{ok:false,code:'invalid'});
  assert.equal((await save(one,{...emptyNext,reason:'Reviewed empty optional register'})).ok,true);
  console.log('PASS: even an all-optional empty save invalidates once and later saves require a correction reason despite having no score rows');
  phase='value-and-version-denials';
  const valid=await make('denial-grid-001'),beforeDenied=await snapshot(mutable);
  const cases=[{...valid,expectedScopeRevision:valid.expectedScopeRevision-1},{...valid,expectedConfigRevision:2},{...valid,expectedRosterVersion:2},{...valid,reason:null},{...valid,scores:valid.scores.slice(1)},{...valid,scores:valid.scores.map((s,i)=>i===0?{...s,expectedVersion:99}:s)},{...valid,scores:valid.scores.map(s=>s.componentKey==='exam'?{...s,numericScore:'60.0001'}:s)},{...valid,scores:valid.scores.map((s,i)=>i===0?{...s,studentId:ids.crechePupil}:s)}];
  for(const c of cases){assert.equal((await save(one,c)).ok,false);assert.equal(await snapshot(mutable),beforeDenied);}
  const invalidObs=await make('bad-observation-001','creche');invalidObs.scores[0].observationKey='invented';assert.deepEqual(await save(one,invalidObs),{ok:false,code:'invalid'});assert.equal(await snapshot(mutable),beforeDenied);
  console.log('PASS: stale scope/config/roster/cell versions, incomplete or substituted enrollment grids, missing correction reasons and out-of-range/unknown values leave every row unchanged');
  phase='complete-current-authority';
  assert.deepEqual(await save(one,first,ids.bursarAuth),{ok:false,code:'forbidden'});
  await insert(owner,'memberships',{id:ids.hidden,school_id:ids.foreignSchool,user_id:ids.teacherUser,role:'teacher'});assert.deepEqual(await save(one,first),{ok:false,code:'forbidden'});await owner.unsafe('UPDATE '+t('memberships')+' SET status=\'suspended\' WHERE id=$1',[ids.hidden]);assert.equal((await save(one,first)).kind,'replay');
  await owner.unsafe('UPDATE '+t('assessment_teacher_subjects')+' SET is_active=false WHERE id=$1',[ids.primaryLink]);assert.deepEqual(await save(one,first),{ok:false,code:'forbidden'});await owner.unsafe('UPDATE '+t('assessment_teacher_subjects')+' SET is_active=true WHERE id=$1',[ids.primaryLink]);
  await owner.unsafe('UPDATE '+t('memberships')+' SET status=\'suspended\' WHERE id=$1',[ids.teacher]);assert.deepEqual(await save(one,first),{ok:false,code:'forbidden'});await owner.unsafe('UPDATE '+t('memberships')+' SET status=\'active\' WHERE id=$1',[ids.teacher]);
  console.log('PASS: bursar, hidden second active school, suspended actor and missing subject permission are denied before historical receipt replay');
  phase='persistence-rollback-retry';
  for(const table of ['assessment_scores','assessment_audit','assessment_operation_receipts']){
   const req=await make('retry-'+table),before=await snapshot(mutable);
   await owner.unsafe('CREATE FUNCTION '+t('score_fail')+'() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'Injected score persistence failure\'; END $$');await owner.unsafe('CREATE TRIGGER score_injected BEFORE INSERT OR UPDATE ON '+t(table)+' FOR EACH STATEMENT EXECUTE FUNCTION '+t('score_fail')+'()');
   assert.deepEqual(await save(one,req),{ok:false,code:'unavailable'});assert.equal(await snapshot(mutable),before);await owner.unsafe('DROP TRIGGER score_injected ON '+t(table));await owner.unsafe('DROP FUNCTION '+t('score_fail')+'()');assert.equal((await save(one,req)).kind,'applied');assert.equal((await save(one,req)).kind,'replay');
  }
  const outer=await make('outer-reject-001'),beforeOuter=await snapshot(mutable);await assert.rejects(db(one).begin(async tx=>{const r=await tx.unsafe('SELECT '+t('save_subject_scores')+'($1::uuid,$2::text::jsonb) AS outcome',[ids.teacherAuth,JSON.stringify(outer)]);assert.equal(r[0].outcome.ok,true);throw Error('Outer rejection');}));assert.equal(await snapshot(mutable),beforeOuter);assert.equal((await save(one,outer)).kind,'applied');
  console.log('PASS: score, audit, receipt and outer post-write failures roll back scores, revisions, transaction claims and history; the same key retries then replays');
  phase='independent-login-races';
  const pids=await Promise.all([one.unsafe('SELECT pg_backend_pid() AS pid'),two.unsafe('SELECT pg_backend_pid() AS pid')]);assert.notEqual(pids[0][0].pid,pids[1][0].pid);
  const same=await make('same-key-race-001'),sameResults=await Promise.all([save(one,same),save(two,same)]);assert.deepEqual(sameResults.map(r=>r.kind).sort(),['applied','replay']);
  const stale=await make('stale-key-race-001'),staleResults=await Promise.all([save(one,stale),save(two,{...stale,operationKey:'stale-key-race-002'})]);assert.equal(staleResults.filter(r=>r.ok).length,1);assert.equal(staleResults.find(r=>!r.ok).code,'conflict');
  console.log('PASS: distinct unprivileged LOGIN backends serialize identical keys and reject competing stale keys without duplicate revisions');
  phase='score-first-zero-row-parent';
  const heldCommand=await make('held-score-save-001'),parentPid=(await parentClient.unsafe('SELECT pg_backend_pid() AS pid'))[0].pid;
  let scoreAcquired;const scoreReady=new Promise(r=>{scoreAcquired=r;}),scoreHeld=new Promise(r=>{releaseParent=r;});
  const heldSave=db(one).begin(async tx=>{const r=await tx.unsafe('SELECT '+t('save_subject_scores')+'($1::uuid,$2::text::jsonb) AS outcome',[ids.teacherAuth,JSON.stringify(heldCommand)]);assert.equal(r[0].outcome.ok,true);scoreAcquired();await scoreHeld;});
  let scoreTimer;try{await Promise.race([scoreReady,heldSave.then(()=>{throw Error('Held score transaction ended early');}),new Promise((_,reject)=>{scoreTimer=setTimeout(()=>reject(Error('Score gate deadline')),20000);})]);}finally{clearTimeout(scoreTimer);}
  const zeroParent=parentClient.begin(tx=>tx.unsafe('UPDATE '+t('memberships')+" SET status=status WHERE false"));let parentBlocked=false;
  try{for(let n=0;n<150;n++){if(Number((await owner.unsafe('SELECT cardinality(pg_blocking_pids($1::integer)) AS n',[parentPid]))[0].n)>0){parentBlocked=true;break;}await delay(20);}assert.equal(parentBlocked,true);}finally{releaseParent();}await heldSave;await zeroParent;
  console.log('PASS: a successful in-flight score save holds the discovery gate through audit/receipt commit and blocks even zero-row authority writes');
  phase='parent-gate-before-discovery';
  let acquired;const ready=new Promise(r=>{acquired=r;}),held=new Promise(r=>{releaseParent=r;});const parent=parentClient.begin(async tx=>{await tx.unsafe('UPDATE '+t('teacher_class_assignments')+' SET ended_at=clock_timestamp() WHERE id=$1',[ids.primaryAssignment]);acquired();await held;});
  let timer;try{await Promise.race([ready,parent.then(()=>{throw Error('Parent gate ended early');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Parent deadline')),20000);})]);}finally{clearTimeout(timer);}
  const pending=save(one,first);let blocked=false;try{for(let n=0;n<150;n++){if(Number((await owner.unsafe('SELECT cardinality(pg_blocking_pids($1::integer)) AS n',[pids[0][0].pid]))[0].n)>0){blocked=true;break;}await delay(20);}assert.equal(blocked,true);}finally{releaseParent();}await parent;assert.deepEqual(await pending,{ok:false,code:'forbidden'});
  console.log('PASS: assignment writer blocks the score request before authority discovery; committed assignment loss denies an old key');
  phase='private-role-grants-and-history';
  for(const sql of ['SELECT * FROM '+t('assessment_scores'),'UPDATE '+t('report_cards')+' SET version=version WHERE false','SET ROLE "'+plan.roles.owner+'"','SET ROLE "'+security.roles.writer+'"'])await assert.rejects(one.unsafe(sql),e=>e.code==='42501');
  await one.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE "'+plan.roles.runtime+'"');for(const name of ['assessment_scores','assessment_scopes','assessment_audit','assessment_operation_receipts','report_cards']){const rows=await tx.unsafe('SELECT has_table_privilege(current_user,$1::text,\'SELECT,INSERT,UPDATE,DELETE,TRUNCATE\') OR has_any_column_privilege(current_user,$1::text,\'SELECT,INSERT,UPDATE\') AS allowed',[schema+'.'+name]);assert.equal(rows[0].allowed,false);}const helpers=await tx.unsafe('SELECT has_function_privilege(current_user,$1::text,\'EXECUTE\') AS allowed',[schema+'.fixture_mark_source_scope(uuid)']);assert.equal(helpers[0].allowed,false);});
  for(const table of protectedTables)assert.equal((await owner.unsafe('SELECT has_table_privilege($1::text,$2::text,\'INSERT,UPDATE,DELETE,TRUNCATE\') AS allowed',[plan.roles.owner,schema+'.'+table]))[0].allowed,false);
  assert.equal((await owner.unsafe('SELECT revision FROM '+t('assessment_scopes')+' WHERE id=$1',[ids.otherScope]))[0].revision,otherRevision);
  assert.equal((await one.unsafe('SELECT current_user AS role'))[0].role,plan.roles.login);assert.equal(await snapshot(protectedTables),protectedBefore);
  console.log('PASS: private worker has no direct source/history/report data or revision-helper privileges; report/source documents remain unchanged and role reset returns to LOGIN');
 }catch(error){console.error('FAIL: assessment score disposable rehearsal; phase='+phase+'; code='+(typeof error?.code==='string'?error.code:'unavailable')+'; sql_code='+lastSqlCode+'; outcome='+(error?.actual?.ok===false?error.actual.code:'unavailable'));process.exitCode=1;
 }finally{
  if(releaseParent)releaseParent();await Promise.allSettled([one?.end({timeout:2}),two?.end({timeout:2}),parentClient.end({timeout:2})]);
  if(claimed){try{await owner.begin(async tx=>{
   const namespace=await tx.unsafe("SELECT obj_description(oid,'pg_namespace') AS marker FROM pg_catalog.pg_namespace WHERE nspname=$1",[schema]);
   if(namespace.length!==1||namespace[0].marker!==marker)throw Error('Generated schema acknowledgement changed');
   const installed=[];
   for(const role of roles){const row=await tx.unsafe("SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_catalog.pg_roles WHERE rolname=$1",[role]);if(row.length){if(row.length!==1||row[0].marker!==marker)throw Error('Generated role acknowledgement changed');installed.push(role);}}
   await tx.unsafe('DROP SCHEMA '+q+' CASCADE');
   if(installed.includes(plan.roles.login))await tx.unsafe('REVOKE CONNECT ON DATABASE "'+database+'" FROM "'+plan.roles.login+'"');
   for(const role of installed)await tx.unsafe('DROP ROLE "'+role+'"');
  });assert.equal((await owner.unsafe('SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1) OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=ANY($2::text[])) AS present',[schema,roles]))[0].present,false);console.log('PASS: exact nonce-acknowledged generated score schema and roles removed');}catch{console.error('FAIL: score fixture cleanup; schema='+schema);process.exitCode=1;}}
  await owner.end({timeout:2});
 }
}
