import assert from 'node:assert/strict';
import {attendanceFixturePlan} from './attendance-disposable-plan.mjs';

/** Trigger-returning functions cannot be invoked as ordinary SQL functions to
 * prove ACLs: PostgreSQL can reject the invocation context before ACL execution.
 * Inspect effective privileges as the exact worker instead. No grants are made.
 */
export async function verifyAttendanceWorkerPrivileges(tx,schema){
 const plan=attendanceFixturePlan(schema);
 const checks=[
  {name:'save_attendance(uuid,jsonb)',expected:true},
  {name:'lock_attendance_parents()',expected:false},
  {name:'deny_attendance_history_change()',expected:false},
 ];
 for(const check of checks){
  const rows=await tx.unsafe('SELECT current_user AS role,pg_catalog.has_function_privilege(current_user,$1::text,\'EXECUTE\') AS allowed',[schema+'.'+check.name]);
  assert.equal(rows.length,1,'One effective function privilege row required');
  assert.equal(rows[0].role,plan.names.worker,'Exact attendance worker role required');
  assert.equal(rows[0].allowed,check.expected,'Unexpected effective attendance function access: '+check.name);
 }
 for(const relation of plan.relations){
  const rows=await tx.unsafe('SELECT current_user AS role,(pg_catalog.has_table_privilege(current_user,$1::text,\'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER\') OR pg_catalog.has_any_column_privilege(current_user,$1::text,\'SELECT,INSERT,UPDATE,REFERENCES\')) AS allowed',[schema+'.'+relation]);
  assert.equal(rows.length,1,'One effective relation privilege row required');
  assert.equal(rows[0].role,plan.names.worker,'Exact attendance worker role required');
  assert.equal(rows[0].allowed,false,'Unexpected effective attendance relation/column access: '+relation);
 }
}

/** Include the referencing receipt table when truncating audit so PostgreSQL's
 * FK preflight succeeds and the BEFORE TRUNCATE guard is actually exercised.
 * Never use CASCADE, which could silently include unrelated relations.
 */
export function attendanceHistoryDenialQueries(schema){
 attendanceFixturePlan(schema);
 const t=name=>'"'+schema+'"."'+name+'"';
 return ['attendance_audit','attendance_receipts'].flatMap(table=>[
  {name:table+'-update',sql:'UPDATE '+t(table)+' SET version=version WHERE false'},
  {name:table+'-delete',sql:'DELETE FROM '+t(table)+' WHERE false'},
  {name:table+'-truncate',sql:'TRUNCATE '+(table==='attendance_audit'?t(table)+','+t('attendance_receipts'):t(table))},
 ]);
}
