import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOrderedFoundation, splitStatements } from './prepare-foundation-ordering-preview.mjs';

config({ path: '.env.local', quiet: true });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function validateDisposableTarget(env) {
  const value = env.GREENFIELD_DISPOSABLE_DATABASE_URL;
  if (!value) throw new Error('GREENFIELD_DISPOSABLE_DATABASE_URL is required');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL URL required');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase())) {
    throw new Error('Only loopback PostgreSQL is accepted');
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^greenfield_disposable_[a-z0-9_]+$/.test(database)) {
    throw new Error('Database name must begin greenfield_disposable_');
  }
  if (value === env.MIGRATION_DATABASE_URL || value === env.DATABASE_URL) {
    throw new Error('Disposable URL must differ from configured application and migration URLs');
  }
  return value;
}

export function inspectFoundationStatements(source) {
  const { sql, report } = buildOrderedFoundation(source);
  return { statements: splitStatements(sql).map((statement, index) => index === 0 ?
    statement.replace(/^-- REVIEW-ONLY GENERATED FOUNDATION ORDERING[^\n]*\n-- No database changes[^\n]*\n/, '') : statement),
    report };
}

export async function runRollbackValidation(sql, source) {
  const { statements, report } = inspectFoundationStatements(source);
  let verified;
  const rollbackMarker = 'GREENFIELD_INTENTIONAL_ROLLBACK';
  try {
    await sql.begin(async tx => {
      // Everything, including test-only Supabase auth stub, is transactional.
      await tx.unsafe('CREATE SCHEMA auth');
      await tx.unsafe('CREATE TABLE auth.users (id uuid PRIMARY KEY)');
      for (const statement of statements) await tx.unsafe(statement);
      const [counts] = await tx.unsafe(`
        SELECT
          (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('schools','school_users','memberships','academic_sessions','terms','classes','students','guardians','student_guardians','enrollments','admissions','audit_events')) AS tables,
          (SELECT count(*)::int FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f') AS foreign_keys,
          (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i' AND c.relname IN (
            'sessions_school_label_unique','sessions_school_id_id_unique','sessions_one_current_per_school',
            'admissions_school_status_idx','audit_events_school_created_idx','classes_school_name_unique',
            'classes_school_id_id_unique','enrollments_student_session_unique','enrollments_class_session_idx',
            'guardians_school_idx','guardians_school_id_id_unique','memberships_school_user_unique',
            'memberships_user_idx','student_guardian_unique','students_school_admission_unique',
            'students_school_id_id_unique','students_school_name_idx','terms_session_name_unique',
            'terms_one_current_per_school')) AS indexes
      `);
      if (counts.tables !== 12 || counts.foreign_keys !== 20 || counts.indexes !== 19) {
        throw new Error('Unexpected foundation object counts');
      }
      verified = { mode: 'ISOLATED_ROLLBACK_VALIDATION', foundation: report, counts, authStubOnly: true, transactionRolledBack: false };
      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (error.message !== rollbackMarker || !verified) throw error;
  }
  // The transaction has rolled back. Check no foundation objects survived.
  const [remaining] = await sql.unsafe(`
    SELECT
      (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname='schools') AS schools,
      (SELECT count(*)::int FROM pg_catalog.pg_namespace WHERE nspname='auth') AS auth_schema
  `);
  if (remaining.schools !== 0 || remaining.auth_schema !== 0) throw new Error('Rollback verification failed: unexpected objects remain');
  return { ...verified, transactionRolledBack: true, residualObjects: remaining,
    note: 'Local disposable database only. Auth schema was a temporary stub; Supabase-specific integration and RLS are not validated.' };
}

async function main() {
  if (!process.argv.includes('--execute-local-rollback')) throw new Error('Explicit --execute-local-rollback required');
  const url = validateDisposableTarget(process.env);
  const source = readFileSync(resolve(root, 'drizzle/0000_broad_slayback.sql'), 'utf8');
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const report = await runRollbackValidation(sql, source);
    console.log(JSON.stringify(report, null, 2));
  } finally { await sql.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Isolated validation refused or failed. No connection details or SQL errors printed.');
    process.exitCode = 1;
  });
}
