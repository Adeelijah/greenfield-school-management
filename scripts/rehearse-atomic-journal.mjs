import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDisposableTarget, inspectFoundationStatements } from './validate-isolated-foundation.mjs';
import { securityStatements } from './validate-isolated-security.mjs';
import { securityAssertionSql, assertSecurityRow } from './staging-security-assertions.mjs';

config({ path: '.env.local', quiet: true });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const database = 'greenfield_disposable_atomic_runner';
const folder = resolve(root, 'docs/security/generated/staging-baseline');
const foundation = inspectFoundationStatements(read('drizzle/0000_broad_slayback.sql')).statements;
const security = securityStatements(read('docs/security/09_consolidated_read_only_review.sql'));
const fk = read('docs/security/05_auth_user_fk_review.sql').split('\n').filter(x => !x.trim().startsWith('--')).join('\n').split(';').map(x => x.trim()).find(x => x.startsWith('ALTER TABLE'));
const migrations = readMigrationFiles({ migrationsFolder: folder });
if (foundation.length !== 55 || security.length !== 35 || !fk ||
    migrations.length !== 1 || migrations[0].sql.length !== 55) throw new Error('Unexpected SQL or migration inventory');

function checkTarget(env) {
  const url = validateDisposableTarget(env);
  const parsed = new URL(url);
  if (decodeURIComponent(parsed.pathname.slice(1)) !== database ||
      (parsed.port && parsed.port !== '5432')) throw new Error('Exact local atomic-runner database required');
  return url;
}
async function state(sql) {
  const [row] = await sql.unsafe(`SELECT
    current_database() AS database,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS tables,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity) AS forced_rls,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
    to_regclass('drizzle.__drizzle_migrations')::text AS journal,
    EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='auth') AS auth_schema,
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated')) AS roles`);
  return row;
}
function assert(condition, message) { if (!condition) throw new Error(message); }
async function apply(tx, fail) {
  await tx.unsafe('CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await tx.unsafe('CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await tx.unsafe('CREATE SCHEMA auth');
  await tx.unsafe('CREATE TABLE auth.users (id uuid PRIMARY KEY)');
  await tx.unsafe("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$");
  await tx.unsafe('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated');
  for (const statement of foundation) await tx.unsafe(statement);
  if (fail) throw new Error('INJECTED_FAILURE');
  await tx.unsafe(fk);
  for (const statement of security) await tx.unsafe(statement);
  await tx.unsafe('CREATE SCHEMA drizzle');
  await tx.unsafe('CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)');
  const [checks] = await tx.unsafe(`SELECT
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity) AS rls,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
    (SELECT count(*)::int FROM pg_constraint WHERE conname='school_users_auth_user_id_auth_users_id_fk') AS fk,
    has_table_privilege('anon','public.schools','SELECT') AS anon_read,
    has_table_privilege('authenticated','public.schools','INSERT') AS auth_write,
    has_column_privilege('authenticated','public.students','date_of_birth','SELECT') AS dob_read`);
  assert(checks.rls === 12 && checks.policies === 7 && checks.fk === 1 &&
    !checks.anon_read && !checks.auth_write && !checks.dob_read, 'Security assertions failed');
  const [securityRow] = await tx.unsafe(securityAssertionSql());
  assertSecurityRow(securityRow);
  // Mirror the installed Drizzle migrator's journal schema and values.
  await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${migrations[0].hash}, ${migrations[0].folderMillis})`;
  return checks;
}
async function main() {
  assert(process.argv.includes('--execute-local-atomic'), 'Explicit local-only execution flag required');
  const url = checkTarget(process.env);
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 5, onnotice: () => {} });
  try {
    const before = await state(sql);
    assert(before.database === database && before.tables === 0 && before.forced_rls === 0 &&
      before.policies === 0 && before.journal === null && !before.auth_schema && !before.roles,
      'Database not clean or roles already exist');
    try {
      await sql.begin(tx => apply(tx, true));
      throw new Error('Failure injection unexpectedly committed');
    } catch (error) {
      if (error.message !== 'INJECTED_FAILURE') throw error;
    }
    const rolledBack = await state(sql);
    assert(rolledBack.tables === 0 && rolledBack.journal === null && !rolledBack.roles &&
      !rolledBack.auth_schema && rolledBack.policies === 0, 'Injected failure left objects behind');
    const checks = await sql.begin(tx => apply(tx, false));
    const committed = await state(sql);
    assert(committed.tables === 12 && committed.forced_rls === 12 &&
      committed.policies === 7 && committed.journal === 'drizzle.__drizzle_migrations', 'Commit assertions failed');
    const [entry] = await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations`;
    const [count] = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    assert(count.n === 1 && entry.hash === migrations[0].hash &&
      Number(entry.created_at) === migrations[0].folderMillis, 'Journal mismatch');
    await migrate(drizzle(sql), { migrationsFolder: folder });
    const [rerun] = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    assert(rerun.n === 1, 'Drizzle rerun modified journal');
    console.log(JSON.stringify({
      mode: 'PHASE4F6_LOCAL_ATOMIC_JOURNAL', database, injectedFailureRolledBack: true,
      committed: { tables: committed.tables, forcedRls: checks.rls, policies: checks.policies, authFk: checks.fk },
      journalMatchesMigration: true, journalEntriesAfterDrizzleRerun: rerun.n,
      cleanupRequired: true, stagingApproved: false, supabaseChanged: false
    }, null, 2));
  } finally { await sql.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Local atomic journal rehearsal failed or refused:', String(error.message).slice(0, 180));
    process.exitCode = 1;
  });
}
