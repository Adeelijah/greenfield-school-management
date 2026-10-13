import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDisposableTarget, inspectFoundationStatements } from './validate-isolated-foundation.mjs';

const source = readFileSync('drizzle/0000_broad_slayback.sql', 'utf8');
const local = 'postgresql://tester:password@127.0.0.1:5432/greenfield_disposable_validation';

test('rejects missing, remote and non-disposable database targets', () => {
  assert.throws(() => validateDisposableTarget({}), /required/);
  assert.throws(() => validateDisposableTarget({ GREENFIELD_DISPOSABLE_DATABASE_URL: 'postgresql://tester@db.project.supabase.co/greenfield_disposable_validation' }), /loopback/);
  assert.throws(() => validateDisposableTarget({ GREENFIELD_DISPOSABLE_DATABASE_URL: 'postgresql://tester@127.0.0.1/postgres' }), /greenfield_disposable_/);
});

test('refuses shared migration and application connection strings', () => {
  assert.throws(() => validateDisposableTarget({ GREENFIELD_DISPOSABLE_DATABASE_URL: local, DATABASE_URL: local }), /differ/);
  assert.throws(() => validateDisposableTarget({ GREENFIELD_DISPOSABLE_DATABASE_URL: local, MIGRATION_DATABASE_URL: local }), /differ/);
  assert.equal(validateDisposableTarget({ GREENFIELD_DISPOSABLE_DATABASE_URL: local }), local);
});

test('ordered baseline contains exactly 55 original SQL statements', () => {
  const { statements, report } = inspectFoundationStatements(source);
  assert.equal(statements.length, 55);
  assert.equal(report.statementInventoryPreserved, true);
  assert.ok(statements[0].startsWith('CREATE TYPE'));
  assert.ok(statements.every(s => s.trim().endsWith(';')));
});
