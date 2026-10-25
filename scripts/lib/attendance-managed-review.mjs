// Pure staging-only rollback candidate. No connection, environment or password input.
import {attendanceUpgradePlan} from './attendance-upgrade-plan.mjs';
export const attendanceManagedTarget=Object.freeze({projectRef:'hweoqkbgmzycyznrbvng',schoolId:'0c594571-74c5-46fe-a835-a9b217a3a199',primary5ClassId:'1dbfa5e7-99b8-5094-b1f9-c872477d4bf6',crecheClassId:'fe6e5a74-b93a-5d00-8115-53b6952153be'});
const fixture='rc_it_a77e0da0ce000001';
const roles={owner:'greenfield_attendance_owner',worker:'greenfield_attendance_runtime',login:'greenfield_attendance_app'};
const oldRoles=['greenfield_app','greenfield_report_card_runtime','greenfield_report_card_authority_owner'];
const signatures=['deny_attendance_history_change()','save_attendance(uuid,jsonb)','read_attendance(uuid,text,date)'];
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const names=values=>values.map(quote).join(',');
const oldFunctions={
 'public.lock_report_card_actor(uuid)':'8352578ccca06a7d0a39f448d5489d1c',
 'public.report_card_request_auth_uid()':'46d583b7ea30b81fa33b33b8c2833eb7',
 'public.resolve_report_card_actor()':'9ec1ada02e0087dea08257d738ca986c',
 'public.resolve_staging_staff_account()':'c2976268d2a3ae29413e0702eedcfed2',
};
const preserved=['report_cards','report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases','assessment_scopes','assessment_scores','assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','assessment_audit','assessment_operation_receipts','assessment_config_versions','enrollments'];
function preservedQuery(){return 'SELECT jsonb_object_agg(relation,jsonb_build_object(\'rows\',n,\'marker\',marker)) FROM ('+preserved.map(table=>`SELECT '${table}'::text AS relation,count(*)::bigint AS n,md5(COALESCE(string_agg(md5(to_jsonb(x)::text),'' ORDER BY to_jsonb(x)::text),'')) AS marker FROM public.${table} x WHERE school_id='${attendanceManagedTarget.schoolId}'::uuid`).join(' UNION ALL ')+') preserved';}
const roleSnapshot=`SELECT jsonb_build_object('roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.rolname) FROM (SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname IN (${names(oldRoles)})) r),'edges',(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.member,e.role,e.grantor) FROM (SELECT u.rolname AS member,r.rolname AS role,g.rolname AS grantor,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles g ON g.oid=m.grantor WHERE u.rolname IN (${names(oldRoles)}) OR r.rolname IN (${names(oldRoles)})) e))`;
const helperNames=['lock_report_card_actor','resolve_report_card_actor','report_card_request_auth_uid','resolve_staging_staff_account','lock_report_card_authority_write_gate','lock_report_card_membership_actor_anchor','assessment_lock_source_write','assessment_mark_source_scope','assessment_invalidate_source_rows','assessment_reject_source_truncate','assessment_invalidate_parent_rows','report_card_reject_history','report_card_guard_release_history','report_card_restrict_runtime_writes'];
const helperSnapshot=`SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl,'owner',p.proowner) ORDER BY p.oid::regprocedure::text) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN (${names(helperNames)})`;
const triggerSnapshot=`SELECT jsonb_agg(jsonb_build_object('relation',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY c.relname,t.tgname) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname NOT IN ('attendance_registers','attendance_marks','attendance_audit','attendance_receipts')`;
const policySnapshot=`SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_catalog.pg_policies p WHERE schemaname='public' AND policyname NOT IN ('attendance_private_authority_read','attendance_private_gate','attendance_private_storage')`;
export function attendanceManagedRollbackReview(){
 const target=attendanceManagedTarget;
 const base=attendanceUpgradePlan(fixture,{schoolId:target.schoolId,primary5ClassId:target.primary5ClassId,crecheClassId:target.crecheClassId});
 const adapt=source=>source.replaceAll(base.roles.owner,roles.owner).replaceAll(base.roles.worker,roles.worker).replaceAll(base.roles.login,roles.login).replaceAll('"'+fixture+'"','"public"').replaceAll("'"+fixture+"'","'public'").replaceAll('fixture_source_write_gate','assessment_source_write_gate');
 const preflight=`DO $preflight$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND NOT rolsuper AND rolcreaterole AND rolbypassrls) THEN RAISE EXCEPTION 'Reviewed managed postgres operator required'; END IF;
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'Reviewed PostgreSQL 17 target required'; END IF;
 IF NOT has_schema_privilege(current_user,'public','CREATE') OR NOT has_database_privilege(current_user,current_database(),'TEMP') THEN RAISE EXCEPTION 'Managed schema/TEMP privileges required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN (${names(Object.values(roles))})) THEN RAISE EXCEPTION 'Attendance roles must be absent; no adoption'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('save_attendance','read_attendance','deny_attendance_history_change')) THEN RAISE EXCEPTION 'Attendance function name already exists'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND policyname IN ('attendance_private_authority_read','attendance_private_gate','attendance_private_storage')) THEN RAISE EXCEPTION 'Attendance policy name already exists'; END IF;
 IF to_regclass('pg_temp.greenfield_attendance_install_baseline') IS NOT NULL THEN RAISE EXCEPTION 'Unexpected previous temporary installation snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools WHERE id='${target.schoolId}'::uuid AND slug='greenfield-staging' AND final_primary_year=5) THEN RAISE EXCEPTION 'Exact fictional staging school required'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN (${names(oldRoles)}) AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit AND rolcanlogin=(rolname='greenfield_app'))<>3 THEN RAISE EXCEPTION 'Existing report roles differ'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname='greenfield_app')<>1 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member JOIN pg_catalog.pg_roles r ON r.oid=m.roleid WHERE u.rolname='greenfield_app' AND r.rolname='greenfield_report_card_runtime' AND m.set_option AND NOT m.inherit_option AND NOT m.admin_option) THEN RAISE EXCEPTION 'Report LOGIN membership changed'; END IF;
 ${Object.entries(oldFunctions).map(([signature,hash])=>`IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('${signature}') AND md5(pg_get_functiondef(oid))='${hash}') THEN RAISE EXCEPTION 'Inspected helper changed: ${signature}'; END IF;`).join('\n ')}
 -- Same discovery order as installed parent writers: source row, then authority barrier.
 PERFORM id FROM public.assessment_source_write_gate WHERE id=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Coordinated source gate missing'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1',0));
END $preflight$`;
 const snapshot=`CREATE TEMP TABLE greenfield_attendance_install_baseline ON COMMIT DROP AS SELECT (${preservedQuery()}) AS data_state,(${roleSnapshot}) AS role_state,(${helperSnapshot}) AS helper_state,(${triggerSnapshot}) AS trigger_state,(${policySnapshot}) AS policy_state`;
 const bootstrap=[...Object.entries(roles).map(([kind,role])=>'CREATE ROLE '+role+' '+(kind==='login'?'LOGIN':'NOLOGIN')+' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION'+(kind==='login'?' PASSWORD NULL':'')),
 ...['ADMIN FALSE','INHERIT FALSE','SET TRUE'].map(option=>'GRANT '+roles.owner+' TO postgres WITH '+option+' GRANTED BY postgres'),
 'GRANT CREATE ON SCHEMA public TO '+roles.owner,
 'GRANT CONNECT ON DATABASE postgres TO '+roles.login,
 ...['ADMIN FALSE','INHERIT FALSE','SET TRUE'].map(option=>'GRANT '+roles.worker+' TO '+roles.login+' WITH '+option+' GRANTED BY postgres')];
 const body=base.statements.filter(sql=>!sql.startsWith('CREATE ROLE')&&!sql.startsWith('ALTER TABLE')||sql.startsWith('ALTER TABLE')&&!sql.includes(' OWNER TO ')).filter(sql=>!sql.startsWith('ALTER FUNCTION')&&!sql.startsWith('GRANT EXECUTE')).map(adapt).map(sql=>{
  if(sql.startsWith('DO $p$'))sql=sql.replace("AND NOT p.polpermissive AND","AND c.relname IN ("+names([...base.foundation,'assessment_source_write_gate'])+") AND NOT p.polpermissive AND");
  if(sql.startsWith('CREATE FUNCTION'))sql=sql.replace('SET search_path=pg_catalog AS','SET search_path=pg_catalog SET row_security=on AS');
  if(sql.startsWith('CREATE FUNCTION')&&sql.includes('SECURITY DEFINER')){
   const gate=sql.includes('save_attendance')?'FOR UPDATE;':'FOR SHARE;';
   // Gate must precede complete actor discovery in every installed private entry.
   const needle="IF NOT FOUND THEN RAISE EXCEPTION '";
   const offset=sql.indexOf(needle);if(offset<0||!sql.slice(0,offset).includes(gate))throw Error('Attendance gate layout changed');
   const end=sql.indexOf('END IF;',offset)+'END IF;'.length;
   sql=sql.slice(0,end)+"\n PERFORM pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1',0));"+sql.slice(end);
  }
  return sql;
 });
 const accessReset=`DO $new_object_acl_reset$ DECLARE item record; principal text; BEGIN
 FOR item IN SELECT c.relname,a.grantee FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relname IN (${names(base.attendance)}) AND a.grantee<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user) LOOP
 principal:=CASE WHEN item.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(item.grantee)) END;
 EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %s',item.relname,principal); END LOOP;
 FOR item IN SELECT c.relname,col.attname,a.grantee FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute col ON col.attrelid=c.oid CROSS JOIN LATERAL pg_catalog.aclexplode(col.attacl) a WHERE n.nspname='public' AND c.relname IN (${names(base.attendance)}) AND a.grantee<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user) LOOP
 principal:=CASE WHEN item.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(item.grantee)) END;
 EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM %s',item.attname,item.relname,principal); END LOOP;
 FOR item IN SELECT p.oid::pg_catalog.regprocedure AS signature,a.grantee FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE n.nspname='public' AND p.proname IN ('save_attendance','read_attendance','deny_attendance_history_change') AND a.grantee<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user) LOOP
 principal:=CASE WHEN item.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(item.grantee)) END;
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',item.signature,principal); END LOOP;
 END $new_object_acl_reset$`;
 const unboundProbe=`SET LOCAL ROLE ${roles.owner};
DO $unbound_probe$ BEGIN
 IF public.save_attendance(NULL,'{}'::jsonb) IS DISTINCT FROM '{"ok":false,"code":"invalid"}'::jsonb THEN RAISE EXCEPTION 'Unbound save must reject'; END IF;
 IF public.read_attendance(NULL,'primary5',CURRENT_DATE) IS DISTINCT FROM '{"ok":false,"code":"forbidden"}'::jsonb THEN RAISE EXCEPTION 'Unbound history must reject'; END IF;
END $unbound_probe$;
RESET ROLE`;
 const ownership=[
 'GRANT EXECUTE ON FUNCTION public.save_attendance(uuid,jsonb),public.read_attendance(uuid,text,date) TO '+roles.worker,
 ...base.attendance.map(name=>'ALTER TABLE public.'+name+' OWNER TO '+roles.owner),
 ...signatures.map(signature=>'ALTER FUNCTION public.'+signature+' OWNER TO '+roles.owner),
 unboundProbe,
 'REVOKE CREATE ON SCHEMA public FROM '+roles.owner,
 'REVOKE '+roles.owner+' FROM postgres GRANTED BY postgres',
 ];
 const verify=`DO $verify$ DECLARE name text; BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN (${names(Object.values(roles))}) AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit AND rolcanlogin=(rolname='${roles.login}'))<>3 THEN RAISE EXCEPTION 'Attendance role flags differ'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid WHERE r.rolname IN (${names(Object.values(roles))}))<>4 THEN RAISE EXCEPTION 'Unexpected attendance incoming membership'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member JOIN pg_catalog.pg_roles g ON g.oid=m.grantor WHERE r.rolname IN (${names(Object.values(roles))}) AND u.rolname='postgres' AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option AND g.rolsuper)<>3 THEN RAISE EXCEPTION 'Managed bootstrap ADMIN edges changed'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN (${names(Object.values(roles))}))<>1 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member JOIN pg_catalog.pg_roles r ON r.oid=m.roleid WHERE u.rolname='${roles.login}' AND r.rolname='${roles.worker}' AND m.set_option AND NOT m.inherit_option AND NOT m.admin_option) THEN RAISE EXCEPTION 'Attendance LOGIN must be SET-only'; END IF;
 IF has_schema_privilege('${roles.owner}','public','CREATE') OR has_schema_privilege('${roles.worker}','public','CREATE') OR has_schema_privilege('${roles.login}','public','CREATE') THEN RAISE EXCEPTION 'Attendance schema CREATE leaked'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (${names(base.attendance)}) AND c.relowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${roles.owner}') AND c.relrowsecurity AND c.relforcerowsecurity)<>4 THEN RAISE EXCEPTION 'Attendance table ownership/protection differs'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_proc p WHERE p.oid IN (${signatures.map(s=>quote('public.'+s)+'::regprocedure').join(',')}) AND p.proowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${roles.owner}') AND p.proconfig @> ARRAY['search_path=pg_catalog','row_security=on'] AND p.prosecdef=(p.proname<>'deny_attendance_history_change'))<>3 THEN RAISE EXCEPTION 'Attendance function ownership/settings differ'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE p.oid IN (${signatures.map(s=>quote('public.'+s)+'::regprocedure').join(',')}) AND a.grantee<>p.proowner AND NOT (p.proname IN ('save_attendance','read_attendance') AND a.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${roles.worker}') AND a.privilege_type='EXECUTE' AND NOT a.is_grantable)) THEN RAISE EXCEPTION 'Unexpected new function ACL grantee'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relname IN (${names(base.attendance)}) AND a.grantee<>c.relowner) THEN RAISE EXCEPTION 'Unexpected attendance table ACL grantee'; END IF;
 IF has_schema_privilege('${roles.owner}','auth','USAGE') THEN RAISE EXCEPTION 'Unexpected attendance Auth schema access'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_shdepend d JOIN pg_catalog.pg_roles r ON r.oid=d.refobjid WHERE d.refclassid='pg_catalog.pg_authid'::regclass AND d.deptype='o' AND r.rolname IN ('${roles.login}','${roles.worker}')) THEN RAISE EXCEPTION 'Execution roles own objects'; END IF;
 FOREACH name IN ARRAY ARRAY[${names([...Object.values(roles),...oldRoles,'anon','authenticated','service_role'])}] LOOP
 IF name<>'${roles.owner}' AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=name) AND EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (${names(base.attendance)}) AND (has_table_privilege(name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RAISE EXCEPTION 'Unexpected direct attendance data access: %',name; END IF;
 IF name NOT IN ('${roles.owner}','${roles.worker}') AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=name) AND (has_function_privilege(name,'public.save_attendance(uuid,jsonb)','EXECUTE') OR has_function_privilege(name,'public.read_attendance(uuid,text,date)','EXECUTE')) THEN RAISE EXCEPTION 'Unexpected attendance API execution: %',name; END IF;
 END LOOP;
 IF NOT has_function_privilege('${roles.worker}','public.save_attendance(uuid,jsonb)','EXECUTE') OR NOT has_function_privilege('${roles.worker}','public.read_attendance(uuid,text,date)','EXECUTE') OR has_function_privilege('${roles.worker}','public.deny_attendance_history_change()','EXECUTE') THEN RAISE EXCEPTION 'Attendance execution ACL differs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_temp.greenfield_attendance_install_baseline b WHERE b.data_state=(${preservedQuery()}) AND b.role_state=(${roleSnapshot}) AND b.helper_state=(${helperSnapshot}) AND b.trigger_state=(${triggerSnapshot}) AND b.policy_state=(${policySnapshot})) THEN RAISE EXCEPTION 'Existing report/source/role/helper/guard state changed'; END IF;
 END $verify$`;
 const postRollback=`DO $rolled_back$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN (${names(Object.values(roles))})) OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (${names(base.attendance)})) OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('save_attendance','read_attendance','deny_attendance_history_change')) OR EXISTS(SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND policyname IN ('attendance_private_authority_read','attendance_private_gate','attendance_private_storage')) THEN RAISE EXCEPTION 'Attendance rollback left new objects'; END IF;
 END $rolled_back$`;
 const phases=[{name:'preflight-and-baseline',statements:[preflight,snapshot]},{name:'managed-role-bootstrap',statements:bootstrap},{name:'additive-storage-functions-policy',statements:body},{name:'new-object-access-reset',statements:[accessReset]},{name:'deferred-ownership-and-cleanup',statements:ownership},{name:'in-transaction-verification',statements:[verify]}];
 const sql='-- Greenfield STAGING '+target.projectRef+' ONLY. ROLLBACK REHEARSAL; never commits.\n-- No passwords/Auth changes, report/source writes or existing report-role grants.\nBEGIN;\nSET LOCAL search_path=pg_catalog;\nSET LOCAL TIME ZONE \'UTC\';\nSET LOCAL lock_timeout=\'5s\';\nSET LOCAL statement_timeout=\'120s\';\n'+phases.map(p=>'\n-- Phase: '+p.name+'\n'+p.statements.join(';\n')+';').join('\n')+'\nROLLBACK;\n'+postRollback+";\nSELECT jsonb_build_object('attendance_managed_rollback','PASS','new_attendance_objects_absent',true,'existing_report_state_checked',true,'login_password_configured',false,'attendance_save_enabled',false) AS attendance_rollback_result;\n";
 return{target,roles,phases,sql};
}
