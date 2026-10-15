import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectFoundationStatements } from './validate-isolated-foundation.mjs';
import { securityStatements } from './validate-isolated-security.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');
const path = 'docs/security/generated/staging-baseline/0000_broad_slayback.sql';
const expected = 'c8f61c5f702ae6ebad9cc2950edb1d4a288eb2a2613281cdc612167b711cba62';

function assert(ok, message) { if (!ok) throw new Error(message); }
function main() {
  assert(process.argv.includes('--review-only'), 'Explicit --review-only required');
  assert(existsSync(resolve(root, path)), 'Generate local baseline preview first; no deployment performed');
  const original = read('drizzle/0000_broad_slayback.sql');
  const generated = read(path);
  const journal = JSON.parse(read('docs/security/generated/staging-baseline/meta/_journal.json'));
  const baseline = inspectFoundationStatements(original);
  const security = securityStatements(read('docs/security/09_consolidated_read_only_review.sql'));
  const authFk = read('docs/security/05_auth_user_fk_review.sql');
  const originalJournal = JSON.parse(read('drizzle/meta/_journal.json'));
  assert(sha(generated) === expected, 'Generated foundation SHA256 mismatch');
  assert(baseline.statements.length === 55 && security.length === 35, 'SQL inventory mismatch');
  assert(journal.entries?.length === 1 && journal.entries[0].tag === '0000_broad_slayback',
    'Generated journal mismatch');
  assert(JSON.stringify(journal) === JSON.stringify(originalJournal), 'Journal metadata changed');
  assert(/REFERENCES auth\.users\s*\(id\)/i.test(authFk), 'Expected Supabase Auth FK missing');
  assert(security.filter(s => /^ALTER TABLE .* FORCE ROW LEVEL SECURITY/i.test(s)).length === 12,
    'Expected FORCE RLS inventory missing');
  assert(security.filter(s => /^CREATE POLICY/i.test(s)).length === 7, 'Expected policy inventory missing');
  assert(security.some(s => /^REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated/i.test(s)),
    'Table revocation missing');
  assert(security.some(s => /^REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated/i.test(s)),
    'Sequence revocation missing');
  console.log(JSON.stringify({
    mode: 'PHASE4F8_OFFLINE_PACKAGE_REVIEW',
    foundationStatements: 55, securityStatements: 35,
    forceRlsStatements: 12, policies: 7,
    generatedBaselineSha256: sha(generated),
    journalMetadataMatches: true,
    authForeignKeyPresent: true,
    reviewPassed: true,
    deployable: false,
    reasons: [
      'No remote execution code is included',
      'Supabase effective PUBLIC/inherited grants and function exposure require further checks',
      'No staging JWT/PostgREST integration tests yet',
      'No explicit operator approval for staging writes'
    ],
    remoteConnectionsMade: false
  }, null, 2));
}
try { main(); } catch (error) {
  console.error('Offline package review failed:', error.message);
  process.exitCode = 1;
}
