import { config } from 'dotenv';
import postgres from 'postgres';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

config({ path: '.env.local', quiet: true });

const ROLE = 'greenfield_app';

export function validateProvisioningInput(env) {
  if (!env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required');
  if (!env.GREENFIELD_APP_DB_PASSWORD || env.GREENFIELD_APP_DB_PASSWORD.length < 24) {
    throw new Error('GREENFIELD_APP_DB_PASSWORD must be at least 24 characters');
  }
  if (env.GREENFIELD_APP_DB_PASSWORD.includes('\u0000')) throw new Error('Invalid password');
  if (env.DATABASE_URL === env.MIGRATION_DATABASE_URL) {
    // Existing deployment is expected to share the URL; do not require a switch yet.
    return { existingApplicationConnectionIsPrivileged: true };
  }
  return { existingApplicationConnectionIsPrivileged: false };
}

export async function inspectProvisioningState(sql) {
  const [role] = await sql`
    SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
    FROM pg_catalog.pg_roles WHERE rolname = ${ROLE}`;
  const membership = await sql`
    SELECT parent.rolname AS granted_role
    FROM pg_catalog.pg_auth_members am
    JOIN pg_catalog.pg_roles member ON member.oid = am.member
    JOIN pg_catalog.pg_roles parent ON parent.oid = am.roleid
    WHERE member.rolname = ${ROLE}`;
  return { exists: Boolean(role), roleDetails: role ?? null, memberships: membership };
}

export async function provisionRole(sql, password) {
  // This function is only called after explicit --execute acknowledgement.
  // Identifier is a fixed constant, never user-controlled.
  const state = await inspectProvisioningState(sql);
  if (state.exists) throw new Error('Role already exists; refusing to alter an existing role');
  if (!password || password.length < 24) throw new Error('Password is missing or too short');
  // PostgreSQL role DDL cannot bind PASSWORD as $1. Ask PostgreSQL to
  // quote the password using format('%L', ...), then execute the fixed DDL.
  // Never log the generated DDL: it contains the credential.
  const [statement] = await sql`SELECT format('CREATE ROLE greenfield_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', ${password}::text) AS ddl`;
  if (!statement?.ddl?.startsWith('CREATE ROLE greenfield_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ')) {
    throw new Error('Could not safely prepare role creation statement');
  }
  await sql.unsafe(statement.ddl);
  const verified = await inspectProvisioningState(sql);
  if (!verified.exists || !verified.roleDetails.rolcanlogin || verified.roleDetails.rolsuper ||
      verified.roleDetails.rolbypassrls || verified.roleDetails.rolcreatedb || verified.roleDetails.rolcreaterole ||
      verified.roleDetails.rolreplication || verified.memberships.length !== 0) {
    throw new Error('Created role did not pass post-provisioning checks; stop and investigate');
  }
  return { created: true, role: ROLE, verifiedFlags: true, memberships: 0 };
}

async function main() {
  const execute = process.argv.includes('--execute');
  const approved = process.argv.includes('--approve-create-role');
  if (execute && !approved) throw new Error('--execute requires --approve-create-role');
  if (!execute && approved) throw new Error('Approval flag is only valid with --execute');
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is required');
  if (execute) validateProvisioningInput(process.env);
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
  try {
    const state = await inspectProvisioningState(sql);
    if (!execute) {
      console.log(JSON.stringify({
        mode: 'DRY_RUN', role: ROLE, ...state,
        plannedAction: state.exists ? 'REFUSE_EXISTING_ROLE' : 'CREATE_LOGIN_ROLE_ONLY',
        note: 'No SQL writes. Creation requires explicit --execute --approve-create-role and a password supplied in GREENFIELD_APP_DB_PASSWORD.',
      }, null, 2));
      return;
    }
    if (state.exists) throw new Error('Role already exists; no changes made');
    const result = await provisionRole(sql, process.env.GREENFIELD_APP_DB_PASSWORD);
    console.log(JSON.stringify({ mode: 'EXECUTED', ...result, note: 'No table grants or migrations were applied.' }, null, 2));
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('Role provisioning stopped:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  });
}
