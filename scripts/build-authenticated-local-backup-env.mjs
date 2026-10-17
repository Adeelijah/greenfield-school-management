import { join, resolve, win32 } from 'node:path';
import { buildLocalBackupProcessEnv } from './build-local-backup-process-env.mjs';

export function buildAuthenticatedLocalBackupEnv(parentEnv) {
  const base = buildLocalBackupProcessEnv(parentEnv);

  if (process.platform !== 'win32') {
    throw new Error('Authenticated local backup currently supports Windows only');
  }

  const localAppData = parentEnv.LOCALAPPDATA;
  if (typeof localAppData !== 'string' ||
      !win32.isAbsolute(localAppData)) {
    throw new Error('Expected absolute Windows LOCALAPPDATA path required');
  }

  const credentialFile = resolve(
    join(localAppData, 'Greenfield', 'postgres-credentials', 'pgpass.conf')
  );

  return {
    ...base,
    PGPASSFILE: credentialFile
  };
}
