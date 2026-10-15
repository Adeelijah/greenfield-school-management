// Phase 4F.12: reusable, read-only PostgreSQL catalog assertions.
// Does not connect to any database, execute SQL, or authorize deployment.
export const GREENFIELD_TABLES = Object.freeze([
  'schools','school_users','memberships','academic_sessions','terms','classes',
  'students','guardians','student_guardians','enrollments','admissions','audit_events'
]);
export const BROWSER_ROLES = Object.freeze(['anon','authenticated']);
export const EXPECTED_POLICIES = Object.freeze([
  'gf_user_self_read','gf_membership_self_read','gf_school_active_member_read',
  'gf_session_active_member_read','gf_term_active_member_read',
  'gf_class_active_member_read','gf_student_staff_roster_read'
]);
export const STUDENT_COLUMNS = Object.freeze([
  'id','school_id','admission_number','first_name','last_name','status'
]);
export const READABLE_TABLES = Object.freeze([
  'schools','school_users','memberships','academic_sessions','terms','classes'
]);

export function securityAssertionSql() {
  // The query is designed to run INSIDE the same uncommitted transaction
  // after grants/policies and before the Drizzle journal is written.
  // PostgreSQL's has_*_privilege checks effective permissions, including
  // inherited roles and PUBLIC grants, rather than merely inspecting ACLs.
  return `
WITH expected_tables(name) AS (
  VALUES ${GREENFIELD_TABLES.map(x=>`('${x}')`).join(',')}
),
expected_policies(name) AS (
  VALUES ${EXPECTED_POLICIES.map(x=>`('${x}')`).join(',')}
),
actual_tables AS (
  SELECT c.relname AS name, c.oid, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
),
actual_policies AS (
  SELECT policyname AS name FROM pg_policies WHERE schemaname='public'
),
table_checks AS (
  SELECT count(*)::int AS count,
    bool_and(relrowsecurity AND relforcerowsecurity) AS forced
  FROM actual_tables
),
policy_checks AS (
  SELECT count(*)::int AS count FROM actual_policies
),
table_access AS (
  SELECT t.name, role_name,
    has_table_privilege(role_name, format('public.%I',t.name),'SELECT') AS can_select,
    has_table_privilege(role_name, format('public.%I',t.name),'INSERT') AS can_insert,
    has_table_privilege(role_name, format('public.%I',t.name),'UPDATE') AS can_update,
    has_table_privilege(role_name, format('public.%I',t.name),'DELETE') AS can_delete,
    has_table_privilege(role_name, format('public.%I',t.name),'TRUNCATE') AS can_truncate,
    has_table_privilege(role_name, format('public.%I',t.name),'REFERENCES') AS can_reference,
    has_table_privilege(role_name, format('public.%I',t.name),'TRIGGER') AS can_trigger
  FROM expected_tables t CROSS JOIN (VALUES ('anon'),('authenticated')) roles(role_name)
),
column_access AS (
  SELECT t.name AS table_name, a.attname AS column_name, roles.role_name,
    has_column_privilege(roles.role_name,t.oid,a.attname,'SELECT') AS can_select,
    has_column_privilege(roles.role_name,t.oid,a.attname,'INSERT') AS can_insert,
    has_column_privilege(roles.role_name,t.oid,a.attname,'UPDATE') AS can_update
  FROM actual_tables t JOIN pg_attribute a ON a.attrelid=t.oid
  CROSS JOIN (VALUES ('anon'),('authenticated')) roles(role_name)
  WHERE a.attnum>0 AND NOT a.attisdropped
),
sequence_access AS (
  SELECT c.relname, roles.role_name,
    has_sequence_privilege(roles.role_name,c.oid,'USAGE') AS can_use,
    has_sequence_privilege(roles.role_name,c.oid,'SELECT') AS can_select,
    has_sequence_privilege(roles.role_name,c.oid,'UPDATE') AS can_update
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN (VALUES ('anon'),('authenticated')) roles(role_name)
  WHERE n.nspname='public' AND c.relkind='S'
)
SELECT
 (SELECT count FROM table_checks)=12 AND
 (SELECT forced FROM table_checks) AND
 NOT EXISTS (SELECT name FROM expected_tables EXCEPT SELECT name FROM actual_tables) AND
 NOT EXISTS (SELECT name FROM actual_tables EXCEPT SELECT name FROM expected_tables) AS tables_ok,
 (SELECT count FROM policy_checks)=7 AND
 NOT EXISTS (SELECT name FROM expected_policies EXCEPT SELECT name FROM actual_policies) AND
 NOT EXISTS (SELECT name FROM actual_policies EXCEPT SELECT name FROM expected_policies) AS policy_names_ok,
 NOT EXISTS (
   SELECT 1 FROM pg_policies WHERE schemaname='public'
   AND (cmd<>'SELECT' OR roles<>ARRAY['authenticated']::name[])
 ) AS policy_modes_ok,
 NOT EXISTS (
   SELECT 1 FROM table_access WHERE
     can_insert OR can_update OR can_delete OR can_truncate OR can_reference OR can_trigger
     OR (role_name='anon' AND can_select)
     OR (role_name='authenticated' AND name NOT IN (${READABLE_TABLES.map(x=>`'${x}'`).join(',')}) AND can_select)
 ) AS table_grants_ok,
 NOT EXISTS (
   SELECT 1 FROM column_access WHERE
     can_insert OR can_update OR (role_name='anon' AND can_select)
     OR (role_name='authenticated' AND can_select AND
       NOT (table_name IN (${READABLE_TABLES.map(x=>`'${x}'`).join(',')})
         OR (table_name='students' AND column_name IN (${STUDENT_COLUMNS.map(x=>`'${x}'`).join(',')}))))
 ) AS column_grants_ok,
 NOT EXISTS (SELECT 1 FROM sequence_access WHERE can_use OR can_select OR can_update) AS sequences_ok,
 (SELECT count(*)=1 FROM pg_constraint WHERE conname='school_users_auth_user_id_auth_users_id_fk'
   AND contype='f' AND conrelid='public.school_users'::regclass
   AND confrelid='auth.users'::regclass AND confdeltype='r') AS auth_fk_ok;
`;
}

export function assertSecurityRow(row) {
  const keys=['tables_ok','policy_names_ok','policy_modes_ok','table_grants_ok',
    'column_grants_ok','sequences_ok','auth_fk_ok'];
  if (!row || keys.some(key=>row[key]!==true)) {
    throw new Error('Security assertions failed: '+keys.filter(key=>row?.[key]!==true).join(', '));
  }
  return keys;
}
