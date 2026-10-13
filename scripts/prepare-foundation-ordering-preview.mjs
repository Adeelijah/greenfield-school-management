import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'drizzle/0000_broad_slayback.sql');
const outputPath = resolve(root, 'docs/security/generated/foundation-ordering-review.sql');

export function splitStatements(source) {
  return source.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);
}

export function buildOrderedFoundation(source) {
  const statements = splitStatements(source);
  // Foundation SQL has one statement per breakpoint. Reject embedded or trailing SQL
  // even when it is appended after a valid statement's final semicolon.
  for (const statement of statements) {
    const withoutComments = statement.replace(/^\s*--[^\n]*(?:\n|$)/gm, '').trim();
    if (!/;\s*$/.test(withoutComments) || (withoutComments.match(/;/g) ?? []).length !== 1) {
      throw new Error('Unexpected foundation statement inventory; refusing to produce reordered SQL');
    }
  }
  const tables = statements.filter(s => /^CREATE TABLE\b/.test(s));
  const types = statements.filter(s => /^CREATE TYPE\b/.test(s));
  const indexes = statements.filter(s => /^CREATE (?:UNIQUE )?INDEX\b/.test(s));
  const foreignKeys = statements.filter(s => /^ALTER TABLE\b.*\bADD CONSTRAINT\b.*\bFOREIGN KEY\b/s.test(s));
  if (types.length !== 4 || tables.length !== 12 || indexes.length !== 19 || foreignKeys.length !== 20 ||
      types.length + tables.length + indexes.length + foreignKeys.length !== statements.length) {
    throw new Error('Unexpected foundation statement inventory; refusing to produce reordered SQL');
  }
  const reordered = [...types, ...tables, ...indexes, ...foreignKeys];
  if (new Set(reordered).size !== reordered.length) throw new Error('Duplicate SQL statements found');
  const sql = '-- REVIEW-ONLY GENERATED FOUNDATION ORDERING. DO NOT EXECUTE OR USE AS DRIZZLE MIGRATION.\n' +
    '-- No database changes; original drizzle/0000 remains unchanged.\n' +
    reordered.join('\n--> statement-breakpoint\n') + '\n';
  return {
    sql,
    report: {
      mode: 'STATIC_ORDERED_FOUNDATION_PREVIEW',
      statementCount: statements.length,
      types: types.length,
      tables: tables.length,
      indexes: indexes.length,
      foreignKeys: foreignKeys.length,
      statementInventoryPreserved: true,
      executableApproval: false,
      note: 'Ordering-only preview; requires disposable PostgreSQL execution and migration journal strategy review.',
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { sql, report } = buildOrderedFoundation(readFileSync(sourcePath, 'utf8'));
  if (process.argv.includes('--write-preview')) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, sql);
    console.log(JSON.stringify({ ...report, previewPath: 'docs/security/generated/foundation-ordering-review.sql' }, null, 2));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}
