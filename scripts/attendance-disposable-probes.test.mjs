import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAttendanceWorkerPrivileges,attendanceHistoryDenialQueries} from './lib/attendance-disposable-probes.mjs';
const schema='at_it_0123456789abcdef';
function fixture(change=()=>{}){
 const calls=[];
 return{calls,tx:{async unsafe(sql,params){calls.push({sql,params});const row={role:schema+'_worker',allowed:params[0]===schema+'.save_attendance(uuid,jsonb)'};change(row,params[0]);return[row];}}};
}
test('effective worker privileges require only save execution and deny all table, column and trigger-helper access',async()=>{const f=fixture();await verifyAttendanceWorkerPrivileges(f.tx,schema);assert.equal(f.calls.length,16);assert.ok(f.calls.some(c=>c.sql.includes('has_any_column_privilege')));assert.ok(f.calls.every(c=>!c.sql.includes('SELECT "'+schema+'"."lock_attendance_parents"()')));});
test('worker preflight rejects inherited/PUBLIC helper grants, relation grants and owner execution',async()=>{for(const target of ['lock_attendance_parents()','deny_attendance_history_change()','attendance_audit','enrollments']){const f=fixture((row,name)=>{if(name===schema+'.'+target)row.allowed=true;});await assert.rejects(verifyAttendanceWorkerPrivileges(f.tx,schema),{code:'ERR_ASSERTION'});}const owner=fixture(row=>{row.role=schema+'_owner';});await assert.rejects(verifyAttendanceWorkerPrivileges(owner.tx,schema),{code:'ERR_ASSERTION'});});
test('save EXECUTE must be present rather than treating a completely inaccessible worker as valid',async()=>{const f=fixture(row=>{row.allowed=false;});await assert.rejects(verifyAttendanceWorkerPrivileges(f.tx,schema),{code:'ERR_ASSERTION'});});
test('audit truncate probe includes its exact receipt dependency and never uses CASCADE',()=>{const queries=attendanceHistoryDenialQueries(schema);assert.equal(queries.length,6);assert.equal(queries.find(q=>q.name==='attendance_audit-truncate').sql,'TRUNCATE "'+schema+'"."attendance_audit","'+schema+'"."attendance_receipts"');assert.ok(queries.every(q=>!q.sql.includes('CASCADE')));assert.throws(()=>attendanceHistoryDenialQueries('public'));});
