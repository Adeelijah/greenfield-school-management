import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildOrderedFoundation, splitStatements } from './prepare-foundation-ordering-preview.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'drizzle/0000_broad_slayback.sql'), 'utf8');
const journal = readFileSync(resolve(root, 'drizzle/meta/_journal.json'), 'utf8');
const snapshot = readFileSync(resolve(root, 'drizzle/meta/0000_snapshot.json'), 'utf8');
const original = splitStatements(source);
const { sql, report } = buildOrderedFoundation(source);
const corrected = splitStatements(sql).map((s, i) => i === 0 ? s.replace(/^-- REVIEW-ONLY GENERATED FOUNDATION ORDERING[^\n]*\n-- No database changes[^\n]*\n/, '') : s);
if (original.length !== 55 || corrected.length !== 55) throw new Error('Unexpected statement inventory');
const signature = statements => statements.map(s => createHash('sha256').update(s.trim()).digest('hex')).sort().join('\n');
if (signature(original) !== signature(corrected)) throw new Error('Statement inventory mismatch');
const parsedJournal = JSON.parse(journal);
if (parsedJournal.entries?.length !== 1 || parsedJournal.entries[0].tag !== '0000_broad_slayback') throw new Error('Unexpected journal');
const parsedSnapshot = JSON.parse(snapshot);
if (parsedSnapshot.version !== '7' || parsedSnapshot.dialect !== 'postgresql') throw new Error('Unexpected snapshot');
const baseline = corrected.join('\n--> statement-breakpoint\n') + '\n';
const sha256 = text => createHash('sha256').update(text).digest('hex');
const result = {
  mode: 'PHASE4F_STAGING_BASELINE_PREVIEW',
  originalSha256: sha256(source),
  stagingBaselineSha256: sha256(baseline),
  statementCount: corrected.length,
  inventoryPreserved: true,
  journalTag: parsedJournal.entries[0].tag,
  readyToApply: false,
  note: 'Local file preparation only. Not approved for staging execution; migration runner and security rollout require review.'
};
if (process.argv.includes('--write-staging-preview')) {
  const dir = resolve(root, 'docs/security/generated/staging-baseline');
  mkdirSync(resolve(dir, 'meta'), { recursive: true });
  writeFileSync(resolve(dir, '0000_broad_slayback.sql'), baseline);
  writeFileSync(resolve(dir, 'meta/_journal.json'), journal);
  writeFileSync(resolve(dir, 'meta/0000_snapshot.json'), snapshot);
  result.previewPath = 'docs/security/generated/staging-baseline';
}
console.log(JSON.stringify(result, null, 2));
