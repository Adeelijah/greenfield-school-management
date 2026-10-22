-- REVIEW ONLY. No authorization to connect or execute is supplied by this file.
-- Read-only catalog inspection for an explicitly authorized ISOLATED staging DB.
-- Target schema public matches current source; review this literal for the target.
-- No application rows, passwords, connection URLs, auth tokens or function bodies.
-- Missing catalog rows are NOT a pass. Compare every result with the package plan.

SELECT current_database() AS database_name, current_user AS inspection_role,
       session_user AS login_role, current_setting('server_version') AS server_version;

-- Required report/assessment surface: 11 existing dependencies + 16 proposed tables.
WITH expected(name) AS (VALUES
 ('schools'), ('school_users'), ('memberships'), ('academic_sessions'), ('terms'),
 ('academic_levels'), ('academic_sections'), ('classes'), ('students'), ('enrollments'),
 ('teacher_class_assignments'), ('assessment_subjects'), ('assessment_config_versions'),
 ('assessment_scopes'), ('assessment_subject_roster'), ('assessment_teacher_subjects'),
 ('assessment_scores'), ('assessment_source_versions'), ('assessment_teacher_reviews'),
 ('assessment_finalizations'), ('assessment_audit'), ('assessment_operation_receipts'),
 ('report_cards'), ('report_card_snapshots'), ('report_card_audit'),
 ('report_card_operation_receipts'), ('report_card_releases'))
SELECT e.name AS expected_relation, c.oid IS NOT NULL AS present,
       c.relkind, c.relrowsecurity, c.relforcerowsecurity,
       pg_catalog.pg_get_userbyid(c.relowner) AS owner
FROM expected e
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = e.name
ORDER BY e.name;

-- Complete column/type/null/default inventory; compare structure, not names alone.
SELECT c.relname AS relation, a.attnum AS ordinal, a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type, a.attnotnull,
       pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expression
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname, a.attnum;

-- Named unique indexes alone are insufficient: inspect columns, predicate and validity.
SELECT t.relname AS relation, i.relname AS index_name, x.indisunique,
       x.indisvalid, x.indisready, pg_catalog.pg_get_indexdef(i.oid) AS definition
FROM pg_catalog.pg_index x
JOIN pg_catalog.pg_class t ON t.oid = x.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
JOIN pg_catalog.pg_class i ON i.oid = x.indexrelid
WHERE n.nspname = 'public'
ORDER BY t.relname, i.relname;

SELECT c.relname AS relation, k.conname, k.contype, k.convalidated,
       pg_catalog.pg_get_constraintdef(k.oid) AS definition
FROM pg_catalog.pg_constraint k
JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, k.conname;

SELECT t.typname AS enum_name, e.enumsortorder, e.enumlabel
FROM pg_catalog.pg_type t
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;

SELECT c.relname AS relation, t.tgname, t.tgenabled,
       pg_catalog.pg_get_triggerdef(t.oid) AS definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- Capture policy applicability, including PUBLIC/restrictive policies that may
-- constrain the narrow authority owner and hide the second active membership.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- These are source candidate names, not evidence that runtime mapping is approved.
SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolbypassrls,
       rolcreaterole, rolcreatedb, rolreplication
FROM pg_catalog.pg_roles
WHERE rolname IN ('greenfield_app', 'greenfield_report_card_runtime',
                 'greenfield_report_card_authority_owner')
ORDER BY rolname;

-- Membership edges in BOTH directions; options must be inspected for each edge.
SELECT member_role.rolname AS member, granted_role.rolname AS granted_role,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_catalog.pg_auth_members m
JOIN pg_catalog.pg_roles member_role ON member_role.oid = m.member
JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = m.roleid
WHERE member_role.rolname IN ('greenfield_app', 'greenfield_report_card_runtime',
                              'greenfield_report_card_authority_owner')
   OR granted_role.rolname IN ('greenfield_app', 'greenfield_report_card_runtime',
                               'greenfield_report_card_authority_owner')
ORDER BY member_role.rolname, granted_role.rolname;

SELECT n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_catalog.pg_get_userbyid(p.proowner) AS owner, p.prosecdef,
       p.proacl AS explicit_function_acl,
       ARRAY(SELECT s FROM pg_catalog.unnest(p.proconfig) s
             WHERE s LIKE 'search_path=%' OR s LIKE 'row_security=%') AS security_settings
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN
 ('resolve_report_card_actor', 'lock_report_card_actor',
  'lock_report_card_authority_write_gate', 'lock_report_card_membership_actor_anchor')
ORDER BY p.proname, arguments;

-- Explicit ACL entries only; a NULL ACL means defaults, never "no privilege".
-- Transitive ownership, effective grants, PUBLIC defaults, column privileges,
-- partition/sequence/schema access and runtime denial probes need separate review.
SELECT c.relname AS relation, c.relacl AS explicit_relation_acl
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S')
ORDER BY c.relname;

SELECT c.relname AS relation, a.attname AS column_name, a.attacl AS explicit_column_acl
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
ORDER BY c.relname, a.attnum;
