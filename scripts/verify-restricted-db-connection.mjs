import { config } from 'dotenv';
import postgres from 'postgres';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

config({ path: '.env.local', quiet: true });

export const ROLE = 'greenfield_app';

export function validateConnectionEnvironment(env) {
  const password = env.GREENFIELD_APP_DB_PASSWORD;
  if (!password || password.length < 24) throw new Error('GREENFIELD_APP_DB_PASSWORD is missing or too short');
  if (!env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required');
  const url = new URL(env.MIGRATION_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Expected PostgreSQL connection URL');
  if (!url.hostname) throw new Error('Database hostname missing');
  if (url.username === ROLE) throw new Error('MIGRATION_DATABASE_URL must remain the operator connection');
  return { hostname: url.hostname, port: url.port || '5432', database: decodeURIComponent(url.pathname.slice(1)) };
}

export function makeRestrictedUrl(env) {
  validateConnectionEnvironment(env);
  const url = new URL(env.MIGRATION_DATABASE_URL);
  url.username = ROLE;
  url.password = env.GREENFIELD_APP_DB_PASSWORD;
  // Keep the existing host, port, database and SSL configuration.
  return url.toString();
}

export async function verifyRestrictedConnection(sql) {
  const [identity] = await sql`
    SELECT current_user AS current_user, session_user AS session_user,
      current_database() AS database_name,
      (SELECT rolcanlogin FROM pg_catalog.pg_roles WHERE rolname = current_user) AS can_login,
      (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user) AS bypass_rls,
      (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user) AS superuser`;
  const memberships = await sql`
    SELECT parent.rolname AS granted_role
    FROM pg_catalog.pg_auth_members am
    JOIN pg_catalog.pg_roles member ON member.oid = am.member
    JOIN pg_catalog.pg_roles parent ON parent.oid = am.roleid
    WHERE member.rolname = current_user`;
  const [schema] = await sql`
    SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS can_use_public,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public`;
  const tablePrivileges = await sql`
    SELECT n.nspname AS schema_name, c.relname AS table_name,
      has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
      has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
      has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
      has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ORDER BY c.relname`;
  const safe = identity?.current_user === ROLE && identity.session_user === ROLE &&
    identity.can_login === true && identity.bypass_rls === false &&
    identity.superuser === false && memberships.length === 0 &&
    schema?.can_create_public === false &&
    tablePrivileges.every(t => !t.can_select && !t.can_insert && !t.can_update && !t.can_delete);
  return {
    mode: 'READ_ONLY_RESTRICTED_CONNECTION_VERIFICATION',
    verified: safe,
    identity,
    memberships,
    schema,
    tablePrivileges,
    note: 'Only SELECT statements were issued. This does not prove function/default/column grants or tenant isolation.',
  };
}

async function main() {
  const url = makeRestrictedUrl(process.env);
  const sql = postgres(url, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 2,
    prepare: false,
    onnotice: () => {},
  });
  try {
    const result = await verifyRestrictedConnection(sql);
    console.log(JSON.stringify(result, null, 2));
    if (!result.verified) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('Restricted connection verification failed. Check connection settings and role credentials locally; no credentials were printed.');
    process.exitCode = 1;
  });
}
