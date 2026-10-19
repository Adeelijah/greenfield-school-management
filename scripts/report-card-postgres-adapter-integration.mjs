// Real PostgreSQL integration of executeReportTransaction through the disposable adapter.
// Run ONLY against the separately created disposable database, never Supabase.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import postgres from 'postgres';
import {executeReportTransaction} from '../src/lib/academics/report-card-transaction-port.ts';
import {disposableReportTransactionRunner} from '../src/lib/academics/report-card-postgres-disposable-adapter.ts';

const url=process.env.REPORT_CARD_TEST_DATABASE_URL;
if(process.env.REPORT_CARD_TEST_CONFIRM!=='DISPOSABLE_REPORT_CARD_TEST_ONLY'||!url){
 console.error('SKIPPED: explicit disposable database URL and confirmation required.');
 process.exitCode=2;
}else{
 const parsed=new URL(url);
 if(!['postgres:','postgresql:'].includes(parsed.protocol)||
 !/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(parsed.pathname.slice(1))))
 throw Error('Refusing a non-disposable database URL.');
 const client=postgres(url,{max:5,connect_timeout:5,prepare:false,onnotice:()=>{}});
 // Bind serialized JSON as text explicitly. Never let an inferred JSON type
 // run JSON.stringify on an already serialized string a second time.
 const textParameters=params=>(params??[]).map(value=>typeof value==='string'?client.typed(value,25):value);
 const wrap=connection=>({unsafe:(query,params)=>connection.unsafe(query,textParameters(params))});
 const sql=wrap(client);
 const schema='rc_it_'+randomBytes(8).toString('hex');
 const table=name=>'"'+schema+'"."'+name+'"';
 const reports=table('reports'),receipts=table('receipts'),audits=table('audits'),releases=table('releases');
 const record={schoolId:'school-a',studentId:'student-1',classId:'class-1',sessionId:'session-1',termId:'term-1',stage:'draft',version:1,assessmentVersion:5,submittedBy:null,approvedBy:null,publishedAt:null,returnReason:null};
 const projection={schoolId:'school-a',studentId:'student-1',classId:'class-1',sessionId:'session-1',termId:'term-1',status:'ready_for_review',publishable:false,subjects:[{subjectId:'math',complete:true,finalized:true,result:{studentId:'student-1',subjectId:'math',sessionId:'session-1',termId:'term-1',state:'finalized',total:86,grade:'A',remark:null,missingComponents:[],componentScores:[]}}]};
 const members=[
  {id:'teacher-1',schoolId:'school-a',role:'teacher',status:'active'},
  {id:'admin-1',schoolId:'school-a',role:'admin',status:'active'},
  {id:'teacher-other',schoolId:'school-b',role:'teacher',status:'active'}
 ];
 const assignment={id:'assign-1',schoolId:'school-a',membershipId:'teacher-1',classId:'class-1',sessionId:'session-1',status:'active'};
 const db={
  unsafe:sql.unsafe,
  begin:callback=>client.begin(async tx=>callback(wrap(tx)))
 };
 // Loader reads all trusted fixtures inside the same transaction; never trusts request-provided roles.
 const loader=async(tx,school,reportId,actorId)=>{
  const membershipRows=await tx.unsafe('SELECT data FROM '+table('memberships')+' WHERE school_id=$1 AND id=$2',[school,actorId]);
  if(membershipRows.length!==1)return null;
  const assignmentRows=await tx.unsafe('SELECT data FROM '+table('assignments')+' WHERE school_id=$1 AND membership_id=$2',[school,actorId]);
  const projectionRows=await tx.unsafe('SELECT data,revision FROM '+table('projections')+' WHERE school_id=$1 AND report_id=$2',[school,reportId]);
  if(projectionRows.length!==1)return null;
  return {projection:projectionRows[0].data,context:{membership:membershipRows[0].data,assignments:assignmentRows.map(x=>x.data),assessmentRevision:projectionRows[0].revision}};
 };
 const runner=disposableReportTransactionRunner(db,schema,loader);
 const request=(actor='teacher-1',action='submit',expectedVersion=1,key='submit-1')=>({schoolId:'school-a',reportId:'report-1',actorMembershipId:actor,fingerprint:'f'.repeat(64),command:{action,expectedVersion,assessmentVersion:5,idempotencyKey:key},occurredAt:'2026-10-19T12:00:00Z'});
 const reset=async()=>{
  await sql.unsafe('TRUNCATE '+releases+','+audits+','+receipts+','+reports);
  await sql.unsafe('INSERT INTO '+reports+' (school_id,id,version,record) VALUES ($1,$2,$3,$4::text::jsonb)',['school-a','report-1',1,JSON.stringify(record)]);
 };
 const count=async(name)=>(await sql.unsafe('SELECT count(*)::int AS n FROM '+table(name)))[0].n;
 try{
  await sql.unsafe('CREATE SCHEMA "'+schema+'"');
  await sql.unsafe('CREATE TABLE '+reports+' (school_id text NOT NULL,id text NOT NULL,version integer NOT NULL,record jsonb NOT NULL,PRIMARY KEY(school_id,id))');
  await sql.unsafe('CREATE TABLE '+receipts+' (school_id text NOT NULL,actor_id text NOT NULL,operation_key text NOT NULL,report_id text NOT NULL,fingerprint text NOT NULL,resulting_version integer NOT NULL,PRIMARY KEY(school_id,actor_id,operation_key))');
  await sql.unsafe('CREATE TABLE '+audits+' (school_id text NOT NULL,report_id text NOT NULL,version integer NOT NULL,payload jsonb NOT NULL)');
  await sql.unsafe('CREATE TABLE '+releases+' (school_id text NOT NULL,report_id text NOT NULL,version integer NOT NULL,published_at text NOT NULL,UNIQUE(school_id,report_id,version))');
  await sql.unsafe('CREATE TABLE '+table('memberships')+' (school_id text NOT NULL,id text NOT NULL,data jsonb NOT NULL,PRIMARY KEY(school_id,id))');
  await sql.unsafe('CREATE TABLE '+table('assignments')+' (school_id text NOT NULL,membership_id text NOT NULL,data jsonb NOT NULL)');
  await sql.unsafe('CREATE TABLE '+table('projections')+' (school_id text NOT NULL,report_id text NOT NULL,revision integer NOT NULL,data jsonb NOT NULL,PRIMARY KEY(school_id,report_id))');
  for(const m of members)await sql.unsafe('INSERT INTO '+table('memberships')+' (school_id,id,data) VALUES ($1,$2,$3::text::jsonb)',[m.schoolId,m.id,JSON.stringify(m)]);
  await sql.unsafe('INSERT INTO '+table('assignments')+' (school_id,membership_id,data) VALUES ($1,$2,$3::text::jsonb)',['school-a','teacher-1',JSON.stringify(assignment)]);
  await sql.unsafe('INSERT INTO '+table('projections')+' (school_id,report_id,revision,data) VALUES ($1,$2,$3,$4::text::jsonb)',['school-a','report-1',5,JSON.stringify(projection)]);

  await reset();
  // Diagnose fixture lookup without printing credentials or student data.
  const reportCheck=await sql.unsafe('SELECT version,record,jsonb_typeof(record) AS record_type FROM '+reports+' WHERE school_id=$1 AND id=$2',['school-a','report-1']);
  const memberCheck=await sql.unsafe('SELECT id FROM '+table('memberships')+' WHERE school_id=$1 AND id=$2',['school-a','teacher-1']);
  const projectionCheck=await sql.unsafe('SELECT revision FROM '+table('projections')+' WHERE school_id=$1 AND report_id=$2',['school-a','report-1']);
  assert.equal(reportCheck.length,1,'fixture report lookup failed');
  assert.equal(memberCheck.length,1,'fixture membership lookup failed');
  assert.equal(projectionCheck.length,1,'fixture projection lookup failed');
  assert.equal(reportCheck[0].record_type,'object','report JSONB was stored as a scalar');
  assert.deepEqual(reportCheck[0].record,record,'report JSONB round trip changed the fixture');
  assert.equal(typeof reportCheck[0].record,'object','report JSONB was not decoded to an object');
  assert.equal(reportCheck[0].record.schoolId,'school-a','report JSONB school mismatch');
  const trustedCheck=await db.begin(tx=>loader(tx,'school-a','report-1','teacher-1'));
  assert.ok(trustedCheck,'trusted fixture loader returned null');
  assert.equal(trustedCheck.context.membership.id,'teacher-1','trusted fixture membership mismatch');
  assert.deepEqual(trustedCheck.projection,projection,'projection JSONB round trip failed');
  assert.deepEqual(trustedCheck.context.membership,members[0],'membership JSONB round trip failed');
  assert.deepEqual(trustedCheck.context.assignments,[assignment],'assignment JSONB round trip failed');
  console.log('PASS: fixture JSONB round trips and trusted source lookups');
  const concurrent=await Promise.all([executeReportTransaction(runner,request('teacher-1','submit',1,'key-a')),executeReportTransaction(runner,request('teacher-1','submit',1,'key-b'))]);
  assert.equal(concurrent.filter(x=>x.ok&&x.kind==='applied').length,1,JSON.stringify(concurrent));
  assert.equal(concurrent.filter(x=>!x.ok&&x.code==='stale_version').length,1,JSON.stringify(concurrent));
  assert.equal(await count('audits'),1);assert.equal(await count('receipts'),1);
  const storedReport=(await sql.unsafe('SELECT record,jsonb_typeof(record) AS kind FROM '+reports))[0];
  assert.equal(storedReport.kind,'object','updated report must remain a JSONB object');
  assert.equal(storedReport.record.stage,'submitted');
  assert.equal(storedReport.record.version,2);
  const storedAudit=(await sql.unsafe('SELECT payload,jsonb_typeof(payload) AS kind FROM '+audits))[0];
  assert.equal(storedAudit.kind,'object','audit must be stored as a JSONB object');
  assert.equal(storedAudit.payload.schoolId,'school-a');
  assert.equal(storedAudit.payload.version,2);
  console.log('PASS: actual transaction port serializes concurrent submissions and JSONB writes');

  await reset();
  const duplicate=await Promise.all([executeReportTransaction(runner,request()),executeReportTransaction(runner,request())]);
  assert.equal(duplicate.filter(x=>x.ok&&x.kind==='applied').length,1,JSON.stringify(duplicate));
  assert.equal(duplicate.filter(x=>x.ok&&x.kind==='replay').length,1,JSON.stringify(duplicate));
  assert.equal(await count('receipts'),1);
  console.log('PASS: actual transaction port replays duplicate idempotency key');

  await reset();
  const other=await executeReportTransaction(runner,{...request('teacher-other'),schoolId:'school-b'});
  assert.equal(other.ok,false);
  const forbidden=await executeReportTransaction(runner,request('teacher-other'));
  assert.equal(forbidden.ok,false);
  assert.equal(await count('audits'),0);
  console.log('PASS: trusted membership lookup rejects cross-school actor');

  await reset();
  // The receipt insert is deliberately forced to fail AFTER report and audit writes.
  await sql.unsafe('ALTER TABLE '+receipts+' ADD CONSTRAINT reject_receipts CHECK (operation_key <> \'force-fail\')');
  const failure=await executeReportTransaction(runner,request('teacher-1','submit',1,'force-fail'));
  assert.deepEqual({ok:failure.ok,code:failure.code},{ok:false,code:'transaction_failed'});
  assert.equal((await sql.unsafe('SELECT version FROM '+reports))[0].version,1);
  assert.equal(await count('audits'),0);assert.equal(await count('receipts'),0);
  console.log('PASS: actual transaction port rolls back failed receipt insertion');

  await reset();
  const early=await executeReportTransaction(runner,request('admin-1','publish',1,'early'));
  assert.equal(early.ok,false);
  assert.equal((await executeReportTransaction(runner,request())).ok,true);
  assert.equal((await executeReportTransaction(runner,request('admin-1','approve',2,'approve-1'))).ok,true);
  const publishing=await Promise.all([
   executeReportTransaction(runner,request('admin-1','publish',3,'publish-a')),
   executeReportTransaction(runner,request('admin-1','publish',3,'publish-b'))
  ]);
  assert.equal(publishing.filter(x=>x.ok&&x.kind==='applied').length,1,JSON.stringify(publishing));
  assert.equal(publishing.filter(x=>!x.ok).length,1);
  assert.equal(await count('releases'),1);
  console.log('PASS: actual transaction port guards approval and single publication');
 }finally{
  try{await sql.unsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');}finally{await client.end();}
 }
}
