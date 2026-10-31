// Pure fixed-target installer: uses exactly the successful rollback rehearsal phases.
import {attendanceManagedRollbackReview} from './attendance-managed-review.mjs';
const tables=['attendance_registers','attendance_marks','attendance_audit','attendance_receipts'];
export function attendanceManagedInstallation(){
 const reviewed=attendanceManagedRollbackReview();
 const marker='\nROLLBACK;\n';
 if(reviewed.sql.split(marker).length!==2)throw Error('Reviewed rollback boundary changed');
 const prepared=reviewed.sql.split(marker)[0].replace('ROLLBACK REHEARSAL; never commits.','PERMANENT ATTENDANCE INSTALLATION; commits after all checks.');
 const emptyCheck=`DO $empty_attendance$ BEGIN
 ${tables.map(table=>`IF EXISTS(SELECT 1 FROM public.${table}) THEN RAISE EXCEPTION 'New attendance storage must be empty: ${table}'; END IF;`).join('\n ')}
 END $empty_attendance$`;
 const postCommit=`DO $committed_attendance$ BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('greenfield_attendance_app','greenfield_attendance_runtime','greenfield_attendance_owner'))<>3 THEN RAISE EXCEPTION 'Committed attendance roles missing'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('attendance_registers','attendance_marks','attendance_audit','attendance_receipts') AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='greenfield_attendance_owner'))<>4 THEN RAISE EXCEPTION 'Committed attendance protection differs'; END IF;
 IF to_regprocedure('public.save_attendance(uuid,jsonb)') IS NULL OR to_regprocedure('public.read_attendance(uuid,text,date)') IS NULL OR to_regprocedure('public.deny_attendance_history_change()') IS NULL THEN RAISE EXCEPTION 'Committed attendance functions missing'; END IF;
 END $committed_attendance$`;
 const checked=prepared.replace('\n-- Phase: deferred-ownership-and-cleanup', '\n-- Verify empty storage while the operator still owns the new tables.\n'+emptyCheck+';\n\n-- Phase: deferred-ownership-and-cleanup');
 const sql=checked+'\nCOMMIT;\n'+postCommit+";\nSELECT jsonb_build_object('attendance_managed_installation','PASS','attendance_tables',4,'dedicated_roles',3,'existing_report_state_checked',true,'login_password_configured',false,'attendance_save_enabled',false) AS attendance_installation_result;\n";
 return{target:reviewed.target,roles:reviewed.roles,phases:reviewed.phases,sql};
}
