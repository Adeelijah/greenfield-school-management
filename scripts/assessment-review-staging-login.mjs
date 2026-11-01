// Explicit operator-run staging diagnostic. No dotenv, SDK or workload writer.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {inspectAssessmentReviewRoles,assessmentReviewRoleQuery,assessmentReviewRoles} from '../src/lib/academics/assessment-review-staging-runtime.ts';
const project='hweoqkbgmzycyznrbvng',host='aws-0-eu-west-1.pooler.supabase.com';
const school='0c594571-74c5-46fe-a835-a9b217a3a199';
const read=['schools','school_users','memberships','academic_sessions','terms','academic_levels','academic_sections','classes','students','enrollments','teacher_class_assignments','assessment_subjects','assessment_config_versions','assessment_scopes','assessment_subject_roster','assessment_teacher_subjects','assessment_scores','assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','assessment_audit','assessment_operation_receipts','assessment_source_write_gate'];
const history=['assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','assessment_audit','assessment_operation_receipts'];
let phase='explicit-input';
export function parseAssessmentReviewLoginInput(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==5||value.project!==project||typeof value.provision!=='boolean'||typeof value.password!=='string'||value.password.length<20||value.password.length>1024||value.password.includes('\0')||typeof value.certificate!=='string'||!value.certificate||typeof value.operatorPassword!=='string'||(value.provision?!value.operatorPassword:value.operatorPassword!==''))throw Error('Invalid explicit staging review input');
 return{...value};
}
function url(role,password){const u=new URL('postgresql://'+role+'.'+project+'@'+host+':5432/postgres');u.password=encodeURIComponent(password);return u.toString();}
const roleParameters=[assessmentReviewRoles[0],assessmentReviewRoles[1],assessmentReviewRoles[1]];
async function graph(tx){if(!inspectAssessmentReviewRoles(Array.from(await tx.unsafe(assessmentReviewRoleQuery,roleParameters))))throw Error('Review role graph differs');}
async function session(tx,login,role){const rows=await tx.unsafe('SELECT session_user AS login,current_user AS role');if(rows.length!==1||rows[0].login!==login||rows[0].role!==role)throw Error('Unexpected review execution identity');}
async function privatePrivileges(tx,actor){
 const schema=await tx.unsafe(`SELECT has_schema_privilege(current_user,'public','CREATE') AS create,has_schema_privilege(current_user,'auth','USAGE') AS auth,
  has_function_privilege(current_user,'public.lock_report_card_actor(uuid)','EXECUTE') AS actor,
  has_function_privilege(current_user,'public.guard_assessment_review_writes()','EXECUTE') AS guard,
  has_function_privilege(current_user,'public.assessment_mark_source_scope(uuid)','EXECUTE') AS revision,
  has_function_privilege(current_user,'public.save_assessment_subject_scores(uuid,jsonb)','EXECUTE') AS score,
  has_function_privilege(current_user,'public.save_attendance(uuid,jsonb)','EXECUTE') AS attendance`);
 if(schema.length!==1||schema[0].actor!==actor||['create','auth','guard','revision','score','attendance'].some(k=>schema[0][k]!==false))throw Error('Unexpected review schema/helper privileges');
 // CASE prevents sequence privilege checks from being evaluated on indexes.
 const sequences=await tx.unsafe(`SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE CASE WHEN n.nspname='public' AND c.relkind='S' THEN has_sequence_privilege(current_user,c.oid,'USAGE,SELECT,UPDATE') ELSE false END`);
 if(sequences.length)throw Error('Unexpected review sequence privileges');
}
export async function assessmentReviewLoginCheck(raw,connect,report=console.log){
 const input=parseAssessmentReviewLoginInput(raw);
 phase='certificate';
 const ca=readFileSync(input.certificate,'utf8');if(!ca.includes('-----BEGIN CERTIFICATE-----'))throw Error('Invalid certificate');
 const options={max:1,prepare:false,ssl:{ca,rejectUnauthorized:true},connect_timeout:20,idle_timeout:5,max_lifetime:120,onnotice:()=>{}};
 if(input.provision){
  phase='operator-connection';
  const operator=connect(url('postgres',input.operatorPassword),options);
  try{await operator.begin(async tx=>{
   await tx.unsafe("SELECT set_config('statement_timeout','30s',true),set_config('lock_timeout','5s',true)");
   phase='operator-preflight';await session(tx,'postgres','postgres');await graph(tx);
   phase='dedicated-password-configuration';
   // Fixed role only. PostgreSQL format quotes the bound secret as a literal.
   const rows=await tx.unsafe("SELECT format('ALTER ROLE greenfield_assessment_review_app PASSWORD %L',$1::text) AS statement",[input.password]);
   if(rows.length!==1||typeof rows[0].statement!=='string')throw Error('Password preparation failed');
   await tx.unsafe(rows[0].statement);
  });report('PASS: dedicated assessment-review LOGIN password configured; retain it locally');}finally{await operator.end({timeout:5});}
 }
 phase='dedicated-login-connection';
 const client=connect(url(assessmentReviewRoles[0],input.password),options);
 try{await client.begin(async tx=>{
  await tx.unsafe("SELECT set_config('statement_timeout','30s',true),set_config('lock_timeout','5s',true)");
  phase='dedicated-login-preflight';await session(tx,assessmentReviewRoles[0],assessmentReviewRoles[0]);await graph(tx);
  const denied=await tx.unsafe(`SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))`);
  if(denied.length)throw Error('Unexpected review LOGIN data privileges');
  await privatePrivileges(tx,false);
  phase='dedicated-runtime-preflight';
  await tx.unsafe('SET LOCAL ROLE "greenfield_assessment_review_runtime"');await session(tx,assessmentReviewRoles[0],assessmentReviewRoles[1]);
  const privileges=await tx.unsafe(`SELECT c.relname,a.attname,
   has_table_privilege(current_user,c.oid,'SELECT') AS read,
   has_table_privilege(current_user,c.oid,'INSERT') AS insert,
   has_table_privilege(current_user,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') AS mutation,
   has_column_privilege(current_user,c.oid,a.attnum,'SELECT') AS column_read,
   has_column_privilege(current_user,c.oid,a.attnum,'INSERT') AS column_insert,
   has_column_privilege(current_user,c.oid,a.attnum,'UPDATE') AS column_update,
   has_column_privilege(current_user,c.oid,a.attnum,'REFERENCES') AS column_reference,
   c.relrowsecurity,c.relforcerowsecurity
   FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
   WHERE n.nspname='public' AND c.relkind IN ('r','p')`);
  const present=new Set();
  for(const row of privileges){
   const readable=read.includes(row.relname),append=history.includes(row.relname);
   if(readable)present.add(row.relname);
   if(row.read!==readable||row.insert!==append||row.mutation!==false||row.column_read!==readable||row.column_insert!==append||row.column_update!==(readable&&row.attname==='id')||row.column_reference!==false||(readable&&(row.relrowsecurity!==true||row.relforcerowsecurity!==true)))throw Error('Unexpected review runtime table/column privilege');
  }
  if(present.size!==read.length)throw Error('Missing review relations');
  await privatePrivileges(tx,true);
  phase='school-rls-read';
  const schools=await tx.unsafe('SELECT id::text AS id FROM public.schools');
  if(schools.length!==1||schools[0].id!==school)throw Error('Review school RLS differs');
 });
 phase='post-transaction-role-reset';await session(client,assessmentReviewRoles[0],assessmentReviewRoles[0]);
 report('PASS: dedicated assessment-review TLS login, managed role graph and transaction role reset');
 report('PASS: exact review locking/append-only privileges and school RLS; report, score, attendance and revision-helper access denied');
 report('PASS: no source, review, finalization, audit or receipt writes; application review/finalization remains disabled');
 }finally{await client.end({timeout:5});}
}
async function main(){
 if(process.argv[2]!=='--explicit-staging-input'){console.error('SKIPPED: use verify-assessment-review-staging.ps1 for explicit staging setup');process.exitCode=2;return;}
 let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>32768)throw Error('Input too large');}
 const input=parseAssessmentReviewLoginInput(JSON.parse(raw));raw='';
 const {default:postgres}=await import('postgres');
 await assessmentReviewLoginCheck(input,postgres);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
 const code=error&&typeof error==='object'&&typeof error.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:'unavailable';
 console.error('FAIL: assessment-review staging connection check; phase='+phase+'; code='+code+'; no raw credential or database error printed');process.exitCode=1;
});
