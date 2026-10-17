import { buildLocalBackupCommand } from './build-local-backup-command.mjs';

export function planEncryptedLocalBackup(databaseUrl, archivePath) {
  if (typeof archivePath !== 'string' ||
      !/^backups\/[A-Za-z0-9][A-Za-z0-9_-]*\.gfbk$/.test(archivePath)) {
    throw new Error('Encrypted archive must be a safe .gfbk path inside backups/');
  }

  const command = buildLocalBackupCommand(
    databaseUrl,
    'backups/temporary.dump'
  );

  const fileIndex = command.args.indexOf('--file');

  if (fileIndex === -1) {
    throw new Error('Expected pg_dump output argument missing');
  }

  // A future execution runner will use stdout as the encryption input.
  // No plaintext dump file should be created.
  const args = command.args.filter(
    (_, index) => index !== fileIndex && index !== fileIndex + 1
  );

  return {
    mode: 'LOCAL_ENCRYPTED_BACKUP_PLAN',
    executionAuthorized: false,
    database: 'greenfield_disposable_backup_source',
    executable: command.executable,
    args,
    archivePath,
    encryption: 'AES-256-GCM',
    plaintextIntermediateFile: false,
    remoteConnectionsAllowed: false
  };
}
