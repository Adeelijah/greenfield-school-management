import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreflightMetadata } from './validate-staging-preflight-offline.mjs';

const validManifest = () => ({
  targetProjectRef: 'hweoqkbgmzycyznrbvng',
  targetProjectName: 'greenfield-staging',
  expectedDatabaseName: 'postgres',
  noExecutableSql: true,
  noNetworkConnections: true,
  deploymentAuthorized: false
});

const validInventory = () => ({
  targetProjectRef: 'hweoqkbgmzycyznrbvng',
  expectedDatabase: 'postgres',
  executionEnabled: false,
  remoteConnectionsMade: false,
  deploymentAuthorized: false,
  projectIdentityStatus: 'OPERATOR VERIFICATION REQUIRED',
  backupAndRecoveryStatus: 'NOT APPROVED',
  securityAssertionsStatus: 'OFFLINE_INVENTORIED_NOT_REMOTE_TESTED'
});

test('accepts valid offline metadata without authorizing deployment', () => {
  const result = validatePreflightMetadata(
    validManifest(),
    validInventory()
  );

  assert.equal(result.identityVerifiedRemotely, false);
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.remoteConnectionsMade, false);
});

test('rejects incorrect staging project reference', () => {
  const manifest = validManifest();
  manifest.targetProjectRef = 'incorrect-project';

  assert.throws(
    () => validatePreflightMetadata(manifest, validInventory()),
    /Staging manifest identity mismatch/
  );
});

test('rejects incorrect database name', () => {
  const inventory = validInventory();
  inventory.expectedDatabase = 'production';

  assert.throws(
    () => validatePreflightMetadata(validManifest(), inventory),
    /Transaction inventory identity mismatch/
  );
});

test('rejects deployment authorization in manifest', () => {
  const manifest = validManifest();
  manifest.deploymentAuthorized = true;

  assert.throws(
    () => validatePreflightMetadata(manifest, validInventory()),
    /Unsafe staging authorization metadata/
  );
});

test('rejects enabled transaction execution', () => {
  const inventory = validInventory();
  inventory.executionEnabled = true;

  assert.throws(
    () => validatePreflightMetadata(validManifest(), inventory),
    /Unsafe staging authorization metadata/
  );
});

test('rejects claimed remote identity verification', () => {
  const inventory = validInventory();
  inventory.projectIdentityStatus = 'VERIFIED';

  assert.throws(
    () => validatePreflightMetadata(validManifest(), inventory),
    /Unexpected staging readiness status/
  );
});

test('rejects missing safety metadata', () => {
  const manifest = validManifest();
  delete manifest.noNetworkConnections;

  assert.throws(
    () => validatePreflightMetadata(manifest, validInventory()),
    /Unsafe staging authorization metadata/
  );
});