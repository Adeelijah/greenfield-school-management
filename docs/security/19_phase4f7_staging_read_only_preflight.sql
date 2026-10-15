-- GREENFIELD PHASE 4F.7: STAGING READ-ONLY PREFLIGHT
-- SELECT only. Intended for greenfield-staging SQL Editor, never as a migration.
-- Review every result. Do not execute any DDL/DCL from this file.
-- Do not print connection strings, API keys, JWTs, or auth.users rows.

-- 1. Identify target and existing Greenfield footprint.
SELECT current_database() AS database_name, current_user AS executing_role,
       current_setting('server_version') AS postgres_version,
       to_regclass('public.schools')::text AS schools_table,
       to_regclass('drizzle.__drizzle_migrations')::text AS drizzle_journal,
       to_regclass('auth.users')::text AS supabase_auth_users;

-- 2. Public schema exposure cannot be established from PostgreSQL alone:
--    separately confirm Supabase Dashboard > Project Settings > Data API > Exposed schemas.
SELECT n.nspname AS schema_name, r.rolname,
       has_schema_privilege(r.rolname, n.oid, 'USAGE') AS can_use_schema,
       has_schema_privilege(r.rolname, n.oid, 'CREATE') AS can_create_in_schema
FROM pg_namespace n CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND r.rolname IN ('anon','authenticated','service_role','postgres')
ORDER BY r.rolname;

-- 3. Inspect all existing public tables and RLS status.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced, pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
ORDER BY c.relname;

-- 4. Detect preexisting policies (review for permissive OR combinations).
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5. Expand effective existing table ACL entries, if any.
SELECT n.nspname, c.relname, grantor.rolname AS grantor, grantee.rolname AS grantee,
       acl.privilege_type, acl.is_grantable
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r',c.relowner))) acl
LEFT JOIN pg_roles grantor ON grantor.oid = acl.grantor
LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
ORDER BY c.relname, grantee.rolname, acl.privilege_type;

-- 6. Default ACLs that could automatically grant access to NEW objects.
--    NULL grantee means PUBLIC; null schema means global default.
SELECT pg_get_userbyid(d.defaclrole) AS creating_role,
       COALESCE(n.nspname, '(global)') AS schema_name,
       d.defaclobjtype AS object_type,
       COALESCE(r.rolname, 'PUBLIC') AS grantee,
       a.privilege_type, a.is_grantable
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname = 'public' OR d.defaclnamespace = 0
ORDER BY creating_role, schema_name, object_type, grantee, privilege_type;

-- 7. Role inheritance / bypass-RLS attributes (no secrets).
SELECT rolname, rolinherit, rolbypassrls, rolsuper, rolcanlogin
FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','postgres')
ORDER BY rolname;

-- 8. Memberships among relevant roles; review inherited privileges.
SELECT member.rolname AS member_role, parent.rolname AS granted_role,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_auth_members m
JOIN pg_roles member ON member.oid = m.member
JOIN pg_roles parent ON parent.oid = m.roleid
WHERE member.rolname IN ('anon','authenticated','service_role','postgres')
   OR parent.rolname IN ('anon','authenticated','service_role')
ORDER BY member_role, granted_role;

-- 9. Inspect default PUBLIC EXECUTE grants on functions in public.
SELECT p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS arguments,
       has_function_privilege('PUBLIC', p.oid, 'EXECUTE') AS public_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
ORDER BY p.proname, arguments;
