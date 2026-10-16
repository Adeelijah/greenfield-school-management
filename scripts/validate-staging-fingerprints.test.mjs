import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  validateStatementFingerprints
} from './validate-staging-deployment-offline.mjs';

const sha = value =>
  createHash('sha256').update(value).digest('hex');

const foundation = ['CREATE TABLE public.example (id integer)'];
const fk = 'ALTER TABLE public.example ADD CONSTRAINT example_fk CHECK (id > 0)';
const security = ['ALTER TABLE public.example ENABLE ROW LEVEL SECURITY'];
const assertions = 'SELECT true AS security_ok';

function validInventory() {
  return {
    statementInventory: [
      { stage: 'foundation', ordinal: 1, sha256: sha(foundation[0]) },
      { stage: 'auth_foreign_key', ordinal: 1, sha256: sha(fk) },
      { stage: 'security', ordinal: 1, sha256: sha(security[0]) },
      {
        stage: 'effective_privilege_assertions',
        ordinal: 1,
        sha256: sha(assertions)
      }
    ]
  };
}

function validate(inventory) {
  return validateStatementFingerprints(
    inventory,
    foundation,
    fk,
    security,
    assertions
  );
}

test('accepts correct statement fingerprints', () => {
  assert.equal(validate(validInventory()), 4);
});

for (const [stage, index] of [
  ['foundation', 0],
  ['auth_foreign_key', 1],
  ['security', 2],
  ['effective_privilege_assertions', 3]
]) {
  test(`rejects tampered ${stage} fingerprint`, () => {
    const inventory = validInventory();
    inventory.statementInventory[index].sha256 = '0'.repeat(64);

    assert.throws(
      () => validate(inventory),
      new RegExp(`fingerprint mismatch at entry ${index + 1}`)
    );
  });
}

test('rejects missing inventory entries', () => {
  const inventory = validInventory();
  inventory.statementInventory.pop();

  assert.throws(
    () => validate(inventory),
    /fingerprint count mismatch/
  );
});

test('rejects incorrect statement ordinal', () => {
  const inventory = validInventory();
  inventory.statementInventory[2].ordinal = 2;

  assert.throws(
    () => validate(inventory),
    /fingerprint mismatch at entry 3/
  );
});

test('rejects incorrect statement stage', () => {
  const inventory = validInventory();
  inventory.statementInventory[2].stage = 'foundation';

  assert.throws(
    () => validate(inventory),
    /fingerprint mismatch at entry 3/
  );
});