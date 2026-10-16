const EXPECTED_DATABASE = 'greenfield_disposable_backup_source';

export function validateLocalBackupTarget(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Explicit local backup database URL required');
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid backup database URL');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('PostgreSQL URL required');
  }

  if (url.hostname !== '127.0.0.1') {
    throw new Error('Remote database targets are prohibited');
  }

  if (url.port && url.port !== '5432') {
    throw new Error('Unexpected PostgreSQL port');
  }

  if (decodeURIComponent(url.pathname.slice(1)) !== EXPECTED_DATABASE) {
    throw new Error('Unexpected backup source database');
  }

  if (url.search || url.hash) {
    throw new Error('URL parameters and fragments are prohibited');
  }

  if (decodeURIComponent(url.username) !== 'postgres') {
    throw new Error('Exact local postgres username required');
  }

  if (url.password) {
    throw new Error('Embedded database passwords are prohibited');
  }

  return {
    host: url.hostname,
    port: url.port || '5432',
    database: EXPECTED_DATABASE,
    username: decodeURIComponent(url.username)
  };
}