-- Read-only inspection for user-confirmed staging hweoqkbgmzycyznrbvng.
-- Returns one JSON document with missing roles explicitly marked absent.
-- No passwords, application rows, function execution or role switching.
-- Project reference must be checked in the dashboard, not current_database().

BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

WITH expected(name) AS (VALUES
 ('greenfield_app'),
 ('greenfield_report_card_runtime'),
 ('greenfield_report_card_authority_owner')
)
SELECT pg_catalog.jsonb_pretty(pg_catalog.jsonb_build_object(
 'database', current_database(),
 'server_version_num', current_setting('server_version_num')::integer,
 'inspection_role', current_user,
 'session_role', session_user,
 'operator', (
  SELECT pg_catalog.jsonb_build_object(
   'name', r.rolname,
   'superuser', r.rolsuper,
   'create_role', r.rolcreaterole,
   'bypass_rls', r.rolbypassrls
  )
  FROM pg_catalog.pg_roles r WHERE r.rolname=current_user
 ),
 'expected_roles', (
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'name', e.name,
   'present', r.oid IS NOT NULL,
   'login', r.rolcanlogin,
   'inherit', r.rolinherit,
   'superuser', r.rolsuper,
   'create_role', r.rolcreaterole,
   'create_database', r.rolcreatedb,
   'bypass_rls', r.rolbypassrls,
   'replication', r.rolreplication,
   'owns_objects', CASE WHEN r.oid IS NULL THEN NULL ELSE EXISTS (
    SELECT 1 FROM pg_catalog.pg_shdepend d
    WHERE d.refclassid='pg_catalog.pg_authid'::pg_catalog.regclass
      AND d.refobjid=r.oid AND d.deptype='o'
   ) END
  ) ORDER BY e.name)
  FROM expected e LEFT JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 ),
 'role_memberships', (
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'member', member_role.rolname,
   'granted_role', granted_role.rolname,
   'grantor', grantor_role.rolname,
   'admin', m.admin_option,
   'inherit', m.inherit_option,
   'set', m.set_option
  ) ORDER BY member_role.rolname,granted_role.rolname,grantor_role.rolname), '[]'::jsonb)
  FROM pg_catalog.pg_auth_members m
  JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
  JOIN pg_catalog.pg_roles granted_role ON granted_role.oid=m.roleid
  JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid=m.grantor
  WHERE member_role.rolname IN (SELECT name FROM expected)
     OR granted_role.rolname IN (SELECT name FROM expected)
 ),
 'auth_uid_zero_argument_uuid_functions', (
  SELECT count(*)
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='auth' AND p.proname='uid' AND p.pronargs=0
    AND p.prorettype='pg_catalog.uuid'::pg_catalog.regtype
 )
)) AS staging_role_preflight;

ROLLBACK;
