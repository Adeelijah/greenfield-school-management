// Local fixture only. No managed schema, SDK session, or live write enablement.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {financePostingFixturePlan} from './lib/finance-posting-fixture.mjs';
import {executeFinancePostingFixture} from '../src/lib/finance/finance-postgres-fixture.ts';

const url=process.env.REPORT_CARD_TEST_DATABASE_URL;
if(!url||process.env.REPORT_CARD_TEST_CONFIRM!=='DISPOSABLE_REPORT_CARD_TEST_ONLY'||process.env.REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM!=='DISPOSABLE_ROLE_ADMIN_TEST_ONLY'){
 console.error('SKIPPED: explicit local disposable URL and test/role confirmations required.');process.exitCode=2;
}else{
 let phase='target-preflight',sqlstate='none',operator,one,two,attempted=false,schema,roles=[],marker;
 try{
  const target=new URL(url),database=decodeURIComponent(target.pathname.slice(1));
  if(!['postgres:','postgresql:'].includes(target.protocol)||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.search||target.hash||!/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(database))throw Error('Only the named local disposable database without URL options is allowed');
  const {default:postgres}=await import('postgres');
  const options={max:1,prepare:false,connect_timeout:5,connection:{search_path:'pg_catalog',statement_timeout:20000,lock_timeout:5000,default_transaction_isolation:'read committed'},onnotice:()=>{}};
  operator=postgres(url,options);
  const identity=(await operator.unsafe("SELECT rolsuper,current_database() AS db,current_setting('server_version_num')::int AS version FROM pg_catalog.pg_roles WHERE rolname=current_user"))[0];
  assert.ok(identity?.rolsuper===true&&identity.db===database&&identity.version>=160000);
  schema='fi_it_'+randomBytes(8).toString('hex');marker=randomBytes(32).toString('hex');
  const plan=financePostingFixturePlan(schema),q='"'+schema+'"',t=n=>q+'."'+n+'"';roles=Object.values(plan.roles);
  assert.equal((await operator.unsafe('SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1) OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=ANY($2::text[])) AS present',[schema,roles]))[0].present,false);
  const password=randomBytes(32).toString('hex');
  const ids=Object.fromEntries(['school','foreign','session','term','klass','schedule','fee','bursar','admin','teacher','outsider','bursarUser','adminUser','teacherUser','outsiderUser','bursarAuth','adminAuth','teacherAuth','outsiderAuth','student1','student2','enrollment1','enrollment2','invoice1','invoice2'].map(k=>[k,randomUUID()]));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const insert=async(tx,name,row)=>{
   const keys=Object.keys(row);
   await tx.unsafe('INSERT INTO '+t(name)+'('+keys.join(',')+') VALUES('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));
  };
  const post=(db,command,authUserId=ids.bursarAuth)=>executeFinancePostingFixture({async begin(work){try{return await db.begin(work);}catch(error){if(typeof error?.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code))sqlstate=error.code;throw error;}}},schema,async()=>({authUserId}),command);
  const denied=code=>({ok:false,code});
  const base={action:'record_payment',invoiceId:ids.invoice1,expectedVersion:1,operationKey:'finance-payment-01',amount:'50',method:'bank_transfer',reference:'TEST-BANK-01',receivedOn:today};
  const snapshot=async()=>{const rows={};for(const name of plan.storage.financeRelations)rows[name]=await operator.unsafe('SELECT to_jsonb(x) AS row FROM '+t(name)+' x ORDER BY to_jsonb(x)::text');return JSON.stringify(rows);};
  const changedMembership=(tx,member,status)=>tx.unsafe('UPDATE '+t('memberships')+' SET status=$2 WHERE id=$1',[member,status]);
  phase='fixture-install';
  await operator.begin(async tx=>{
   await tx.unsafe('CREATE SCHEMA '+q);attempted=true;
   await tx.unsafe('COMMENT ON SCHEMA '+q+" IS '"+marker+"'");
   for(const role of roles){
    const login=role===plan.roles.login;
    await tx.unsafe('CREATE ROLE "'+role+'" '+(login?'LOGIN':'NOLOGIN')+' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION'+(login?" PASSWORD '"+password+"'":''));
    await tx.unsafe('COMMENT ON ROLE "'+role+'" IS \''+marker+'\'');
   }
   await tx.unsafe('GRANT "'+plan.roles.worker+'" TO "'+plan.roles.login+'" WITH ADMIN FALSE,INHERIT FALSE,SET TRUE');
   await tx.unsafe('GRANT CONNECT ON DATABASE "'+database+'" TO "'+plan.roles.login+'"');
   for(const sql of [...plan.storage.statements,...plan.statements])await tx.unsafe(sql);
   for(const id of [ids.school,ids.foreign])await insert(tx,'schools',{id});
   for(const key of ['bursar','admin','teacher','outsider']){
    await insert(tx,'school_users',{id:ids[key+'User'],auth_user_id:ids[key+'Auth']});
    await insert(tx,'memberships',{id:ids[key],school_id:key==='outsider'?ids.foreign:ids.school,user_id:ids[key+'User'],role:key==='outsider'?'bursar':key,status:'active'});
   }
   await insert(tx,'academic_sessions',{id:ids.session,school_id:ids.school});
   await insert(tx,'terms',{id:ids.term,school_id:ids.school,session_id:ids.session});
   await insert(tx,'classes',{id:ids.klass,school_id:ids.school});
   await insert(tx,'finance_schedules',{id:ids.schedule,school_id:ids.school,class_id:ids.klass,session_id:ids.session,term_id:ids.term,active_version:1});
   await insert(tx,'finance_schedule_versions',{school_id:ids.school,schedule_id:ids.schedule,version:1,class_id:ids.klass,session_id:ids.session,term_id:ids.term,total_kobo:12500});
   await insert(tx,'finance_schedule_items',{school_id:ids.school,schedule_id:ids.schedule,schedule_version:1,fee_id:ids.fee,label:'TEST Tuition',amount_kobo:12500});
   for(const n of [1,2]){
    const student=ids['student'+n],enrollment=ids['enrollment'+n],invoice=ids['invoice'+n],audit=randomUUID(),key='finance-fixture-issue-'+n;
    await insert(tx,'students',{id:student,school_id:ids.school});
    await insert(tx,'enrollments',{id:enrollment,school_id:ids.school,student_id:student,class_id:ids.klass,session_id:ids.session});
    await insert(tx,'finance_invoices',{id:invoice,school_id:ids.school,student_id:student,enrollment_id:enrollment,class_id:ids.klass,session_id:ids.session,term_id:ids.term,schedule_id:ids.schedule,schedule_version:1,total_kobo:12500,currency:'NGN',issued_on:today,version:1});
    await insert(tx,'finance_invoice_lines',{school_id:ids.school,invoice_id:invoice,schedule_id:ids.schedule,schedule_version:1,fee_id:ids.fee,label:'TEST Tuition',amount_kobo:12500});
    await insert(tx,'finance_audit',{id:audit,school_id:ids.school,invoice_id:invoice,actor_id:ids.bursar,action:'issue_invoice',before_version:0,after_version:1});
    await tx.unsafe('INSERT INTO '+t('finance_operation_receipts')+'(school_id,actor_id,operation_key,command,audit_id,invoice_id,version,outcome) VALUES($1,$2,$3,$4::text::jsonb,$5,$6,1,$7::text::jsonb)',[ids.school,ids.bursar,key,JSON.stringify({action:'issue_invoice',invoiceId:invoice,operationKey:key}),audit,invoice,JSON.stringify({ok:true,action:'issue_invoice',invoiceId:invoice,version:1,eventId:invoice,receiptId:null})]);
   }
  });
  const loginUrl=new URL(url);loginUrl.username=plan.roles.login;loginUrl.password=password;
  one=postgres(loginUrl.toString(),options);two=postgres(loginUrl.toString(),options);
  phase='role-boundary';
  const shape=await operator.unsafe('SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[])',[roles]);
  assert.equal(shape.length,3);
  for(const role of shape){assert.equal(role.rolcanlogin,role.rolname===plan.roles.login);for(const flag of ['rolinherit','rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication'])assert.equal(role[flag],false);}
  const edges=await operator.unsafe('SELECT r.rolname AS role,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member JOIN pg_catalog.pg_roles r ON r.oid=m.roleid WHERE u.rolname=ANY($1::text[])',[roles]);
  assert.deepEqual(Array.from(edges,r=>[r.role,r.admin_option,r.inherit_option,r.set_option]),[[plan.roles.worker,false,false,true]]);
  const pidOne=(await one.unsafe('SELECT pg_backend_pid() AS pid'))[0].pid,pidTwo=(await two.unsafe('SELECT pg_backend_pid() AS pid'))[0].pid;
  assert.notEqual(pidOne,pidTwo);
  const deniedSql=e=>e.code==='42501';
  const asWorker=(db,work)=>db.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE "'+plan.roles.worker+'"');return work(tx);});
  await assert.rejects(one.unsafe('SELECT '+t('post_finance')+'($1::uuid,$2::text::jsonb)',[ids.bursarAuth,JSON.stringify(base)]),deniedSql);
  await assert.rejects(one.begin(tx=>tx.unsafe('SET LOCAL ROLE "'+plan.roles.owner+'"')),deniedSql);
  for(const name of ['finance_invoices','finance_operation_receipts','memberships'])await assert.rejects(asWorker(one,tx=>tx.unsafe('SELECT * FROM '+t(name)+' WHERE false')),deniedSql);
  await assert.rejects(asWorker(one,tx=>tx.unsafe('UPDATE '+t('finance_invoices')+' SET version=version WHERE false')),deniedSql);
  assert.deepEqual(await post(operator,base),denied('forbidden'));
  assert.deepEqual((await asWorker(one,tx=>tx.unsafe('SELECT '+t('post_finance')+'($1::uuid,$2::text::jsonb) AS outcome',[ids.bursarAuth,JSON.stringify({...base,schoolId:ids.school})])))[0].outcome,denied('invalid'));
  console.log('PASS: distinct non-inheriting login sessions can use only the private finance API after SET LOCAL ROLE; direct finance and membership access is denied');

  phase='authority-and-replay';
  const empty=await snapshot();
  for(const principal of [ids.teacherAuth,ids.outsiderAuth,randomUUID()])assert.deepEqual(await post(one,base,principal),denied('forbidden'));
  assert.equal(await snapshot(),empty);
  const pair=await Promise.all([post(one,base),post(two,{...base,amount:'50.00'})]);
  assert.deepEqual(pair.map(r=>r.kind).sort(),['applied','replay']);assert.deepEqual(pair[0].result,pair[1].result);
  const totals=(await operator.unsafe('SELECT (SELECT count(*)::int FROM '+t('finance_payments')+') AS payments,(SELECT count(*)::int FROM '+t('finance_receipts')+') AS receipts,(SELECT count(*)::int FROM '+t('finance_operation_receipts')+') AS operations,(SELECT version FROM '+t('finance_invoices')+' WHERE id=$1) AS version',[ids.invoice1]))[0];
  assert.deepEqual({...totals},{payments:1,receipts:1,operations:3,version:2});
  const first=pair[0].result;
  assert.deepEqual(await post(one,{...base,amount:'51'}),denied('conflict'));
  const ambiguity=randomUUID();
  await operator.begin(tx=>insert(tx,'memberships',{id:ambiguity,school_id:ids.foreign,user_id:ids.bursarUser,role:'bursar',status:'active'}));
  assert.deepEqual(await post(one,base),denied('forbidden'));
  await operator.unsafe('DELETE FROM '+t('memberships')+' WHERE id=$1',[ambiguity]);
  let pending;
  await operator.begin(async tx=>{
   await changedMembership(tx,ids.bursar,'suspended');
   pending=post(one,base);
   let blocked=false;
   for(let i=0;i<100&&!blocked;i++){blocked=(await tx.unsafe('SELECT pg_backend_pid()=ANY(pg_blocking_pids($1::int)) AS blocked',[pidOne]))[0].blocked;if(!blocked)await delay(25);}
   assert.ok(blocked);
  });
  assert.deepEqual(await pending,denied('forbidden'));
  await changedMembership(operator,ids.bursar,'active');
  assert.deepEqual(await post(two,base),{ok:true,kind:'replay',result:first});
  console.log('PASS: a same-key race applies once, normalized retry replays, changed payload conflicts, and complete current authority precedes replay');

  phase='rollback';
  const before=await snapshot(),candidate={...base,expectedVersion:2,operationKey:'finance-rollback-01',reference:'TEST-BANK-02',amount:'10'};
  await operator.begin(async tx=>{
   await tx.unsafe('CREATE FUNCTION '+t('reject_test_write')+"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $f$ BEGIN RAISE EXCEPTION 'fixture injection' USING ERRCODE='FI001'; END $f$");
   await tx.unsafe('REVOKE ALL ON FUNCTION '+t('reject_test_write')+'() FROM PUBLIC');
  });
  for(const [name,event] of [['finance_payments','INSERT'],['finance_receipts','INSERT'],['finance_invoices','UPDATE'],['finance_audit','INSERT'],['finance_operation_receipts','INSERT']]){
   await operator.unsafe('CREATE TRIGGER finance_test_failure BEFORE '+event+' ON '+t(name)+' FOR EACH ROW EXECUTE FUNCTION '+t('reject_test_write')+'()');
   sqlstate='none';assert.deepEqual(await post(one,candidate),denied('unavailable'));assert.equal(sqlstate,'FI001');
   await operator.unsafe('DROP TRIGGER finance_test_failure ON '+t(name));
   assert.equal(await snapshot(),before);
  }
  let completed=false;
  const outer={begin:work=>one.begin(async tx=>{completed=(await work(tx)).ok;throw Error('fixture outer rollback');})};
  assert.deepEqual(await post(outer,candidate),denied('unavailable'));assert.equal(completed,true);assert.equal(await snapshot(),before);
  assert.deepEqual(await post(two,{...candidate,amount:'75.01'}),denied('overpayment'));
  console.log('PASS: actual private postings roll back at all five write boundaries and after an outer failure; overpayments are denied');

  phase='stale-and-reversal';sqlstate='none';
  const competitors=await Promise.all([post(one,candidate),post(two,{...candidate,operationKey:'finance-race-02',reference:'TEST-BANK-03'})]);
  assert.equal(competitors.filter(r=>r.ok&&r.kind==='applied').length,1);assert.equal(competitors.filter(r=>r.code==='conflict').length,1);
  const reversal={action:'reverse_payment',invoiceId:ids.invoice1,expectedVersion:3,operationKey:'finance-reversal-01',paymentId:first.eventId,reason:'TEST incorrect transfer entry'};
  const original=async()=>Array.from(await operator.unsafe('SELECT to_jsonb(p) AS payment,to_jsonb(r) AS receipt FROM '+t('finance_payments')+' p JOIN '+t('finance_receipts')+' r ON r.school_id=p.school_id AND r.payment_id=p.id WHERE p.id=$1',[first.eventId]));
  const originalBefore=await original();
  assert.deepEqual(await post(one,reversal),denied('forbidden'));
  const reversed=await post(two,reversal,ids.adminAuth);assert.equal(reversed.kind,'applied');assert.equal(reversed.result.version,4);assert.equal(reversed.result.receiptId,null);
  assert.deepEqual(await post(one,reversal,ids.adminAuth),{...reversed,kind:'replay'});
  await operator.unsafe('UPDATE '+t('memberships')+" SET role='bursar' WHERE id=$1",[ids.admin]);
  assert.deepEqual(await post(one,reversal,ids.adminAuth),denied('forbidden'));
  await operator.unsafe('UPDATE '+t('memberships')+" SET role='admin' WHERE id=$1",[ids.admin]);
  assert.deepEqual(await post(one,{...reversal,expectedVersion:4,operationKey:'finance-reversal-02'},ids.adminAuth),denied('conflict'));
  assert.deepEqual(await post(two,{...base,invoiceId:ids.invoice2,operationKey:'finance-reference-02'}),denied('duplicate_reference'));
  assert.deepEqual(await original(),originalBefore);
  assert.equal((await one.unsafe('SELECT current_user AS role'))[0].role,plan.roles.login);
  console.log('PASS: stale competing payments cannot both apply; admin-only reversal preserves the original payment/receipt and reserves the reference across invoices');
 }catch(error){
  const code=typeof error?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:'unavailable';
  console.error('FAIL: finance posting disposable rehearsal; phase='+phase+'; code='+code+'; sqlstate='+sqlstate);process.exitCode=1;
 }finally{
  for(const db of [one,two])if(db)try{await db.end({timeout:5});}catch{process.exitCode=1;console.error('FAIL: finance login cleanup');}
  if(operator){
   try{if(attempted)await operator.begin(async tx=>{
    const ns=await tx.unsafe("SELECT obj_description(oid,'pg_namespace') AS marker FROM pg_catalog.pg_namespace WHERE nspname=$1",[schema]);
    const found=await tx.unsafe("SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[])",[roles]);
    if(!ns.length&&!found.length)return;
    if(ns.length!==1||ns[0].marker!==marker||found.length!==roles.length||found.some(r=>r.marker!==marker))throw Error('Fixture acknowledgement differs');
    await tx.unsafe('DROP SCHEMA "'+schema+'" CASCADE');
    await tx.unsafe('REVOKE CONNECT ON DATABASE "'+decodeURIComponent(new URL(url).pathname.slice(1))+'" FROM "'+schema+'_login"');
    for(const role of roles.toReversed())await tx.unsafe('DROP ROLE "'+role+'"');
   });if(attempted)console.log('PASS: only the exact acknowledged generated finance schema and roles were removed or rolled back');}
   catch{console.error('FAIL: finance fixture cleanup requires review; no unacknowledged object removed');process.exitCode=1;}
   finally{try{await operator.end({timeout:5});}catch{console.error('FAIL: finance operator cleanup');process.exitCode=1;}}
  }
 }
}
