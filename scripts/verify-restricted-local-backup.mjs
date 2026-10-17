import { prepareRestrictedLocalBackup } from './prepare-restricted-local-backup.mjs';
import { verifyLocalPgDump } from './verify-local-pg-dump.mjs';

export async function verifyRestrictedLocalBackup(parentEnv, archiveName) {
  const plan = prepareRestrictedLocalBackup(parentEnv, archiveName);

  if (plan.executionAuthorized !== false ||
      plan.remoteConnectionsAllowed !== false) {
    throw new Error('Restricted backup plan must remain disabled');
  }

  const executableVerification = await verifyLocalPgDump(
    plan.executable
  );

  return {
    ...plan,
    executableVerified: executableVerification.verified,
    executableSha256: executableVerification.sha256,
    executionAuthorized: false
  };
}
