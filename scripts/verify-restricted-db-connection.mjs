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

export function inspectConnectionShape(env) {
  if (!env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required');
  const url = new URL(env.MIGRATION_DATABASE_URL);
  const hostname = url.hostname.toLowerCase();
  const isPooler = hostname.endsWith('.pooler.supabase.com');
  const isDirect = hostname.startsWith('db.') && hostname.endsWith('.supabase.co');
  const username = decodeURIComponent(url.username);
  const dot = username.indexOf('.');
  return {
    mode: 'LOCAL_CONNECTION_SHAPE',
    connectionKind: isPooler ? 'SUPABASE_POOLER' : isDirect ? 'SUPABASE_DIRECT' : 'OTHER_OR_UNKNOWN',
    port: url.port || '5432',
    operatorUsernameHasProjectSuffix: dot > 0 && dot < username.length - 1,
    operatorUsernameBaseIsPostgres: username === 'postgres' || username.startsWith('postgres.'),
    restrictedUsernameNeedsReview: isPooler,
    note: 'No hostname, project identifier, URL or password is printed. No database connection is made.',
  };
}

export function makeRestrictedUrl(env) {
  validateConnectionEnvironment(env);
  const url = new URL(env.MIGRATION_DATABASE_URL);
  const shape = inspectConnectionShape(env);
  if (shape.connectionKind === 'SUPABASE_POOLER') {
    const original = decodeURIComponent(url.username);
    const suffix = original.startsWith('postgres.') ? original.slice('postgres.'.length) : '';
    if (!suffix) throw new Error('Pooler operator username must have a project suffix; refusing to guess');
    url.username = ROLE + '.' + suffix;
  } else {
    url.username = ROLE;
  }
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

export function classifyConnectionError(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const categories = {
    '28P01': 'AUTHENTICATION_REJECTED',
    '28000': 'AUTHORIZATION_REJECTED',
    '42501': 'INSUFFICIENT_PRIVILEGE',
    '3D000': 'DATABASE_NOT_FOUND',
    'ENOTFOUND': 'DNS_RESOLUTION_FAILED',
    'EAI_AGAIN': 'DNS_RESOLUTION_FAILED',
    'ECONNREFUSED': 'CONNECTION_REFUSED',
    'ETIMEDOUT': 'CONNECTION_TIMEOUT',
    'CONNECT_TIMEOUT': 'CONNECTION_TIMEOUT',
    'ECONNRESET': 'CONNECTION_INTERRUPTED',
    'SELF_SIGNED_CERT_IN_CHAIN': 'TLS_CERTIFICATE_ERROR',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE': 'TLS_CERTIFICATE_ERROR',
  };
  // Only classify known phrases; never return raw server messages or connection details.
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  let category = categories[code] || 'UNCLASSIFIED_CONNECTION_ERROR';
  if (code === 'XX000') {
    if (/tenant or user not found|tenant.*not found|unknown tenant/.test(message)) category = 'POOLER_TENANT_OR_USERNAME_NOT_FOUND';
    else if (/password authentication failed|invalid password|authentication failed/.test(message)) category = 'POOLER_AUTHENTICATION_REJECTED';
    else if (/role .* does not exist|user .* does not exist/.test(message)) category = 'POOLER_ROLE_NOT_FOUND';
    else if (/database .* does not exist/.test(message)) category = 'POOLER_DATABASE_NOT_FOUND';
    else category = 'POOLER_OR_SERVER_INTERNAL_ERROR';
  }
  return { category, code: /^[A-Z0-9_]{2,40}$/.test(code) ? code : 'UNAVAILABLE' };
}

if (process.argv.includes('--connection-shape')) {
  try {
    console.log(JSON.stringify(inspectConnectionShape(process.env), null, 2));
  } catch {
    console.error('Connection shape inspection failed; no connection details printed.');
    process.exitCode = 1;
  }
} else if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ mode: 'RESTRICTED_CONNECTION_ERROR', ...classifyConnectionError(error), note: 'Error category uses allowlisted patterns. No raw server message, connection URL, password or query text is printed.' }, null, 2));
    process.exitCode = 1;
  });
}
