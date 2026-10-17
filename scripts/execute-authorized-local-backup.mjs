import { verifyRestrictedLocalBackup } from './verify-restricted-local-backup.mjs';
import { runEncryptedBackupProcess } from './run-encrypted-backup-process.mjs';

export async function executeAuthorizedLocalBackup({
  parentEnv,
  archiveName,
  password,
  authorized = false
}) {
  if (authorized !== true) {
    throw new Error('Explicit local backup authorization required');
  }

  const plan = await verifyRestrictedLocalBackup(parentEnv, archiveName);

  if (
    !plan.executableVerified ||
    plan.executionAuthorized !== false ||
    plan.remoteConnectionsAllowed !== false ||
    plan.database !== 'greenfield_disposable_backup_source'
  ) {
    throw new Error('Restricted local backup preflight failed');
  }

  return runEncryptedBackupProcess({
    executable: plan.executable,
    args: plan.args,
    env: plan.env,
    outputPath: plan.outputPath,
    password
  });
}
