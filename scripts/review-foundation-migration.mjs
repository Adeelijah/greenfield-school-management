import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migration = readFileSync(resolve(root, 'drizzle/0000_broad_slayback.sql'), 'utf8');
const journal = JSON.parse(readFileSync(resolve(root, 'drizzle/meta/_journal.json'), 'utf8'));

export function reviewFoundationSql(sql, journalData) {
  const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);
  const firstCompositeFk = statements.findIndex(s => /ALTER TABLE .*ADD CONSTRAINT.*FOREIGN KEY \("school_id","(?:requested_class_id|student_id|class_id|session_id|guardian_id)"\)/s.test(s));
  const lastCompositeUniqueIndex = statements.reduce((last, s, i) =>
    /CREATE UNIQUE INDEX "(?:sessions_school_id_id_unique|classes_school_id_id_unique|guardians_school_id_id_unique|students_school_id_id_unique)"/.test(s) ? i : last, -1);
  const required = [
    'sessions_school_id_id_unique', 'classes_school_id_id_unique',
    'guardians_school_id_id_unique', 'students_school_id_id_unique',
  ];
  const missingIndexes = required.filter(name => !sql.includes('CREATE UNIQUE INDEX "' + name + '"'));
  const compositeFkBeforeUniqueIndexes = firstCompositeFk >= 0 && lastCompositeUniqueIndex > firstCompositeFk;
  const journalHasFoundation = Array.isArray(journalData.entries) && journalData.entries.some(e => e.tag === '0000_broad_slayback');
  return {
    mode: 'STATIC_FOUNDATION_MIGRATION_REVIEW',
    journalHasFoundation,
    statementCount: statements.length,
    missingIndexes,
    compositeFkBeforeUniqueIndexes,
    readyToApply: journalHasFoundation && !compositeFkBeforeUniqueIndexes && missingIndexes.length === 0,
    note: 'Static analysis only. No SQL executed. Original migration must remain immutable; plan a reviewed corrective migration strategy before deployment.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(reviewFoundationSql(migration, journal), null, 2));
}
