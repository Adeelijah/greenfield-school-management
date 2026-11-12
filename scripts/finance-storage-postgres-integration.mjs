// Explicit local disposable storage rehearsal. Owner-run, no SDK or role proof.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {financeStorageFixturePlan} from './lib/finance-storage-fixture.mjs';
const url=process.env.REPORT_CARD_TEST_DATABASE_URL;
if(!url||process.env.REPORT_CARD_TEST_CONFIRM!=='DISPOSABLE_REPORT_CARD_TEST_ONLY'){
 console.error('SKIPPED: explicit local disposable URL and confirmation required.');process.exitCode=2;
}else{
 let phase='target-preflight',client,created=false,schema,nonce;
 try{
  const target=new URL(url);
  if(!['postgres:','postgresql:'].includes(target.protocol)||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.search||target.hash||!/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(target.pathname.slice(1))))throw Error('Only the named local disposable database without URL options is allowed');
  const {default:postgres}=await import('postgres');
  client=postgres(url,{max:1,prepare:false,connect_timeout:5,connection:{search_path:'pg_catalog',statement_timeout:20000,lock_timeout:5000},onnotice:()=>{}});
  const operator=await client.unsafe('SELECT current_user AS name,rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user');
  if(operator.length!==1||operator[0].rolsuper!==true)throw Error('Local disposable superuser required');
  schema='fi_it_'+randomBytes(8).toString('hex');nonce=randomBytes(32).toString('hex');
  const plan=financeStorageFixturePlan(schema),q='"'+schema+'"',t=n=>q+'."'+n+'"';
  const collision=await client.unsafe('SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1) AS present',[schema]);assert.equal(collision[0].present,false);
  const ids=Object.fromEntries(['school','foreign','user','auth','bursar','session','term','klass','student1','student2','enrollment1','enrollment2','schedule','fee1','fee2','invoice'].map(k=>[k,randomUUID()]));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const snapshot=async()=>{const rows={};for(const name of plan.financeRelations)rows[name]=await client.unsafe('SELECT to_jsonb(x) AS row FROM '+t(name)+' x ORDER BY to_jsonb(x)::text');return JSON.stringify(rows);};
  async function audit(tx,{invoice=ids.invoice,action,before,after,payment=null,receipt=null,reversal=null,key}){
   const auditId=randomUUID();
   await tx.unsafe('INSERT INTO '+t('finance_audit')+' (id,school_id,invoice_id,actor_id,action,before_version,after_version,payment_id,receipt_id,reversal_id,payment_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[auditId,ids.school,invoice,ids.bursar,action,before,after,payment,receipt,reversal,action==='record_payment'?after:null]);
   const outcome={ok:true,action,invoiceId:invoice,version:after,eventId:action==='issue_invoice'?invoice:action==='record_payment'?payment:reversal,receiptId:action==='record_payment'?receipt:null};
   return{auditId,outcome,async operation(){await tx.unsafe('INSERT INTO '+t('finance_operation_receipts')+' (school_id,actor_id,operation_key,command,audit_id,invoice_id,version,outcome) VALUES($1,$2,$3,$4::text::jsonb,$5,$6,$7,$8::text::jsonb)',[ids.school,ids.bursar,key,JSON.stringify({action,invoiceId:invoice,operationKey:key}),auditId,invoice,after,JSON.stringify(outcome)]);}};
  }
  async function issue(tx,{invoice=ids.invoice,enrollment=ids.enrollment1,student=ids.student1,total=12500,omitLine=false}={}){
   await tx.unsafe('INSERT INTO '+t('finance_invoices')+' (id,school_id,student_id,enrollment_id,class_id,session_id,term_id,schedule_id,schedule_version,total_kobo,currency,issued_on,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9,\'NGN\',$10::date,1)',[invoice,ids.school,student,enrollment,ids.klass,ids.session,ids.term,ids.schedule,total,today]);
   await tx.unsafe('INSERT INTO '+t('finance_invoice_lines')+' SELECT school_id,$1::uuid,schedule_id,schedule_version,fee_id,label,amount_kobo FROM '+t('finance_schedule_items')+' WHERE schedule_id=$2 AND schedule_version=1'+(omitLine?' AND fee_id=$3':''),omitLine?[invoice,ids.schedule,ids.fee1]:[invoice,ids.schedule]);
   const event=await audit(tx,{invoice,action:'issue_invoice',before:0,after:1,key:'fixture-issue-'+invoice});await event.operation();
  }
  async function payment(tx,{amount=5000,key='fixture-payment-01',reference='BANK-001',version=2,omitReceipt=false,omitAudit=false,omitOperation=false,failAfter=null}={}){
   const paymentId=randomUUID(),receiptId=randomUUID();
   const fail=at=>{if(failAfter===at)throw Object.assign(Error('Intentional fixture failure'),{fixtureFailure:true});};
   await tx.unsafe('INSERT INTO '+t('finance_payments')+' (id,school_id,invoice_id,amount_kobo,method,reference,received_on,recorded_by,posted_version) VALUES($1,$2,$3,$4,\'bank_transfer\',$5,$6::date,$7,$8)',[paymentId,ids.school,ids.invoice,amount,reference,today,ids.bursar,version]);fail('payment');
   if(!omitReceipt)await tx.unsafe('INSERT INTO '+t('finance_receipts')+' (id,school_id,invoice_id,payment_id,amount_kobo,currency) VALUES($1,$2,$3,$4,$5,\'NGN\')',[receiptId,ids.school,ids.invoice,paymentId,amount]);fail('receipt');
   await tx.unsafe('UPDATE '+t('finance_invoices')+' SET version=version+1 WHERE id=$1',[ids.invoice]);fail('invoice');
   if(omitAudit)return{paymentId,receiptId};
   const event=await audit(tx,{action:'record_payment',before:version-1,after:version,payment:paymentId,receipt:receiptId,key});fail('audit');if(!omitOperation)await event.operation();fail('operation');return{paymentId,receiptId};
  }
  phase='fixture-install';
  await client.begin(async tx=>{
   await tx.unsafe('CREATE SCHEMA '+q);created=true;await tx.unsafe('COMMENT ON SCHEMA '+q+" IS '"+nonce+"'");
   for(const sql of plan.statements)await tx.unsafe(sql);
   await tx.unsafe('INSERT INTO '+t('schools')+' VALUES($1),($2)',[ids.school,ids.foreign]);
   await tx.unsafe('INSERT INTO '+t('school_users')+' VALUES($1,$2)',[ids.user,ids.auth]);
   await tx.unsafe('INSERT INTO '+t('memberships')+' VALUES($1,$2,$3,\'bursar\',\'active\')',[ids.bursar,ids.school,ids.user]);
   await tx.unsafe('INSERT INTO '+t('academic_sessions')+' VALUES($1,$2)',[ids.session,ids.school]);
   await tx.unsafe('INSERT INTO '+t('terms')+' VALUES($1,$2,$3)',[ids.term,ids.school,ids.session]);
   await tx.unsafe('INSERT INTO '+t('classes')+' VALUES($1,$2)',[ids.klass,ids.school]);
   for(const n of [1,2]){await tx.unsafe('INSERT INTO '+t('students')+' VALUES($1,$2)',[ids['student'+n],ids.school]);await tx.unsafe('INSERT INTO '+t('enrollments')+' VALUES($1,$2,$3,$4,$5)',[ids['enrollment'+n],ids.school,ids['student'+n],ids.klass,ids.session]);}
   await tx.unsafe('INSERT INTO '+t('finance_schedules')+' VALUES($1,$2,$3,$4,$5,1)',[ids.schedule,ids.school,ids.klass,ids.session,ids.term]);
   await tx.unsafe('INSERT INTO '+t('finance_schedule_versions')+' VALUES($1,$2,1,$3,$4,$5,12500)',[ids.school,ids.schedule,ids.klass,ids.session,ids.term]);
   await tx.unsafe('INSERT INTO '+t('finance_schedule_items')+' VALUES($1,$2,1,$3,\'TEST Tuition\',10000),($1,$2,1,$4,\'TEST Books\',2500)',[ids.school,ids.schedule,ids.fee1,ids.fee2]);
   await issue(tx);
  });
  console.log('PASS: ten finance relations bind pinned schedule versions, exact enrollment/term identity and complete invoice/audit/receipt issuance');
  phase='binding-and-completeness';
  const baseline=await snapshot();
  for(const test of [{student:ids.student1,enrollment:ids.enrollment2,code:'23503'},{student:ids.student2,enrollment:ids.enrollment2,total:12501,code:'23503'},{student:ids.student2,enrollment:ids.enrollment2,omitLine:true,code:'23514'}]){await assert.rejects(client.begin(tx=>issue(tx,{...test,invoice:randomUUID()})),e=>e.code===test.code);assert.equal(await snapshot(),baseline);}
  console.log('PASS: substituted enrollment, changed pinned total and incomplete invoice lines roll back without altering existing records');
  phase='posting-atomicity';
  for(const failAfter of ['payment','receipt','invoice','audit','operation']){await assert.rejects(client.begin(tx=>payment(tx,{failAfter})),e=>e.fixtureFailure===true);assert.equal(await snapshot(),baseline);}
  for(const options of [{omitReceipt:true,code:'23503'},{omitAudit:true,code:'23514'},{omitOperation:true,code:'23514'}]){await assert.rejects(client.begin(tx=>payment(tx,options)),e=>e.code===options.code);assert.equal(await snapshot(),baseline);}
  const posted=await client.begin(tx=>payment(tx));
  const paid=await snapshot();
  await assert.rejects(client.begin(tx=>payment(tx,{key:'fixture-payment-01',reference:'BANK-COLLISION',version:3,amount:1000})),e=>e.code==='23505');assert.equal(await snapshot(),paid);
  console.log('PASS: all five injected failures, missing receipt/audit/operation rows and a duplicate operation key roll back payment, receipt, invoice version and audit together');
  phase='overpayment-and-history';
  await assert.rejects(client.begin(tx=>payment(tx,{key:'fixture-overpayment',reference:'BANK-OVER',version:3,amount:7501})),e=>e.code==='23514');assert.equal(await snapshot(),paid);
  for(const name of ['finance_schedule_versions','finance_schedule_items','finance_invoice_lines','finance_payments','finance_receipts','finance_reversals','finance_audit','finance_operation_receipts'])for(const sql of ['UPDATE '+t(name)+' SET school_id=school_id WHERE false','DELETE FROM '+t(name)+' WHERE false'])await assert.rejects(client.begin(tx=>tx.unsafe(sql)),e=>e.code==='42501');
  // Include the whole finance FK graph so a missing dependent table cannot mask the trigger denial.
  await assert.rejects(client.begin(tx=>tx.unsafe('TRUNCATE '+plan.financeRelations.map(t).join(','))),e=>e.code==='42501');
  await assert.rejects(client.begin(tx=>tx.unsafe('UPDATE '+t('finance_invoices')+' SET total_kobo=total_kobo+1 WHERE id=$1',[ids.invoice])),e=>e.code==='23514');assert.equal(await snapshot(),paid);
  console.log('PASS: historical balances reject overpayment; invoice fact edits, zero-row history updates/deletes and truncation are denied');
  phase='full-reversal';
  const originalPayment=await client.unsafe('SELECT to_jsonb(p) AS payment,to_jsonb(r) AS receipt FROM '+t('finance_payments')+' p JOIN '+t('finance_receipts')+' r ON r.school_id=p.school_id AND r.payment_id=p.id WHERE p.id=$1',[posted.paymentId]);
  const reversalId=randomUUID();
  await client.begin(async tx=>{
   await tx.unsafe('INSERT INTO '+t('finance_reversals')+' (id,school_id,invoice_id,payment_id,receipt_id,amount_kobo,reason,recorded_by,posted_version) VALUES($1,$2,$3,$4,$5,5000,\'TEST incorrect entry\',$6,3)',[reversalId,ids.school,ids.invoice,posted.paymentId,posted.receiptId,ids.bursar]);
   await tx.unsafe('UPDATE '+t('finance_invoices')+' SET version=3 WHERE id=$1',[ids.invoice]);
   const event=await audit(tx,{action:'reverse_payment',before:2,after:3,payment:posted.paymentId,receipt:posted.receiptId,reversal:reversalId,key:'fixture-reversal-01'});await event.operation();
  });
  const reversed=await snapshot();
  assert.deepEqual(Array.from(await client.unsafe('SELECT to_jsonb(p) AS payment,to_jsonb(r) AS receipt FROM '+t('finance_payments')+' p JOIN '+t('finance_receipts')+' r ON r.school_id=p.school_id AND r.payment_id=p.id WHERE p.id=$1',[posted.paymentId])),Array.from(originalPayment));
  await assert.rejects(client.begin(tx=>payment(tx,{key:'fixture-reference-reuse',reference:'BANK-001',version:4,amount:1000})),e=>e.code==='23505');assert.equal(await snapshot(),reversed);
  await assert.rejects(client.begin(tx=>tx.unsafe('INSERT INTO '+t('finance_reversals')+' SELECT $1::uuid,school_id,invoice_id,payment_id,receipt_id,amount_kobo,reason,recorded_by,4 FROM '+t('finance_reversals')+' WHERE id=$2',[randomUUID(),reversalId])),e=>e.code==='23505');assert.equal(await snapshot(),reversed);
  console.log('PASS: one full reasoned reversal preserves the original payment/receipt and permanently reserves its bank reference');
  phase='new-fee-version';
  const old=await client.unsafe('SELECT to_jsonb(i) AS invoice FROM '+t('finance_invoices')+' i WHERE id=$1',[ids.invoice]);
  await client.begin(async tx=>{await tx.unsafe('INSERT INTO '+t('finance_schedule_versions')+' VALUES($1,$2,2,$3,$4,$5,13000)',[ids.school,ids.schedule,ids.klass,ids.session,ids.term]);await tx.unsafe('INSERT INTO '+t('finance_schedule_items')+' VALUES($1,$2,2,$3,\'TEST Tuition\',10500),($1,$2,2,$4,\'TEST Books\',2500)',[ids.school,ids.schedule,ids.fee1,ids.fee2]);await tx.unsafe('UPDATE '+t('finance_schedules')+' SET active_version=2 WHERE id=$1',[ids.schedule]);});
  assert.deepEqual(Array.from(await client.unsafe('SELECT to_jsonb(i) AS invoice FROM '+t('finance_invoices')+' i WHERE id=$1',[ids.invoice])),Array.from(old));
  console.log('PASS: a newer fee schedule becomes current without changing the already-issued invoice');
 }catch(error){
  const code=typeof error?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:'unavailable';
  const constraint=typeof error?.constraint_name==='string'&&/^[a-z0-9_]{1,128}$/.test(error.constraint_name)?error.constraint_name:'none';
  console.error('FAIL: finance storage disposable rehearsal; phase='+phase+'; code='+code+'; constraint='+constraint);process.exitCode=1;
 }finally{
  if(client){try{if(created){const found=await client.unsafe("SELECT obj_description(oid,'pg_namespace') AS acknowledgement FROM pg_catalog.pg_namespace WHERE nspname=$1",[schema]);if(found.length===0){console.log('PASS: attempted finance schema installation rolled back; no generated schema remains');}else{if(found.length!==1||found[0].acknowledgement!==nonce)throw Error('Fixture acknowledgement differs');await client.unsafe('DROP SCHEMA "'+schema+'" CASCADE');console.log('PASS: only the exact nonce-acknowledged generated finance schema was removed; no roles were created');}}}catch{console.error('FAIL: finance fixture cleanup requires review; no unacknowledged object removed');process.exitCode=1;}finally{try{await client.end({timeout:5});}catch{console.error('FAIL: finance storage connection cleanup; code=unavailable');process.exitCode=1;}}}
 }
}
