import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateLocalBackupTarget
} from './validate-local-backup-target.mjs';

const local =
  'postgresql://postgres@127.0.0.1:5432/greenfield_disposable_backup_source';

test('accepts the exact local backup source', () => {
  const result = validateLocalBackupTarget(local);

  assert.deepEqual(result, {
    host: '127.0.0.1',
    port: '5432',
    database: 'greenfield_disposable_backup_source',
    username: 'postgres'
  });
});

test('accepts postgres protocol and default port', () => {
  const result = validateLocalBackupTarget(
    'postgres://postgres@127.0.0.1/greenfield_disposable_backup_source'
  );

  assert.equal(result.port, '5432');
});

const rejected = [
  ['unexpected database username',
    'postgresql://admin@127.0.0.1:5432/greenfield_disposable_backup_source'],
  ['embedded database password',
    'postgresql://postgres:secret@127.0.0.1:5432/greenfield_disposable_backup_source'],
  ['missing URL', undefined],
  ['empty URL', ''],
  ['malformed URL', 'not-a-database-url'],
  ['remote Supabase host',
    'postgresql://postgres@db.example.supabase.co/greenfield_disposable_backup_source'],
  ['localhost hostname',
    'postgresql://postgres@localhost:5432/greenfield_disposable_backup_source'],
  ['unexpected port',
    'postgresql://postgres@127.0.0.1:5433/greenfield_disposable_backup_source'],
  ['wrong database',
    'postgresql://postgres@127.0.0.1:5432/postgres'],
  ['URL query parameters', local + '?sslmode=require'],
  ['URL fragment', local + '#other'],
  ['missing username',
    'postgresql://127.0.0.1:5432/greenfield_disposable_backup_source'],
  ['non-PostgreSQL protocol',
    'https://postgres@127.0.0.1:5432/greenfield_disposable_backup_source']
];

for (const [name, value] of rejected) {
  test(`rejects ${name}`, () => {
    assert.throws(() => validateLocalBackupTarget(value));
  });
}