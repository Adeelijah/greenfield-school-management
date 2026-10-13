import { config } from 'dotenv';
import postgres from 'postgres';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

config({ path: '.env.local', quiet: true });

export const tenantTables = [
  'schools', 'school_users', 'memberships', 'academic_sessions',
  'terms', 'classes', 'students', 'guardians', 'student_guardians',
  'enrollments', 'admissions', 'audit_events',
];

/**
 * Read-only catalog inspection. Uses the migration connection solely to
 * inspect grants and role memberships; does not create roles or modify data.
 * PostgreSQL effective privileges include PUBLIC and inherited role grants.
 */
export async function inspectDatabasePrivileges(sql) {
  const [roles, memberships, grants, schemas, tablePrivileges] = await Promise.all([
    sql`SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit
        FROM pg_catalog.pg_roles
        WHERE rolname IN ('postgres', 'greenfield_app', 'authenticated', 'anon', 'service_role')
        ORDER BY rolname`,
    sql`SELECT member.rolname AS member_role, parent.rolname AS granted_role,
          pg_catalog.pg_has_role(member.oid, parent.oid, 'USAGE') AS inherited_usage,
          pg_catalog.pg_has_role(member.oid, parent.oid, 'MEMBER') AS membership
        FROM pg_catalog.pg_auth_members am
        JOIN pg_catalog.pg_roles member ON member.oid = am.member
        JOIN pg_catalog.pg_roles parent ON parent.oid = am.roleid
        WHERE member.rolname IN ('postgres', 'greenfield_app', 'authenticated', 'anon', 'service_role')
        ORDER BY member.rolname, parent.rolname`,
    sql`SELECT grantee, table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name = ANY(${tenantTables})
          AND grantee IN ('PUBLIC', 'greenfield_app', 'authenticated', 'anon', 'service_role')
        ORDER BY grantee, table_name, privilege_type`,
    sql`SELECT n.nspname AS schema_name, r.rolname AS role_name,
          has_schema_privilege(r.oid, n.oid, 'USAGE') AS can_use_schema,
          has_schema_privilege(r.oid, n.oid, 'CREATE') AS can_create_in_schema
        FROM pg_catalog.pg_namespace n
        CROSS JOIN pg_catalog.pg_roles r
        WHERE n.nspname = 'public'
          AND r.rolname IN ('greenfield_app', 'authenticated', 'anon', 'service_role')
        ORDER BY r.rolname`,
    sql`SELECT c.relname AS table_name, r.rolname AS role_name,
          has_table_privilege(r.oid, c.oid, 'SELECT') AS can_select,
          has_table_privilege(r.oid, c.oid, 'INSERT') AS can_insert,
          has_table_privilege(r.oid, c.oid, 'UPDATE') AS can_update,
          has_table_privilege(r.oid, c.oid, 'DELETE') AS can_delete,
          c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN pg_catalog.pg_roles r
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND c.relname = ANY(${tenantTables})
          AND r.rolname IN ('greenfield_app', 'authenticated', 'anon', 'service_role')
        ORDER BY c.relname, r.rolname`,
  ]);
  return {
    mode: 'READ_ONLY_PRIVILEGE_AUDIT',
    roles, memberships, explicitTableGrants: grants,
    effectiveSchemaPrivileges: schemas,
    effectiveTablePrivileges: tablePrivileges,
    note: 'Inspection only. Role membership, default privileges, function execution, column grants and policy behavior require additional review; no security approval is implied.',
  };
}

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is missing');
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
  try {
    const report = await inspectDatabasePrivileges(sql);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error('Privilege audit failed:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  });
}
