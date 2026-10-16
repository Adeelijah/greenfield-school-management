import { validateLocalBackupTarget } from './validate-local-backup-target.mjs';

export function buildLocalBackupCommand(databaseUrl, outputPath) {
  const target = validateLocalBackupTarget(databaseUrl);

  if (typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new Error('Explicit backup output path required');
  }

  if (!/^backups\/[A-Za-z0-9][A-Za-z0-9_-]*\.dump$/.test(outputPath)) {
    throw new Error('Backup output must be a safe .dump path inside backups/');
  }

  return {
    executionAuthorized: false,
    securityStatus: 'BLOCKED_PENDING_ENCRYPTION_AND_FILESYSTEM_CHECKS',
    executable: 'pg_dump',
    args: [
      '--host', target.host,
      '--port', target.port,
      '--username', target.username,
      '--dbname', target.database,
      '--format', 'custom',
      '--no-owner',
      '--no-acl',
      '--file', outputPath
    ]
  };
}