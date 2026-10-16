import { validateLocalBackupEnvironment } from './validate-local-backup-environment.mjs';

export function buildLocalBackupProcessEnv(parentEnv) {
  if (!parentEnv || typeof parentEnv !== 'object') {
    throw new Error('Explicit parent environment required');
  }

  validateLocalBackupEnvironment(parentEnv);

  const result = {
    PGCONNECT_TIMEOUT: '5',
    PGSSLMODE: 'disable',
    PGPASSFILE: 'NUL'
  };

  // Windows requires SystemRoot for some child processes.
  // Do not forward arbitrary parent environment variables.
  if (process.platform === 'win32') {
    const systemRoot = parentEnv.SystemRoot ?? parentEnv.SYSTEMROOT;

    if (typeof systemRoot !== 'string' ||
        !/^[A-Za-z]:\\Windows\\?$/i.test(systemRoot)) {
      throw new Error('Expected Windows SystemRoot required');
    }

    result.SystemRoot = systemRoot;
  }

  return result;
}