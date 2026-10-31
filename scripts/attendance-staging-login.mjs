// Explicit operator-run staging connection/provisioning only. Never loads dotenv.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {inspectAttendanceRoles,attendanceRoleQuery,attendanceRoles} from '../src/lib/attendance/attendance-staging-runtime.ts';
let phase='explicit-input';
const host='aws-0-eu-west-1.pooler.supabase.com',project='hweoqkbgmzycyznrbvng';
const tables=['attendance_registers','attendance_marks','attendance_audit','attendance_receipts','schools','school_users','memberships','classes','academic_levels','academic_sections','academic_sessions','students','enrollments','teacher_class_assignments','assessment_source_write_gate','report_cards','report_card_snapshots','report_card_releases','report_card_audit','report_card_operation_receipts'];
export function parseAttendanceLoginInput(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==5||value.project!==project||typeof value.provision!=='boolean'||typeof value.password!=='string'||value.password.length<20||value.password.length>1024||typeof value.certificate!=='string'||!value.certificate||typeof value.operatorPassword!=='string'||(value.provision?!value.operatorPassword:value.operatorPassword!==''))throw Error('Invalid explicit staging input');
 return{...value};
}
function url(role,password){const u=new URL('postgresql://'+role+'.'+project+'@'+host+':5432/postgres');u.password=encodeURIComponent(password);return u.toString();}
export async function attendanceLoginCheck(input,connect,report=console.log){
 phase='certificate';
 const ca=readFileSync(input.certificate,'utf8');if(!ca.includes('-----BEGIN CERTIFICATE-----'))throw Error('Invalid certificate');
 const options={max:1,prepare:false,ssl:{ca,rejectUnauthorized:true},connect_timeout:20,idle_timeout:5,max_lifetime:120,onnotice:()=>{}};
 if(input.provision){
  phase='operator-connection';
  const operator=connect(url('postgres',input.operatorPassword),options);
  try{await operator.begin(async tx=>{
   await tx.unsafe("SELECT set_config('statement_timeout','30s',true),set_config('lock_timeout','5s',true)");
   phase='operator-preflight';
   const session=await tx.unsafe('SELECT session_user AS login,current_user AS role');if(session.length!==1||session[0].login!=='postgres'||session[0].role!=='postgres')throw Error('Unexpected operator');
   if(!inspectAttendanceRoles(Array.from(await tx.unsafe(attendanceRoleQuery,[...attendanceRoles]))))throw Error('Attendance role graph differs');
   // Fixed role only; PostgreSQL format quotes the parameter as a literal.
   phase='dedicated-password-configuration';
   const sql=await tx.unsafe("SELECT format('ALTER ROLE greenfield_attendance_app PASSWORD %L',$1::text) AS statement",[input.password]);
   if(sql.length!==1||typeof sql[0].statement!=='string')throw Error('Password preparation failed');
   await tx.unsafe(sql[0].statement);
  });report('PASS: dedicated attendance LOGIN password configured; retain it locally');}finally{await operator.end({timeout:5});}
 }
 phase='dedicated-login-connection';
 const client=connect(url('greenfield_attendance_app',input.password),options);
 try{await client.begin(async tx=>{
  await tx.unsafe("SELECT set_config('statement_timeout','30s',true),set_config('lock_timeout','5s',true)");
  phase='dedicated-login-preflight';
  let session=await tx.unsafe('SELECT session_user AS login,current_user AS role');if(session.length!==1||session[0].login!==attendanceRoles[0]||session[0].role!==attendanceRoles[0])throw Error('Dedicated login required');
  if(!inspectAttendanceRoles(Array.from(await tx.unsafe(attendanceRoleQuery,[...attendanceRoles]))))throw Error('Attendance role graph differs');
  const denied=await tx.unsafe(`SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))`,[tables]);
  if(denied.length)throw Error('Unexpected login data privileges');
  phase='dedicated-runtime-preflight';
  await tx.unsafe('SET LOCAL ROLE "greenfield_attendance_runtime"');
  session=await tx.unsafe('SELECT session_user AS login,current_user AS role');if(session.length!==1||session[0].login!==attendanceRoles[0]||session[0].role!==attendanceRoles[1])throw Error('Exact runtime role required');
  const grants=await tx.unsafe(`SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))`,[tables]);
  if(grants.length)throw Error('Unexpected runtime data privileges');
  const api=await tx.unsafe("SELECT has_function_privilege(current_user,'public.save_attendance(uuid,jsonb)','EXECUTE') AS save,has_function_privilege(current_user,'public.read_attendance(uuid,text,date)','EXECUTE') AS history,has_function_privilege(current_user,'public.lock_report_card_actor(uuid)','EXECUTE') AS report_lock,has_function_privilege(current_user,'public.deny_attendance_history_change()','EXECUTE') AS helper");
  if(api.length!==1||api[0].save!==true||api[0].history!==true||api[0].report_lock!==false||api[0].helper!==false)throw Error('Unexpected function privileges');
  // NULL actor must reject before history; this is not a fictional authenticated read.
  phase='unbound-history-denial';
  const empty=await tx.unsafe("SELECT public.read_attendance(NULL,'primary5',CURRENT_DATE) AS outcome");
  const outcome=empty[0]?.outcome;
  if(empty.length!==1||!outcome||Object.keys(outcome).length!==2||outcome.ok!==false||outcome.code!=='forbidden')throw Error('Unbound history must reject');
 });
 phase='post-transaction-role-reset';
 const reset=await client.unsafe('SELECT session_user AS login,current_user AS role');if(reset.length!==1||reset[0].login!==attendanceRoles[0]||reset[0].role!==attendanceRoles[0])throw Error('Runtime role leaked past transaction');
 report('PASS: dedicated attendance TLS login, exact role graph, private API grants and denied direct data access');
 report('PASS: unbound history denied; no registers, marks, audits, receipts, report data or Auth accounts changed');
 }finally{await client.end({timeout:5});}
}
async function main(){
 if(process.argv[2]!=='--explicit-staging-input'){console.error('SKIPPED: use verify-attendance-staging.ps1 for explicit staging setup');process.exitCode=2;return;}
 let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>32768)throw Error('Input too large');}
 const input=parseAttendanceLoginInput(JSON.parse(raw));raw='';
 const {default:postgres}=await import('postgres');
 await attendanceLoginCheck(input,postgres);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
 const code=error&&typeof error==='object'&&typeof error.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:'unavailable';
 console.error('FAIL: attendance staging connection check; phase='+phase+'; code='+code+'; no raw credential or database error printed');process.exitCode=1;
});
