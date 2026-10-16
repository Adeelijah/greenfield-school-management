import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLocalBackupProcessEnv
} from './build-local-backup-process-env.mjs';

const clean = {
  SystemRoot: 'C:\\Windows',
  PATH: 'C:\\Untrusted',
  NODE_ENV: 'development',
  DATABASE_URL: 'not-forwarded',
  MIGRATION_DATABASE_URL: 'also-not-forwarded'
};

test('constructs an explicit minimal environment', () => {
  const result = buildLocalBackupProcessEnv(clean);

  assert.equal(result.PGCONNECT_TIMEOUT, '5');
  assert.equal(result.PGSSLMODE, 'disable');
  assert.equal(result.PGPASSFILE, 'NUL');

  assert.equal(Object.hasOwn(result, 'PATH'), false);
  assert.equal(Object.hasOwn(result, 'NODE_ENV'), false);
  assert.equal(Object.hasOwn(result, 'DATABASE_URL'), false);
  assert.equal(
    Object.hasOwn(result, 'MIGRATION_DATABASE_URL'),
    false
  );

  if (process.platform === 'win32') {
    assert.equal(result.SystemRoot, 'C:\\Windows');
  }
});

test('rejects missing parent environment', () => {
  assert.throws(
    () => buildLocalBackupProcessEnv(undefined),
    /Explicit parent environment required/
  );
});

test('rejects inherited PostgreSQL host override', () => {
  assert.throws(
    () => buildLocalBackupProcessEnv({
      ...clean,
      PGHOST: 'remote.example.com'
    }),
    /PGHOST/
  );
});

test('rejects inherited PostgreSQL password', () => {
  assert.throws(
    () => buildLocalBackupProcessEnv({
      ...clean,
      PGPASSWORD: 'placeholder'
    }),
    /PGPASSWORD/
  );
});

test('rejects inherited PostgreSQL service file', () => {
  assert.throws(
    () => buildLocalBackupProcessEnv({
      ...clean,
      PGSERVICEFILE: 'untrusted.conf'
    }),
    /PGSERVICEFILE/
  );
});

test('does not mutate the parent environment', () => {
  const parent = { ...clean };
  const before = { ...parent };

  buildLocalBackupProcessEnv(parent);

  assert.deepEqual(parent, before);
});

test('rejects unexpected Windows SystemRoot', () => {
  if (process.platform !== 'win32') return;

  assert.throws(
    () => buildLocalBackupProcessEnv({
      SystemRoot: 'C:\\Untrusted'
    }),
    /Expected Windows SystemRoot/
  );
});