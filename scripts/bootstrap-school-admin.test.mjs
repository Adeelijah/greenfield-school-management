import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const script = new URL('./bootstrap-school-admin.mjs', import.meta.url);
const source = readFileSync(script, 'utf8');

test('bootstrap does not implement writes or transaction yet', () => {
  assert.doesNotMatch(source, /\bINSERT\s+INTO\b|\bUPDATE\s+public\.|\bDELETE\s+FROM\b/i);
  assert.match(source, /execution is not implemented/);
});

test('execute flag is explicitly refused without a DB connection', () => {
  const result = spawnSync(process.execPath, [script.pathname, '--execute'], { encoding: 'utf8', env: { ...process.env, MIGRATION_DATABASE_URL: '' } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /execution is not implemented/);
});

test('missing arguments are refused', () => {
  const result = spawnSync(process.execPath, [script.pathname], { encoding: 'utf8', env: { ...process.env, MIGRATION_DATABASE_URL: '' } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
});
