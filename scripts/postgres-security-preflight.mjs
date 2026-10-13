// Read-only live PostgreSQL security preflight. Never applies migrations,
// creates fixtures, changes session roles, or prints connection strings.
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const required = ['schools','school_users','memberships','academic_sessions','terms','classes','students','guardians','student_guardians','enrollments','admissions','audit_events'];
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error('SKIP: MIGRATION_DATABASE_URL is not set in .env.local. No database accessed.');
  process.exitCode = 2;
} else {
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 8, idle_timeout: 3 });
  try {
    const [identity] = await sql`SELECT current_database() AS database_name, current_user AS database_role,
      (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass_rls`;
    const tables = await sql`
      SELECT c.relname AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
        pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
        AND c.relname = ANY(${required})
      ORDER BY c.relname
    `;
    const policies = await sql`
      SELECT tablename, policyname, cmd, roles
      FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(${required})
      ORDER BY tablename, policyname
    `;
    const privileges = await sql`
      SELECT table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = ANY(${required})
        AND grantee IN ('anon','authenticated','PUBLIC')
      ORDER BY table_name, grantee, privilege_type
    `;
    const authFk = await sql`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class t ON t.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'school_users'
        AND con.contype = 'f'
        AND con.confrelid = to_regclass('auth.users')
    `;
    const missing = required.filter(name => !tables.some(row => row.name === name));
    const weakRls = tables.filter(row => !row.rls || !row.force_rls).map(row => row.name);
    const sensitive = new Set(['students','guardians','student_guardians','enrollments','admissions','audit_events']);
    const sensitiveTableGrants = privileges.filter(row => sensitive.has(row.table_name) && row.privilege_type === 'SELECT');
    console.log(JSON.stringify({
      mode: 'READ_ONLY_PREFLIGHT', database: identity.database_name, databaseRole: identity.database_role,
      databaseRoleBypassesRls: identity.bypass_rls,
      tablesFound: tables.length, missingTables: missing, tablesWithoutFullRls: weakRls,
      policyCount: policies.length, policies: policies.map(p => ({table:p.tablename, name:p.policyname, command:p.cmd, roles:p.roles})),
      browserRoleGrants: privileges, sensitiveTableSelectGrants: sensitiveTableGrants,
      authUsersForeignKeyPresent: authFk.length > 0,
      readyForJwtIntegrationTests: missing.length === 0 && weakRls.length === 0 && authFk.length > 0
    }, null, 2));
    if (missing.length || weakRls.length || !authFk.length) {
      console.error('NOT READY: This is expected before reviewed migrations. Do not run migrations from this report.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Preflight failed:', error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]') : 'unknown error');
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 3 });
  }
}
