import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOrderedFoundation, splitStatements } from './prepare-foundation-ordering-preview.mjs';

const source = readFileSync(resolve('drizzle/0000_broad_slayback.sql'), 'utf8');

test('ordering preview preserves all foundation SQL statements exactly', () => {
  const { sql, report } = buildOrderedFoundation(source);
  const original = splitStatements(source);
  const generated = splitStatements(sql).map(s => s.replace(/^-- REVIEW-ONLY GENERATED FOUNDATION ORDERING\. DO NOT EXECUTE OR USE AS DRIZZLE MIGRATION\.\n-- No database changes; original drizzle\/0000 remains unchanged\.\n/, ''));
  assert.deepEqual([...generated].sort(), [...original].sort());
  assert.equal(report.executableApproval, false);
});

test('unique indexes precede all composite foreign keys', () => {
  const { sql } = buildOrderedFoundation(source);
  const statements = splitStatements(sql);
  const firstFk = statements.findIndex(s => /^ALTER TABLE\b/.test(s));
  const lastIndex = statements.reduce((i, s, n) => /^CREATE (?:UNIQUE )?INDEX\b/.test(s) ? n : i, -1);
  assert.ok(lastIndex < firstFk);
});

test('refuses unexpected SQL additions rather than silently discarding them', () => {
  assert.throws(() => buildOrderedFoundation(source + '\nDROP TABLE schools;'), /Unexpected foundation statement inventory/);
});

test('rejects SQL hidden after an existing statement without a breakpoint', () => {
  assert.throws(() => buildOrderedFoundation(source + '\nGRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC;'), /Unexpected foundation statement inventory/);
});

test('rejects a statement missing its terminator', () => {
  assert.throws(() => buildOrderedFoundation(source.replace(/;\s*$/, '')), /Unexpected foundation statement inventory/);
});
