import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOfflinePackage } from './validate-staging-deployment-offline.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

const EXPECTED_MANIFEST_SHA256 = '04573c148ef0e8d7d3fd215cae09c738ceb64a11c7898c70d3ca716117ded0e2';
const EXPECTED_PROJECT_REF = 'hweoqkbgmzycyznrbvng';
const EXPECTED_PROJECT_NAME = 'greenfield-staging';
const EXPECTED_DATABASE = 'postgres';

function requireTrue(condition, message) {
  if (!condition) throw new Error(message);
}

export function validatePreflightMetadata(manifest, inventory) {
  requireTrue(
    manifest?.targetProjectRef === EXPECTED_PROJECT_REF &&
    manifest?.targetProjectName === EXPECTED_PROJECT_NAME &&
    manifest?.expectedDatabaseName === EXPECTED_DATABASE,
    'Staging manifest identity mismatch'
  );

  requireTrue(
    inventory?.targetProjectRef === EXPECTED_PROJECT_REF &&
    inventory?.expectedDatabase === EXPECTED_DATABASE,
    'Transaction inventory identity mismatch'
  );

  requireTrue(
    manifest.noExecutableSql === true &&
    manifest.noNetworkConnections === true &&
    manifest.deploymentAuthorized === false &&
    inventory.executionEnabled === false &&
    inventory.remoteConnectionsMade === false &&
    inventory.deploymentAuthorized === false,
    'Unsafe staging authorization metadata'
  );

  requireTrue(
    inventory.projectIdentityStatus === 'OPERATOR VERIFICATION REQUIRED' &&
    inventory.backupAndRecoveryStatus === 'NOT APPROVED' &&
    inventory.securityAssertionsStatus ===
      'OFFLINE_INVENTORIED_NOT_REMOTE_TESTED',
    'Unexpected staging readiness status'
  );

  return {
    targetProjectRef: EXPECTED_PROJECT_REF,
    targetProjectName: EXPECTED_PROJECT_NAME,
    expectedDatabase: EXPECTED_DATABASE,
    identityVerifiedRemotely: false,
    backupAndRecoveryApproved: false,
    deploymentAuthorized: false,
    remoteConnectionsMade: false
  };
}

export function validateStagingPreflightOffline() {
  const packageResult = validateOfflinePackage();

  requireTrue(
    packageResult.offlinePackagePassed === true &&
    packageResult.deploymentAuthorized === false &&
    packageResult.remoteConnectionsMade === false,
    'Existing offline deployment gate failed'
  );

  const manifestPath = resolve(
    root,
    'docs/security/generated/phase4f10-staging-deployment-manifest.json'
  );

  const manifestBytes = readFileSync(manifestPath);
  const manifestSha256 = createHash('sha256')
    .update(manifestBytes)
    .digest('hex');

  requireTrue(
    manifestSha256 === EXPECTED_MANIFEST_SHA256,
    'Staging manifest SHA-256 mismatch'
  );

  const manifest = JSON.parse(manifestBytes.toString('utf8'));

  const inventory = read(
    'docs/security/generated/phase4f11-transaction-inventory.json'
  );

  const metadata = validatePreflightMetadata(manifest, inventory);

  return {
    mode: 'PHASE4F24_OFFLINE_STAGING_PREFLIGHT',
    offlinePackagePassed: true,
    ...metadata,
    status: 'OFFLINE_ONLY_NOT_DEPLOYMENT_APPROVAL'
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireTrue(
      process.argv.length === 3 &&
      process.argv[2] === '--offline-preflight',
      'Only --offline-preflight is supported'
    );

    console.log(JSON.stringify(validateStagingPreflightOffline(), null, 2));
  } catch (error) {
    console.error(
      'Offline staging preflight refused:',
      String(error.message).slice(0, 220)
    );
    process.exitCode = 1;
  }
}