import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: '.env.local', quiet: true });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = resolve(root, 'docs/security/generated/staging-baseline');
const expectedDatabase = 'greenfield_disposable_migration_runner';

export function validateRunnerTarget(env) {
  const raw = env.GREENFIELD_DISPOSABLE_DATABASE_URL;
  if (!raw) throw new Error('Missing disposable local database URL');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase()) ||
      decodeURIComponent(url.pathname.slice(1)) !== expectedDatabase ||
      (url.port && url.port !== '5432') ||
      raw === env.DATABASE_URL || raw === env.MIGRATION_DATABASE_URL) {
    throw new Error('Refusing nonlocal, unexpected or shared database target');
  }
  return raw;
}

async function inspect(sql) {
  const [row] = await sql.unsafe(`SELECT
    current_database() AS database_name,
    (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS public_tables,
    (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i') AS public_indexes,
    (SELECT count(*)::int FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f') AS public_foreign_keys,
    to_regclass('drizzle.__drizzle_migrations')::text AS journal`);
  return row;
}

async function main() {
  if (!process.argv.includes('--execute-local-disposable')) throw new Error('Explicit execution flag required');
  const url = validateRunnerTarget(process.env);
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  if (migrations.length !== 1 || migrations[0].sql.length !== 55) throw new Error('Unexpected migration inventory');
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const before = await inspect(sql);
    if (before.database_name !== expectedDatabase || before.public_tables !== 0 ||
        before.public_foreign_keys !== 0 || before.journal !== null) {
      throw new Error('Database is not empty; refusing migration');
    }
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: folder });
    const after = await inspect(sql);
    if (after.public_tables !== 12 || after.public_foreign_keys !== 20 || after.journal !== '__drizzle_migrations') {
      throw new Error('Unexpected schema after migration');
    }
    const [journal] = await sql.unsafe('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations');
    if (journal.count !== 1) throw new Error('Expected exactly one journal record');
    await migrate(db, { migrationsFolder: folder });
    const [rerun] = await sql.unsafe('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations');
    if (rerun.count !== 1) throw new Error('Migration was unexpectedly reapplied');
    console.log(JSON.stringify({
      mode: 'PHASE4F_LOCAL_DRIZZLE_MIGRATION_RUNNER',
      database: expectedDatabase,
      before: { publicTables: before.public_tables, migrationJournal: before.journal },
      after: { publicTables: after.public_tables, publicForeignKeys: after.public_foreign_keys, publicIndexes: after.public_indexes },
      journalEntries: journal.count,
      journalEntriesAfterRerun: rerun.count,
      cleanupRequired: true,
      stagingApproved: false
    }, null, 2));
  } finally { await sql.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Local migration-runner validation refused or failed. Database may contain partial test objects; inspect before cleanup. No credentials or SQL details printed.');
    process.exitCode = 1;
  });
}
