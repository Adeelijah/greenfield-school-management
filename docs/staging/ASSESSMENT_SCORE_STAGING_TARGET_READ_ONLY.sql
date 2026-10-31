-- READ ONLY: run in the Greenfield STAGING project hweoqkbgmzycyznrbvng SQL editor.
-- One SELECT; no explicit row/advisory locks, helper calls, role switching, DDL, DML or grants.
-- A database name cannot attest to a Supabase project: verify the project in the dashboard.
-- Existing postgres-owned report/source data is inspected only as counts/change markers.
-- Attendance tables are privately owned: catalog/ACL inventory only, no data read or owner escalation.
WITH
expected_tables(name) AS (VALUES
 ('schools'),
 ('school_users'),
 ('memberships'),
 ('classes'),
 ('academic_levels'),
 ('academic_sections'),
 ('academic_sessions'),
 ('terms'),
 ('students'),
 ('enrollments'),
 ('teacher_class_assignments'),
 ('assessment_source_write_gate'),
 ('assessment_source_write_claims'),
 ('assessment_subjects'),
 ('assessment_config_versions'),
 ('assessment_scopes'),
 ('assessment_subject_roster'),
 ('assessment_teacher_subjects'),
 ('assessment_scores'),
 ('assessment_source_versions'),
 ('assessment_teacher_reviews'),
 ('assessment_finalizations'),
 ('assessment_audit'),
 ('assessment_operation_receipts'),
 ('report_cards'),
 ('report_card_snapshots'),
 ('report_card_audit'),
 ('report_card_operation_receipts'),
 ('report_card_releases'),
 ('attendance_registers'),
 ('attendance_marks'),
 ('attendance_audit'),
 ('attendance_receipts')),
relations AS (
 SELECT e.name,c.oid,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
        pg_catalog.pg_get_userbyid(c.relowner) AS owner,c.relacl AS explicit_acl,
        CASE WHEN c.oid IS NULL THEN NULL ELSE pg_catalog.has_table_privilege(current_user,c.oid,'SELECT') END AS operator_can_select
 FROM expected_tables e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.name
),
expected_keys(relation,columns) AS (VALUES
 ('classes',ARRAY['school_id','id']::text[]),
 ('academic_sessions',ARRAY['school_id','id']::text[]),
 ('memberships',ARRAY['school_id','id']::text[]),
 ('enrollments',ARRAY['school_id','id','student_id']::text[]),
 ('enrollments',ARRAY['school_id','id','student_id','class_id','session_id']::text[]),
 ('assessment_config_versions',ARRAY['school_id','id']::text[]),
 ('assessment_scopes',ARRAY['school_id','class_id','session_id','term_id']::text[]),
 ('assessment_subject_roster',ARRAY['school_id','id','config_version_id']::text[]),
 ('assessment_scores',ARRAY['school_id','roster_id','enrollment_id','component_key']::text[]),
 ('assessment_operation_receipts',ARRAY['school_id','actor_membership_id','operation_key']::text[]),
 ('assessment_source_write_claims',ARRAY['transaction_id','scope_id']::text[])),
indexes AS (
 SELECT c.relname,x.indisunique,x.indisvalid,x.indisready,x.indimmediate,
        x.indpred IS NULL AS unfiltered,x.indexprs IS NULL AS simple,
        ARRAY(SELECT a.attname::text
              FROM pg_catalog.unnest(x.indkey::smallint[]) WITH ORDINALITY k(num,ord)
              JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.num
              WHERE k.ord<=x.indnkeyatts ORDER BY k.ord) AS columns
 FROM pg_catalog.pg_index x
 JOIN pg_catalog.pg_class c ON c.oid=x.indrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
),
key_checks AS (
 SELECT e.relation,e.columns,EXISTS(
  SELECT 1 FROM indexes i WHERE i.relname=e.relation AND i.columns=e.columns
  AND i.indisunique AND i.indisvalid AND i.indisready AND i.indimmediate
  AND i.unfiltered AND i.simple
 ) AS present FROM expected_keys e
),
expected_roles(name,new_role) AS (VALUES
 ('greenfield_app',false),('greenfield_report_card_runtime',false),
 ('greenfield_report_card_authority_owner',false),
 ('greenfield_attendance_app',false),('greenfield_attendance_runtime',false),
 ('greenfield_attendance_owner',false),
 ('greenfield_assessment_app',true),('greenfield_assessment_runtime',true),
 ('greenfield_assessment_owner',true)),
role_checks AS (
 SELECT e.name,e.new_role,r.oid IS NOT NULL AS present,r.rolcanlogin AS login,
        r.rolinherit AS inherit,r.rolsuper AS superuser,r.rolbypassrls AS bypass_rls,
        r.rolcreaterole AS create_role,r.rolcreatedb AS create_database,r.rolreplication AS replication,
        CASE WHEN r.oid IS NULL THEN NULL ELSE EXISTS(
         SELECT 1 FROM pg_catalog.pg_shdepend d
         WHERE d.refclassid='pg_catalog.pg_authid'::pg_catalog.regclass
         AND d.refobjid=r.oid AND d.deptype='o') END AS owns_objects
 FROM expected_roles e LEFT JOIN pg_catalog.pg_roles r ON r.rolname=e.name
),
edges AS (
 SELECT member_role.rolname AS member,granted_role.rolname AS granted_role,
        grantor.rolname AS grantor,grantor.rolsuper AS grantor_superuser,
        member_role.rolsuper AS member_superuser,member_role.rolcreaterole AS member_create_role,
        member_role.rolbypassrls AS member_bypass_rls,m.admin_option,m.inherit_option,m.set_option
 FROM pg_catalog.pg_auth_members m
 JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
 JOIN pg_catalog.pg_roles granted_role ON granted_role.oid=m.roleid
 JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor
 WHERE member_role.rolname IN (SELECT name FROM expected_roles)
    OR granted_role.rolname IN (SELECT name FROM expected_roles)
),
expected_functions(signature) AS (VALUES
 ('public.lock_report_card_actor(uuid)'),
 ('public.resolve_report_card_actor()'),
 ('public.report_card_request_auth_uid()'),
 ('public.resolve_staging_staff_account()'),
 ('public.lock_report_card_authority_write_gate()'),
 ('public.lock_report_card_membership_actor_anchor()'),
 ('public.assessment_lock_source_write()'),
 ('public.assessment_mark_source_scope(uuid)'),
 ('public.assessment_invalidate_source_rows()'),
 ('public.assessment_reject_source_truncate()'),
 ('public.assessment_invalidate_parent_rows()'),
 ('public.report_card_reject_history()'),
 ('public.report_card_guard_release_history()'),
 ('public.report_card_restrict_runtime_writes()'),
 ('public.save_attendance(uuid,jsonb)'),
 ('public.read_attendance(uuid,text,date)'),
 ('public.deny_attendance_history_change()')),
functions AS (
 SELECT e.signature,p.oid IS NOT NULL AS present,
        pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,
        p.proconfig AS settings,p.proacl AS explicit_acl,
        CASE WHEN p.oid IS NULL THEN NULL ELSE pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) END AS definition_change_marker
 FROM expected_functions e LEFT JOIN pg_catalog.pg_proc p
 ON p.oid=pg_catalog.to_regprocedure(e.signature)
),
existing_score_entries AS (
 SELECT p.oid::pg_catalog.regprocedure::text AS signature FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='save_assessment_subject_scores'
),
write_surface(name) AS (VALUES ('assessment_scores'),('assessment_scopes'),
 ('assessment_audit'),('assessment_operation_receipts'),('assessment_config_versions'),
 ('assessment_subject_roster'),('assessment_source_write_gate'),('assessment_source_write_claims')),
columns AS (
 SELECT c.relname AS relation,a.attnum AS ordinal,a.attname AS column_name,
 pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,a.attnotnull AS required,
 pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attacl AS explicit_column_acl
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relname IN (SELECT name FROM write_surface)
),
constraints AS (
 SELECT c.relname AS relation,k.conname,k.contype,k.convalidated,
 pg_catalog.pg_get_constraintdef(k.oid) AS definition
 FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN (SELECT name FROM write_surface)
),
write_indexes AS (
 SELECT c.relname AS relation,i.relname AS index_name,x.indisunique,x.indisvalid,x.indisready,x.indpred IS NOT NULL AS partial,
 pg_catalog.pg_get_indexdef(i.oid) AS definition
 FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class c ON c.oid=x.indrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
 WHERE n.nspname='public' AND c.relname IN (SELECT name FROM write_surface)
),
triggers AS (
 SELECT c.relname AS relation,tr.tgname,tr.tgenabled,
 tr.tgtype, tr.tgfoid::pg_catalog.regprocedure::text AS function_signature,
 pg_catalog.pg_get_triggerdef(tr.oid) AS definition,
 pg_catalog.md5(pg_catalog.pg_get_triggerdef(tr.oid)) AS definition_change_marker
 FROM pg_catalog.pg_trigger tr JOIN pg_catalog.pg_class c ON c.oid=tr.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT tr.tgisinternal AND c.relname IN (SELECT name FROM expected_tables)
),
policies AS (
 SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename IN (SELECT name FROM expected_tables)
),
default_grants AS (
 SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS owner,COALESCE(n.nspname,'GLOBAL') AS schema,
 d.defaclobjtype AS object_kind,d.defaclacl AS explicit_acl
 FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
 WHERE (d.defaclnamespace=0 OR n.nspname='public')
 AND (pg_catalog.pg_get_userbyid(d.defaclrole)=current_user OR pg_catalog.pg_get_userbyid(d.defaclrole) IN (SELECT name FROM expected_roles WHERE NOT new_role))
),
public_restrictive AS (
 SELECT c.relname AS relation,p.polname AS policy,
        pg_catalog.pg_get_expr(p.polqual,p.polrelid) AS using_expression,
        pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT p.polpermissive AND 0::oid=ANY(p.polroles)
 AND c.relname IN (SELECT name FROM expected_tables)
),
-- Markers detect accidental changes around a future installer; they are not canonical/signature proof.
preserved_source_reports AS (
 SELECT 'report_cards'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.report_cards r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'report_card_snapshots'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.report_card_snapshots r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'report_card_audit'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.report_card_audit r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'report_card_operation_receipts'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.report_card_operation_receipts r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'report_card_releases'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.report_card_releases r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_scopes'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_scopes r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_scores'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_scores r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_config_versions'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_config_versions r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_subject_roster'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_subject_roster r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_teacher_subjects'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_teacher_subjects r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_subjects'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_subjects r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_source_versions'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_source_versions r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_teacher_reviews'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_teacher_reviews r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_finalizations'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_finalizations r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_audit'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_audit r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_operation_receipts'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.assessment_operation_receipts r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'enrollments'::text AS relation,count(*)::bigint AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.enrollments r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL
 SELECT 'assessment_source_write_claims',count(*)::bigint,pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) FROM public.assessment_source_write_claims r JOIN public.assessment_scopes s ON s.id=r.scope_id WHERE s.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
),
issues(message) AS (
 SELECT 'missing_or_unprotected_relation:'||name FROM relations
 WHERE oid IS NULL OR relkind NOT IN ('r','p') OR NOT relrowsecurity OR NOT relforcerowsecurity
 UNION ALL SELECT 'unvalidated_write_foreign_key:'||relation||'.'||conname FROM constraints WHERE contype='f' AND NOT convalidated
 UNION ALL SELECT 'missing_exact_unique_key:'||relation FROM key_checks WHERE NOT present
 UNION ALL SELECT 'missing_function:'||signature FROM functions WHERE NOT present
 UNION ALL SELECT 'assessment_role_already_exists:'||name FROM role_checks WHERE new_role AND present
 UNION ALL SELECT 'assessment_entry_already_exists:'||signature FROM existing_score_entries
 UNION ALL SELECT 'public_restrictive_policy_requires_review:'||relation||'.'||policy FROM public_restrictive
 UNION ALL SELECT 'existing_role_missing_or_unsafe:'||name FROM role_checks
 WHERE NOT new_role AND (NOT present OR inherit OR superuser OR bypass_rls OR create_role OR create_database OR replication
 OR login<>(name IN ('greenfield_app','greenfield_attendance_app')) OR (name NOT IN ('greenfield_report_card_authority_owner','greenfield_attendance_owner') AND owns_objects))
 UNION ALL SELECT 'greenfield_app_membership_changed' WHERE
 (SELECT count(*) FROM edges WHERE member='greenfield_app')<>1 OR NOT EXISTS(
  SELECT 1 FROM edges WHERE member='greenfield_app' AND granted_role='greenfield_report_card_runtime'
  AND NOT admin_option AND NOT inherit_option AND set_option)
 UNION ALL SELECT 'attendance_app_membership_changed' WHERE
 (SELECT count(*) FROM edges WHERE member='greenfield_attendance_app')<>1 OR NOT EXISTS(
  SELECT 1 FROM edges WHERE member='greenfield_attendance_app' AND granted_role='greenfield_attendance_runtime'
  AND NOT admin_option AND NOT inherit_option AND set_option)
 UNION ALL SELECT 'missing_or_ambiguous_managed_admin_edge:'||name FROM expected_roles e WHERE NOT new_role
 AND (SELECT count(*) FROM edges x WHERE x.granted_role=e.name AND x.member='postgres' AND x.admin_option AND NOT x.inherit_option AND NOT x.set_option AND x.grantor_superuser AND NOT x.member_superuser AND x.member_create_role AND x.member_bypass_rls)<>1
 UNION ALL SELECT 'unexpected_existing_service_outgoing_membership:'||member FROM edges
 WHERE member IN (SELECT name FROM expected_roles WHERE NOT new_role AND name NOT IN ('greenfield_app','greenfield_attendance_app'))
 UNION ALL SELECT 'unexpected_existing_service_incoming_membership:'||member||'->'||granted_role FROM edges
 WHERE granted_role IN (SELECT name FROM expected_roles WHERE NOT new_role)
 AND NOT (member='postgres' AND admin_option AND NOT inherit_option AND NOT set_option AND grantor_superuser AND NOT member_superuser AND member_create_role AND member_bypass_rls)
 AND NOT (member='greenfield_app' AND granted_role='greenfield_report_card_runtime' AND NOT admin_option AND NOT inherit_option AND set_option)
 AND NOT (member='greenfield_attendance_app' AND granted_role='greenfield_attendance_runtime' AND NOT admin_option AND NOT inherit_option AND set_option)
 UNION ALL SELECT 'unexpected_existing_relation_owner:'||name FROM relations WHERE owner IS DISTINCT FROM
 CASE WHEN name LIKE 'attendance_%' THEN 'greenfield_attendance_owner' ELSE 'postgres' END
 UNION ALL SELECT 'unexpected_existing_function_owner:'||signature FROM functions WHERE owner IS DISTINCT FROM
 CASE WHEN signature IN ('public.save_attendance(uuid,jsonb)','public.read_attendance(uuid,text,date)','public.deny_attendance_history_change()') THEN 'greenfield_attendance_owner'
 WHEN signature IN ('public.lock_report_card_actor(uuid)','public.resolve_report_card_actor()','public.report_card_request_auth_uid()','public.resolve_staging_staff_account()','public.lock_report_card_authority_write_gate()','public.lock_report_card_membership_actor_anchor()') THEN 'greenfield_report_card_authority_owner'
 ELSE 'postgres' END
 UNION ALL SELECT 'fixed_primary5_school_missing_or_changed' WHERE NOT EXISTS(
  SELECT 1 FROM public.schools WHERE id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid AND final_primary_year=5)
)
SELECT pg_catalog.jsonb_pretty(pg_catalog.jsonb_build_object(
 'format','greenfield.staging.assessment-score.target.v1',
 'declared_project_ref','hweoqkbgmzycyznrbvng',
 'captured_at',CURRENT_TIMESTAMP,'database',current_database(),'inspection_role',current_user,'session_role',session_user,
 'server_version_num',current_setting('server_version_num')::integer,'session_timezone',current_setting('TimeZone'),
 'inspection_search_path',current_setting('search_path'),
 'inspection_issues',COALESCE((SELECT pg_catalog.jsonb_agg(message ORDER BY message) FROM issues),'[]'::jsonb),
 'operator',(SELECT pg_catalog.jsonb_build_object('name',rolname,'superuser',rolsuper,'create_role',rolcreaterole,'bypass_rls',rolbypassrls,
   'public_usage',pg_catalog.has_schema_privilege(current_user,'public','USAGE'),
   'public_create',pg_catalog.has_schema_privilege(current_user,'public','CREATE')) FROM pg_catalog.pg_roles WHERE rolname=current_user),
 'relations',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY name) FROM relations r),
 'exact_keys',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(k) ORDER BY relation) FROM key_checks k),
 'roles',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY name) FROM role_checks r),
 'role_memberships',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) ORDER BY member,granted_role,grantor) FROM edges e),'[]'::jsonb),
 'private_functions',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(f) ORDER BY signature) FROM functions f),
 'public_restrictive_policies',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) ORDER BY relation,policy) FROM public_restrictive p),'[]'::jsonb),
 'write_surface_columns',(SELECT pg_catalog.jsonb_object_agg(relation,layout ORDER BY relation) FROM (SELECT relation,pg_catalog.jsonb_object_agg(column_name,pg_catalog.jsonb_build_array(data_type,required) ORDER BY ordinal) AS layout FROM columns GROUP BY relation) c),
 'write_surface_column_markers',(SELECT pg_catalog.jsonb_object_agg(relation,marker ORDER BY relation) FROM (SELECT relation,pg_catalog.md5(pg_catalog.string_agg(pg_catalog.to_jsonb(c)::text,'' ORDER BY ordinal)) AS marker FROM columns c GROUP BY relation) c),
 'write_surface_constraints',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) ORDER BY relation,conname) FROM constraints c),
 'partial_write_indexes',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY relation,index_name) FROM write_indexes i WHERE partial),
 'write_surface_index_markers',(SELECT pg_catalog.jsonb_object_agg(relation,pg_catalog.jsonb_build_object('count',n,'marker',marker) ORDER BY relation) FROM (SELECT relation,count(*) AS n,pg_catalog.md5(pg_catalog.string_agg(pg_catalog.to_jsonb(i)::text,'' ORDER BY index_name)) AS marker FROM write_indexes i GROUP BY relation) i),
 'existing_trigger_baseline',(SELECT pg_catalog.jsonb_object_agg(relation,pg_catalog.jsonb_build_object('count',n,'marker',marker) ORDER BY relation) FROM (SELECT relation,count(*) AS n,pg_catalog.md5(pg_catalog.string_agg(pg_catalog.to_jsonb(t)::text,'' ORDER BY tgname)) AS marker FROM triggers t GROUP BY relation) t),
 'write_surface_trigger_inventory',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('relation',relation,'name',tgname,'enabled',tgenabled,'events',tgtype,'function',function_signature,'marker',definition_change_marker) ORDER BY relation,tgname) FROM triggers WHERE relation IN ('assessment_scores','assessment_audit','assessment_operation_receipts','assessment_source_write_claims','assessment_source_write_gate')),
 'existing_policy_baseline',(SELECT pg_catalog.jsonb_object_agg(tablename,pg_catalog.jsonb_build_object('count',n,'marker',marker) ORDER BY tablename) FROM (SELECT tablename,count(*) AS n,pg_catalog.md5(pg_catalog.string_agg(pg_catalog.to_jsonb(p)::text,'' ORDER BY policyname)) AS marker FROM policies p GROUP BY tablename) p),
 'operator_default_grants',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) ORDER BY owner,schema,object_kind) FROM default_grants d),'[]'::jsonb),
 'protected_source_report_baseline',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY relation) FROM preserved_source_reports r),
 'attendance_data_baseline','not_read_by_this_catalog_review; preserve private ownership, ACLs, role graph, functions, triggers and policies without escalating the operator',
 'next_step','Review target evidence before preparing a managed assessment score rollback rehearsal; no installation authorized by this result'
)) AS assessment_score_target_review;
