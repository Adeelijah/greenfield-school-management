// Opt-in PostgreSQL concurrency tests. Isolated throwaway schema in an explicitly
// named disposable database. No Greenfield production schema or migrations.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';

const url=process.env.REPORT_CARD_TEST_DATABASE_URL;
if(process.env.REPORT_CARD_TEST_CONFIRM!=='DISPOSABLE_REPORT_CARD_TEST_ONLY'||!url){
 console.error('SKIPPED: explicit disposable database URL and confirmation required.');
 process.exitCode=2;
}else{
 let parsed;
 try{parsed=new URL(url);}catch{throw Error('Invalid PostgreSQL URL');}
 if(!['postgres:','postgresql:'].includes(parsed.protocol)||
   !/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(parsed.pathname.slice(1)))){
   throw Error('Refusing non-disposable database name.');
 }
 const sql=postgres(url,{max:5,connect_timeout:5,prepare:false});
 const schema='rc_it_'+randomBytes(8).toString('hex');
 const table=name=>'"'+schema+'"."'+name+'"';
 const reports=table('reports'),receipts=table('receipts'),audits=table('audits'),releases=table('releases');
 const reset=async()=>{
   await sql.unsafe('TRUNCATE '+releases+','+audits+','+receipts+','+reports);
   await sql.unsafe("INSERT INTO "+reports+" (school_id,id,stage,version) VALUES ('school-a','report-1','draft',1),('school-b','report-2','draft',1)");
 };
 const transition=async({school='school-a',id='report-1',actor='teacher-1',key='key-1',fingerprint='same',expected=1,action='submit',injectFailure=false}={})=>{
   try{
     return await sql.begin(async tx=>{
       // A row lock serializes writers; idempotency is evaluated AFTER locking.
       const rows=await tx.unsafe('SELECT * FROM '+reports+' WHERE school_id=$1 AND id=$2 FOR UPDATE',[school,id]);
       if(rows.length!==1)return {ok:false,code:'not_found'};
       const old=rows[0];
       const previous=await tx.unsafe('SELECT * FROM '+receipts+' WHERE school_id=$1 AND actor_id=$2 AND operation_key=$3',[school,actor,key]);
       if(previous.length){
         const p=previous[0];
         return p.report_id===id&&p.fingerprint===fingerprint?{ok:true,kind:'replay',version:p.resulting_version}:{ok:false,code:'conflict'};
       }
       if(old.version!==expected)return {ok:false,code:'stale_version'};
       const allowed={submit:['draft','submitted'],approve:['submitted','approved'],publish:['approved','published']};
       const next={submit:'submitted',approve:'approved',publish:'published'};
       // Strict state transition: second entries above are NOT permitted for new keys.
       if(old.stage!==allowed[action]?.[0])return {ok:false,code:'invalid_transition'};
       const result=await tx.unsafe('UPDATE '+reports+' SET stage=$1,version=version+1 WHERE school_id=$2 AND id=$3 AND version=$4 RETURNING version',[next[action],school,id,expected]);
       if(result.length!==1)throw Error('conditional update failed');
       await tx.unsafe('INSERT INTO '+audits+' (school_id,report_id,action,version) VALUES ($1,$2,$3,$4)',[school,id,action,result[0].version]);
       if(injectFailure)throw Error('injected audit/receipt failure');
       await tx.unsafe('INSERT INTO '+receipts+' (school_id,actor_id,operation_key,report_id,fingerprint,resulting_version) VALUES ($1,$2,$3,$4,$5,$6)',[school,actor,key,id,fingerprint,result[0].version]);
       if(action==='publish')await tx.unsafe('INSERT INTO '+releases+' (school_id,report_id,version) VALUES ($1,$2,$3)',[school,id,result[0].version]);
       return {ok:true,kind:'applied',version:result[0].version};
     });
   }catch(e){if(injectFailure&&e.message==='injected audit/receipt failure')return {ok:false,code:'rolled_back'};throw e;}
 };
 try{
   await sql.unsafe('CREATE SCHEMA "'+schema+'"');
   await sql.unsafe('CREATE TABLE '+reports+' (school_id text NOT NULL,id text NOT NULL,stage text NOT NULL CHECK(stage IN (\'draft\',\'submitted\',\'approved\',\'published\')),version integer NOT NULL CHECK(version>0),PRIMARY KEY(school_id,id))');
   await sql.unsafe('CREATE TABLE '+receipts+' (school_id text NOT NULL,actor_id text NOT NULL,operation_key text NOT NULL,report_id text NOT NULL,fingerprint text NOT NULL,resulting_version integer NOT NULL,PRIMARY KEY(school_id,actor_id,operation_key),FOREIGN KEY(school_id,report_id) REFERENCES '+reports+'(school_id,id))');
   await sql.unsafe('CREATE TABLE '+audits+' (school_id text NOT NULL,report_id text NOT NULL,action text NOT NULL,version integer NOT NULL,FOREIGN KEY(school_id,report_id) REFERENCES '+reports+'(school_id,id))');
   await sql.unsafe('CREATE TABLE '+releases+' (school_id text NOT NULL,report_id text NOT NULL,version integer NOT NULL,UNIQUE(school_id,report_id,version),FOREIGN KEY(school_id,report_id) REFERENCES '+reports+'(school_id,id))');

   await reset();
   const competing=await Promise.all([transition({key:'first'}),transition({key:'second'})]);
   assert.equal(competing.filter(x=>x.ok&&x.kind==='applied').length,1);
   assert.equal(competing.filter(x=>!x.ok&&x.code==='stale_version').length,1);
   assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM '+audits))[0].n,1);
   console.log('PASS: concurrent conflicting writes serialize to one commit');

   await reset();
   const same=await Promise.all([transition(),transition()]);
   assert.equal(same.filter(x=>x.kind==='applied').length,1);
   assert.equal(same.filter(x=>x.kind==='replay').length,1);
   assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM '+receipts))[0].n,1);
   assert.deepEqual(await transition({fingerprint:'changed'}),{ok:false,code:'conflict'});
   console.log('PASS: duplicate idempotency keys replay once; conflicting payload denied');

   await reset();
   assert.deepEqual(await transition({school:'school-b',id:'report-1'}),{ok:false,code:'not_found'});
   assert.equal((await sql.unsafe('SELECT version FROM '+reports+" WHERE school_id='school-a' AND id='report-1'"))[0].version,1);
   console.log('PASS: explicit tenant-scoped lookup rejects cross-school report');

   await reset();
   assert.deepEqual(await transition({injectFailure:true}),{ok:false,code:'rolled_back'});
   assert.equal((await sql.unsafe('SELECT version FROM '+reports+" WHERE school_id='school-a' AND id='report-1'"))[0].version,1);
   assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM '+audits))[0].n,0);
   assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM '+receipts))[0].n,0);
   console.log('PASS: injected failure rolls back report, audit and receipt');

   await reset();
   assert.deepEqual(await transition({action:'publish'}),{ok:false,code:'invalid_transition'});
   assert.equal((await transition()).ok,true);
   assert.equal((await transition({action:'approve',actor:'admin',key:'approve',expected:2})).ok,true);
   const publish=await Promise.all([
     transition({action:'publish',actor:'admin',key:'publish-1',expected:3}),
     transition({action:'publish',actor:'admin',key:'publish-2',expected:3})
   ]);
   assert.equal(publish.filter(x=>x.kind==='applied').length,1);
   assert.equal(publish.filter(x=>!x.ok).length,1);
   assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM '+releases))[0].n,1);
   console.log('PASS: publication stage and concurrent release guards');
 }finally{
   try{await sql.unsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');}finally{await sql.end();}
 }
}
