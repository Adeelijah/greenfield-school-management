import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDisposableTarget, inspectFoundationStatements } from './validate-isolated-foundation.mjs';
import { securityStatements } from './validate-isolated-security.mjs';

config({ path: '.env.local', quiet: true });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const marker = 'GREENFIELD_REHEARSAL_INTENTIONAL_ROLLBACK';
const foundation = inspectFoundationStatements(read('drizzle/0000_broad_slayback.sql')).statements;
const security = securityStatements(read('docs/security/09_consolidated_read_only_review.sql'));
const fk = read('docs/security/05_auth_user_fk_review.sql').split('\n').filter(x => !x.trim().startsWith('--')).join('\n').split(';').map(x => x.trim()).find(x => x.startsWith('ALTER TABLE'));
if (!fk || foundation.length !== 55 || security.length !== 35) throw new Error('Unexpected reviewed SQL inventory');

async function state(sql) {
  const [s] = await sql.unsafe(`SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tables,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity) AS forced_rls,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
    EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth') AS auth_schema,
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated')) AS roles`);
  return s;
}

async function rehearsal(sql, injectFailure) {
  let observed;
  try {
    await sql.begin(async tx => {
      await tx.unsafe('CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await tx.unsafe('CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await tx.unsafe('CREATE SCHEMA auth');
      await tx.unsafe('CREATE TABLE auth.users (id uuid PRIMARY KEY)');
      await tx.unsafe("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$");
      // Emulate the broad Supabase defaults within this disposable transaction.
      await tx.unsafe('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated');
      for (const statement of foundation) await tx.unsafe(statement);
      const [before] = await tx.unsafe(`SELECT
        has_table_privilege('anon','public.schools','SELECT') AS anon_read,
        has_table_privilege('authenticated','public.schools','INSERT') AS authenticated_write`);
      if (!before.anon_read || !before.authenticated_write) throw new Error('Broad default grant simulation failed');
      if (injectFailure) throw new Error(marker);
      await tx.unsafe(fk);
      for (const statement of security) await tx.unsafe(statement);
      const [after] = await tx.unsafe(`SELECT
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity) AS forced_rls,
        (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
        (SELECT count(*)::int FROM pg_constraint WHERE conname='school_users_auth_user_id_auth_users_id_fk') AS auth_fk,
        has_table_privilege('anon','public.schools','SELECT') AS anon_read,
        has_table_privilege('authenticated','public.schools','INSERT') AS authenticated_write,
        has_column_privilege('authenticated','public.students','date_of_birth','SELECT') AS dob_read,
        has_table_privilege('authenticated','public.schools','SELECT') AS authenticated_school_read`);
      if (after.forced_rls !== 12 || after.policies !== 7 || after.auth_fk !== 1 ||
          after.anon_read || after.authenticated_write || after.dob_read || !after.authenticated_school_read) {
        throw new Error('Post-security grant/RLS assertion failed');
      }
      observed = { before, after };
      throw new Error(marker);
    });
  } catch (error) {
    if (error.message !== marker) throw error;
  }
  const residual = await state(sql);
  if (residual.tables !== 0 || residual.forced_rls !== 0 || residual.policies !== 0 || residual.auth_schema || residual.roles) {
    throw new Error('Rollback left objects behind');
  }
  return { mode: injectFailure ? 'INJECTED_FAILURE_ROLLBACK' : 'COMPLETE_SECURITY_TRANSACTION_ROLLBACK',
    observed, rollbackVerified: true };
}

async function main() {
  if (!process.argv.includes('--execute-local-rollback')) throw new Error('Explicit rollback flag required');
  const url = validateDisposableTarget(process.env);
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const [db] = await sql.unsafe('SELECT current_database() AS name');
    if (db.name !== 'greenfield_disposable_validation') throw new Error('Exact disposable validation database required');
    const before = await state(sql);
    if (before.tables || before.forced_rls || before.policies || before.auth_schema || before.roles) {
      throw new Error('Disposable database not clean');
    }
    const failure = await rehearsal(sql, true);
    const success = await rehearsal(sql, false);
    console.log(JSON.stringify({ mode: 'PHASE4F5_TRANSACTION_REHEARSAL', database: db.name,
      foundationStatements: foundation.length, securityStatements: security.length,
      injectedFailure: failure, completeTransaction: success,
      supabaseChanged: false, stagingApproved: false }, null, 2));
  } finally { await sql.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Local transactional rehearsal failed or refused. Code:', String(error.code || 'ASSERTION'), 'No credentials printed.');
    process.exitCode = 1;
  });
}
