-- GREENFIELD PHASE 4F.9: EFFECTIVE ACCESS AND PROJECT IDENTITY PREFLIGHT
-- READ ONLY. Run only in the intended greenfield-staging SQL Editor.
-- Never paste passwords, JWTs, service keys, or connection strings into results.

-- 1. Database identity signals (not proof of Supabase project identity).
SELECT current_database() AS database_name, current_user AS sql_role,
       current_setting('server_version') AS postgres_version,
       to_regclass('public.schools')::text AS greenfield_schools,
       to_regclass('drizzle.__drizzle_migrations')::text AS migration_journal,
       to_regclass('auth.users')::text AS auth_users,
       to_regprocedure('auth.uid()')::text AS auth_uid_function;

-- 2. Browser role and PUBLIC privileges on public schema.
SELECT r.rolname,
       has_schema_privilege(r.rolname, 'public', 'USAGE') AS public_usage,
       has_schema_privilege(r.rolname, 'public', 'CREATE') AS public_create
FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role','postgres')
ORDER BY r.rolname;

-- 3. Role membership paths for browser roles (recursive, cycle-safe).
WITH RECURSIVE role_tree AS (
  SELECT r.oid AS origin_oid, r.oid AS current_oid, ARRAY[r.oid] AS path, 0 AS depth
  FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
  UNION ALL
  SELECT t.origin_oid, m.roleid, t.path || m.roleid, t.depth + 1
  FROM role_tree t JOIN pg_auth_members m ON m.member = t.current_oid
  WHERE m.inherit_option AND NOT m.roleid = ANY(t.path)
)
SELECT origin.rolname AS browser_role, parent.rolname AS inherited_role, min(depth) AS depth
FROM role_tree t JOIN pg_roles origin ON origin.oid=t.origin_oid
JOIN pg_roles parent ON parent.oid=t.current_oid
GROUP BY origin.rolname, parent.rolname
ORDER BY browser_role, depth, inherited_role;

-- 4. Actual effective grants for existing public tables, if any.
SELECT c.relname AS table_name, r.rolname AS role_name,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS can_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS can_delete,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname='public' AND c.relkind IN ('r','p')
  AND r.rolname IN ('anon','authenticated')
ORDER BY c.relname, r.rolname;

-- 5. Existing public functions executable by browser roles and PUBLIC.
-- This lists function signatures, not function bodies.
SELECT p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS arguments,
       has_function_privilege('PUBLIC', p.oid, 'EXECUTE') AS public_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
ORDER BY p.proname, arguments;

-- 6. Default privileges grouped for browser roles and PUBLIC, by creator.
SELECT pg_get_userbyid(d.defaclrole) AS creating_role,
       coalesce(n.nspname, '(global)') AS schema_name,
       d.defaclobjtype AS object_type,
       coalesce(r.rolname, 'PUBLIC') AS grantee,
       string_agg(DISTINCT a.privilege_type, ', ' ORDER BY a.privilege_type) AS privileges
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
LEFT JOIN pg_roles r ON r.oid=a.grantee
WHERE (n.nspname='public' OR d.defaclnamespace=0)
  AND (r.rolname IN ('anon','authenticated') OR a.grantee=0)
GROUP BY d.defaclrole,n.nspname,d.defaclobjtype,r.rolname
ORDER BY creating_role,schema_name,object_type,grantee;
