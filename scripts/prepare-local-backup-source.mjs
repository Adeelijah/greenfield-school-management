import { config } from 'dotenv';
import postgres from 'postgres';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDisposableTarget, inspectFoundationStatements } from './validate-isolated-foundation.mjs';
import { securityStatements } from './validate-isolated-security.mjs';
import { securityAssertionSql, assertSecurityRow } from './staging-security-assertions.mjs';

// This is a local-only disposable schema installer, NOT a staging deployer.
// dotenv is loaded for parity with other scripts, but only the explicitly named
// GREENFIELD_DISPOSABLE_DATABASE_URL is used for the connection.
config({ path: '.env.local', quiet: true });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const database = 'greenfield_disposable_backup_source';
const folder = resolve(root, 'docs/security/generated/staging-baseline');
const foundation = inspectFoundationStatements(read('drizzle/0000_broad_slayback.sql')).statements;
const security = securityStatements(read('docs/security/09_consolidated_read_only_review.sql'));
const fk = read('docs/security/05_auth_user_fk_review.sql')
  .split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
  .split(';').map(line => line.trim()).find(line => line.startsWith('ALTER TABLE'));
const migrations = readMigrationFiles({ migrationsFolder: folder });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(foundation.length === 55 && security.length === 35 && fk &&
  migrations.length === 1 && migrations[0].sql.length === 55, 'Unexpected migration inventory');

function targetUrl() {
  const value = validateDisposableTarget(process.env);
  const url = new URL(value);
  assert(url.hostname === '127.0.0.1' && (url.port === '' || url.port === '5432') &&
    decodeURIComponent(url.pathname.slice(1)) === database &&
    !url.search && !url.hash, 'Exact 127.0.0.1:5432 local backup-source database required');
  return value;
}
async function preflight(sql) {
  const [row] = await sql.unsafe(`SELECT current_database() AS db,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','v','m','S','f','p')) AS objects,
    (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
    EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='auth') AS auth_schema,
    EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='drizzle') AS drizzle_schema,
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated')) AS browser_roles`);
  assert(row.db === database && row.objects === 0 && row.policies === 0 &&
    !row.auth_schema && !row.drizzle_schema && !row.browser_roles,
    'Source database or cluster is not clean; refused without changes');
}
async function main() {
  assert(process.argv.length === 3 && process.argv[2] === '--execute-local-backup-source',
    'Explicit --execute-local-backup-source flag required');
  const sql = postgres(targetUrl(), { max: 1, prepare: false, connect_timeout: 5, onnotice: () => {} });
  try {
    await preflight(sql);
    await sql.begin(async tx => {
      // Cluster-global roles are created only if the preflight confirms they do not exist.
      // They intentionally remain after commit and must be cleaned up separately
      // after checking no other database depends on them.
      await tx.unsafe('CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await tx.unsafe('CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await tx.unsafe('CREATE SCHEMA auth');
      await tx.unsafe('CREATE TABLE auth.users (id uuid PRIMARY KEY)');
      await tx.unsafe("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$");
      await tx.unsafe('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated');
      for (const statement of foundation) await tx.unsafe(statement);
      await tx.unsafe(fk);
      for (const statement of security) await tx.unsafe(statement);
      await tx.unsafe('CREATE SCHEMA drizzle');
      await tx.unsafe('CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)');
      const [securityRow] = await tx.unsafe(securityAssertionSql());
      assertSecurityRow(securityRow);
      const [counts] = await tx.unsafe(`SELECT
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r') AS tables,
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity) AS forced_rls,
        (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
        (SELECT count(*)::int FROM pg_constraint WHERE conname='school_users_auth_user_id_auth_users_id_fk') AS auth_fk`);
      assert(counts.tables === 12 && counts.forced_rls === 12 &&
        counts.policies === 7 && counts.auth_fk === 1, 'Unexpected security object counts');
      await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${migrations[0].hash}, ${migrations[0].folderMillis})`;
    });
    const [journal] = await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations`;
    const [count] = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    assert(count.n === 1 && journal.hash === migrations[0].hash &&
      Number(journal.created_at) === migrations[0].folderMillis, 'Migration journal mismatch');
    console.log(JSON.stringify({
      mode: 'PHASE4F21_LOCAL_BACKUP_SOURCE', database,
      foundationTables: 12, forcedRlsTables: 12, policies: 7, authFk: 1,
      journalMatches: true, syntheticDataInserted: false,
      clusterRolesCreated: ['anon', 'authenticated'],
      cleanupRequiresSeparateReview: true,
      remoteConnectionsMade: false, stagingDeploymentAuthorized: false
    }, null, 2));
  } finally {
    await sql.end();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Local backup-source installation refused or failed; review target and database state.');
    process.exitCode = 1;
  });
}
