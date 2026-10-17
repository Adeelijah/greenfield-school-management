import { win32 } from 'node:path';
import { planEncryptedLocalBackup } from './plan-encrypted-local-backup.mjs';
import { buildAuthenticatedLocalBackupEnv } from './build-authenticated-local-backup-env.mjs';

const EXPECTED_PG_DUMP =
  'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';

const EXPECTED_DATABASE_URL =
  'postgresql://postgres@127.0.0.1:5432/greenfield_disposable_backup_source';

export function prepareRestrictedLocalBackup(parentEnv, archiveName) {
  if (process.platform !== 'win32') {
    throw new Error('Windows-only local backup runner');
  }

  if (typeof archiveName !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]*\.gfbk$/.test(archiveName)) {
    throw new Error('Invalid encrypted archive filename');
  }

  const plan = planEncryptedLocalBackup(
    EXPECTED_DATABASE_URL,
    `backups/${archiveName}`
  );

  const env = buildAuthenticatedLocalBackupEnv(parentEnv);

  const backupDirectory = win32.join(
    parentEnv.LOCALAPPDATA,
    'Greenfield',
    'encrypted-backups'
  );

  return {
    mode: 'RESTRICTED_LOCAL_BACKUP_PREFLIGHT',
    executionAuthorized: false,
    executable: EXPECTED_PG_DUMP,
    args: plan.args,
    env,
    outputPath: win32.join(backupDirectory, archiveName),
    database: plan.database,
    encryption: plan.encryption,
    remoteConnectionsAllowed: false
  };
}
