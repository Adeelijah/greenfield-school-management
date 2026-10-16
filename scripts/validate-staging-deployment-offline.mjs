// Phase 4F.17: offline-only staging deployment gate. No database imports, credentials or network calls.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { inspectFoundationStatements } from './validate-isolated-foundation.mjs';
import { securityStatements } from './validate-isolated-security.mjs';
import { securityAssertionSql, assertSecurityRow } from './staging-security-assertions.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const requireTrue = (value, message) => { if (!value) throw new Error(message); };
const expectedHash = 'c8f61c5f702ae6ebad9cc2950edb1d4a288eb2a2613281cdc612167b711cba62';
const baselinePath = 'docs/security/generated/staging-baseline/0000_broad_slayback.sql';

export function validateOfflinePackage() {
  requireTrue(existsSync(resolve(root, baselinePath)), 'Generated local baseline missing');
  const baseline = read(baselinePath);
  requireTrue(sha(baseline) === expectedHash, 'Baseline SHA-256 mismatch');
  const foundation = inspectFoundationStatements(read('drizzle/0000_broad_slayback.sql')).statements;
  const security = securityStatements(read('docs/security/09_consolidated_read_only_review.sql'));
  const fkSource = read('docs/security/05_auth_user_fk_review.sql');
  const fk = fkSource.split('\n').filter(line => !line.trim().startsWith('--'))
    .join('\n').split(';').map(x => x.trim()).filter(Boolean);
  const migration = readMigrationFiles({ migrationsFolder: resolve(root, 'docs/security/generated/staging-baseline') });
  const journal = JSON.parse(read('docs/security/generated/staging-baseline/meta/_journal.json'));
  const originalJournal = JSON.parse(read('drizzle/meta/_journal.json'));
  requireTrue(foundation.length === 55 && security.length === 35 && fk.length === 1,
    'Statement inventory changed');
  requireTrue(/^ALTER TABLE public\.school_users\s+ADD CONSTRAINT/i.test(fk[0]) &&
    /REFERENCES auth\.users\s*\(id\)/i.test(fk[0]), 'Auth FK changed');
  requireTrue(security.filter(x => /^CREATE POLICY\b/i.test(x)).length === 7 &&
    security.filter(x => /FORCE ROW LEVEL SECURITY/i.test(x)).length === 12,
    'Security policy/RLS inventory changed');
  requireTrue(security.some(x => /^REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated/i.test(x)) &&
    security.some(x => /^REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated/i.test(x)),
    'Browser privilege revocations missing');
  requireTrue(migration.length === 1 && migration[0].sql.length === 55 &&
    migration[0].hash === expectedHash && migration[0].folderMillis === 1791835666087,
    'Drizzle migration metadata changed');
  requireTrue(JSON.stringify(journal) === JSON.stringify(originalJournal), 'Drizzle journal differs');
  const assertions = securityAssertionSql();
  requireTrue(assertions.includes('public_functions_ok') && assertions.includes('can_maintain') &&
    assertions.includes('has_table_privilege') && assertions.includes('has_column_privilege') &&
    assertions.includes('has_sequence_privilege') &&
    assertions.includes('required_table_reads_ok') &&
    assertions.includes('required_student_columns_ok'), 'Effective privilege assertions incomplete');
  // Deliberately ensure a failing assertion row cannot be treated as approved.
  let rejected = false;
  try { assertSecurityRow({}); } catch { rejected = true; }
  requireTrue(rejected, 'Security assertion gate does not fail closed');
  return {
    mode: 'PHASE4F17_OFFLINE_DEPLOYMENT_GATE',
    targetProjectRef: 'hweoqkbgmzycyznrbvng',
    foundationStatements: foundation.length,
    authForeignKeyStatements: fk.length,
    securityStatements: security.length,
    baselineSha256: expectedHash,
    journalMetadataMatches: true,
    publicFunctionAndMaintainAssertionsPresent: true,
    securityAssertionFailClosed: true,
    offlinePackagePassed: true,
    blockers: [
      'No independently approved and tested remote deployment runner',
      'Backup/recovery limitations and risk acceptance unresolved',
      'Supabase effective privilege and real JWT/PostgREST integration tests pending',
      'No explicit authorization for exact staging deployment revision'
    ],
    deploymentAuthorized: false,
    executionEnabled: false,
    remoteConnectionsMade: false
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireTrue(process.argv.length === 3 && process.argv[2] === '--offline-review',
      'Only --offline-review is supported');
    console.log(JSON.stringify(validateOfflinePackage(), null, 2));
  } catch (error) {
    console.error('Offline deployment gate refused:', String(error.message).slice(0, 220));
    process.exitCode = 1;
  }
}
