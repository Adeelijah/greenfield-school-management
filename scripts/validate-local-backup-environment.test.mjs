import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateLocalBackupEnvironment,
  FORBIDDEN_VARIABLES
} from './validate-local-backup-environment.mjs';

test('accepts an empty environment', () => {
  assert.deepEqual(validateLocalBackupEnvironment({}), {
    safe: true,
    checkedVariables: FORBIDDEN_VARIABLES.length
  });
});

test('accepts unrelated environment variables', () => {
  const result = validateLocalBackupEnvironment({
    PATH: '/usr/bin',
    NODE_ENV: 'test'
  });

  assert.equal(result.safe, true);
});

test('rejects missing environment object', () => {
  assert.throws(
    () => validateLocalBackupEnvironment(undefined),
    /Explicit environment object required/
  );
});

test('rejects null environment', () => {
  assert.throws(
    () => validateLocalBackupEnvironment(null),
    /Explicit environment object required/
  );
});

for (const name of FORBIDDEN_VARIABLES) {
  test(`rejects inherited ${name}`, () => {
    assert.throws(
      () => validateLocalBackupEnvironment({
        [name]: 'test-value'
      }),
      new RegExp(name)
    );
  });
}

test('rejects even empty PostgreSQL variables', () => {
  assert.throws(
    () => validateLocalBackupEnvironment({
      PGHOST: ''
    }),
    /PGHOST/
  );
});

test('reports multiple prohibited variables', () => {
  assert.throws(
    () => validateLocalBackupEnvironment({
      PGHOST: 'example.com',
      PGPASSWORD: 'placeholder'
    }),
    error =>
      error.message.includes('PGHOST') &&
      error.message.includes('PGPASSWORD') &&
      !error.message.includes('placeholder')
  );
});