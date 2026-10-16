import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLocalBackupCommand
} from './build-local-backup-command.mjs';

const local =
  'postgresql://postgres@127.0.0.1:5432/greenfield_disposable_backup_source';

test('constructs explicit local pg_dump arguments', () => {
  const result = buildLocalBackupCommand(
    local,
    'backups/synthetic-test.dump'
  );

  assert.equal(result.executable, 'pg_dump');

  assert.deepEqual(result.args, [
    '--host', '127.0.0.1',
    '--port', '5432',
    '--username', 'postgres',
    '--dbname', 'greenfield_disposable_backup_source',
    '--format', 'custom',
    '--no-owner',
    '--no-acl',
    '--file', 'backups/synthetic-test.dump'
  ]);
});

test('does not include a password in command arguments', () => {
  const result = buildLocalBackupCommand(
    local,
    'backups/synthetic-test.dump'
  );

  assert.equal(result.args.some(arg => /password|secret/i.test(arg)), false);
});

test('rejects remote database targets', () => {
  assert.throws(
    () => buildLocalBackupCommand(
      'postgresql://postgres@db.example.supabase.co/greenfield_disposable_backup_source',
      'backups/test.dump'
    ),
    /Remote database targets are prohibited/
  );
});

test('rejects unexpected database names', () => {
  assert.throws(
    () => buildLocalBackupCommand(
      'postgresql://postgres@127.0.0.1:5432/postgres',
      'backups/test.dump'
    ),
    /Unexpected backup source database/
  );
});

test('rejects missing output path', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, ''),
    /Explicit backup output path required/
  );
});

test('rejects non-dump output extensions', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, 'backups/test.sql'),
    /Backup output must be a safe/
  );
});

test('rejects newline characters in output paths', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, 'backups/test\nother.dump'),
    /Backup output must be a safe/
  );
});

test('rejects null bytes in output paths', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, 'backups/test\0.dump'),
    /Backup output must be a safe/
  );
});
test('rejects path traversal', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, 'backups/../outside.dump'),
    /Backup output must be a safe/
  );
});

test('rejects absolute Windows paths', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, 'C:\\Temp\\backup.dump'),
    /Backup output must be a safe/
  );
});

test('rejects absolute Unix paths', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, '/tmp/backup.dump'),
    /Backup output must be a safe/
  );
});

test('rejects nested backup directories', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, 'backups/nested/test.dump'),
    /Backup output must be a safe/
  );
});

test('rejects filenames containing spaces', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, 'backups/my backup.dump'),
    /Backup output must be a safe/
  );
});

test('rejects Windows backslash paths', () => {
  assert.throws(
    () => buildLocalBackupCommand(local, 'backups\\test.dump'),
    /Backup output must be a safe/
  );
});

test('accepts a safe timestamped filename', () => {
  const result = buildLocalBackupCommand(
    local,
    'backups/greenfield_20261016_190000.dump'
  );

  assert.equal(
    result.args.at(-1),
    'backups/greenfield_20261016_190000.dump'
  );
});