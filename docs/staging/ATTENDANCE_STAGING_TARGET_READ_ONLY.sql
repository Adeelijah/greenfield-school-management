-- READ ONLY: run in the Greenfield STAGING project hweoqkbgmzycyznrbvng SQL editor.
-- One SELECT; no explicit row/advisory locks, helper calls, role switching, DDL, DML or grants.
-- A database name cannot attest to a Supabase project: verify the project in the dashboard.
-- This inspects existing fictional data only as counts/change markers, never pupil/account rows.
WITH
expected_tables(name) AS (VALUES
 ('schools'),('school_users'),('memberships'),('classes'),('academic_levels'),
 ('academic_sections'),('academic_sessions'),('students'),('enrollments'),
 ('teacher_class_assignments'),('assessment_source_write_gate'),
 ('report_cards'),('report_card_snapshots'),('report_card_audit'),
 ('report_card_operation_receipts'),('report_card_releases')),
relations AS (
 SELECT e.name,c.oid,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
        pg_catalog.pg_get_userbyid(c.relowner) AS owner
 FROM expected_tables e
 LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.name
),
expected_keys(relation,columns) AS (VALUES
 ('classes',ARRAY['school_id','id']::text[]),
 ('academic_sessions',ARRAY['school_id','id']::text[]),
 ('memberships',ARRAY['school_id','id']::text[]),
 ('enrollments',ARRAY['school_id','id','student_id','class_id','session_id']::text[])),
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
 ('greenfield_attendance_app',true),('greenfield_attendance_runtime',true),
 ('greenfield_attendance_owner',true)),
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
        grantor.rolname AS grantor,m.admin_option,m.inherit_option,m.set_option
 FROM pg_catalog.pg_auth_members m
 JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
 JOIN pg_catalog.pg_roles granted_role ON granted_role.oid=m.roleid
 JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor
 WHERE member_role.rolname IN (SELECT name FROM expected_roles)
    OR granted_role.rolname IN (SELECT name FROM expected_roles)
),
expected_functions(signature) AS (VALUES
 ('public.lock_report_card_actor(uuid)'),('public.resolve_report_card_actor()'),
 ('public.report_card_request_auth_uid()'),('public.resolve_staging_staff_account()')),
functions AS (
 SELECT e.signature,p.oid IS NOT NULL AS present,
        pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,
        p.proconfig AS settings,p.proacl AS explicit_acl,
        CASE WHEN p.oid IS NULL THEN NULL ELSE pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) END AS definition_change_marker
 FROM expected_functions e LEFT JOIN pg_catalog.pg_proc p
 ON p.oid=pg_catalog.to_regprocedure(e.signature)
),
existing_attendance AS (
 SELECT c.relname AS relation FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN
 ('attendance_registers','attendance_marks','attendance_audit','attendance_receipts')
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
preserved_reports AS (
 SELECT 'report_cards'::text AS relation,count(*)::integer AS rows,
 pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) AS change_marker FROM public.report_cards r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL SELECT 'report_card_snapshots',count(*)::integer,pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) FROM public.report_card_snapshots r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL SELECT 'report_card_audit',count(*)::integer,pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) FROM public.report_card_audit r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL SELECT 'report_card_operation_receipts',count(*)::integer,pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) FROM public.report_card_operation_receipts r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
 UNION ALL SELECT 'report_card_releases',count(*)::integer,pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(pg_catalog.to_jsonb(r)::text),'' ORDER BY pg_catalog.to_jsonb(r)::text),'')) FROM public.report_card_releases r WHERE r.school_id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid
),
issues(message) AS (
 SELECT 'missing_or_unprotected_relation:'||name FROM relations
 WHERE oid IS NULL OR relkind NOT IN ('r','p') OR NOT relrowsecurity OR NOT relforcerowsecurity
 UNION ALL SELECT 'missing_exact_unique_key:'||relation FROM key_checks WHERE NOT present
 UNION ALL SELECT 'missing_function:'||signature FROM functions WHERE NOT present
 UNION ALL SELECT 'attendance_role_already_exists:'||name FROM role_checks WHERE new_role AND present
 UNION ALL SELECT 'attendance_relation_already_exists:'||relation FROM existing_attendance
 UNION ALL SELECT 'public_restrictive_policy_requires_review:'||relation||'.'||policy FROM public_restrictive
 UNION ALL SELECT 'existing_role_missing_or_unsafe:'||name FROM role_checks
 WHERE NOT new_role AND (NOT present OR inherit OR superuser OR bypass_rls OR create_role OR create_database OR replication
 OR login<>(name='greenfield_app') OR (name<>'greenfield_report_card_authority_owner' AND owns_objects))
 UNION ALL SELECT 'greenfield_app_membership_changed' WHERE
 (SELECT count(*) FROM edges WHERE member='greenfield_app')<>1 OR NOT EXISTS(
  SELECT 1 FROM edges WHERE member='greenfield_app' AND granted_role='greenfield_report_card_runtime'
  AND NOT admin_option AND NOT inherit_option AND set_option)
 UNION ALL SELECT 'fixed_primary5_school_missing_or_changed' WHERE NOT EXISTS(
  SELECT 1 FROM public.schools WHERE id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid AND final_primary_year=5)
)
SELECT pg_catalog.jsonb_pretty(pg_catalog.jsonb_build_object(
 'format','greenfield.staging.attendance.target.v1',
 'declared_project_ref','hweoqkbgmzycyznrbvng',
 'database',current_database(),'inspection_role',current_user,'session_role',session_user,
 'server_version_num',current_setting('server_version_num')::integer,'session_timezone',current_setting('TimeZone'),
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
 'protected_report_baseline',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY relation) FROM preserved_reports r),
 'next_step','Review this target evidence before preparing an additive managed attendance installer; no installation authorized by this result'
)) AS attendance_target_review;
