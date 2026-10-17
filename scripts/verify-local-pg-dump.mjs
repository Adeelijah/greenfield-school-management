import { createHash } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import { win32 } from 'node:path';

const EXPECTED_PATH =
  'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';

const EXPECTED_SHA256 =
  '9414DAC0554065AA6EDF739D7126B6E6E6D6FC3B56B9706B72CEE47CEE45B22C';

export async function verifyLocalPgDump(executable) {
  if (process.platform !== 'win32') {
    throw new Error('Windows-only PostgreSQL verification');
  }

  if (typeof executable !== 'string' ||
      win32.normalize(executable).toLowerCase() !==
      win32.normalize(EXPECTED_PATH).toLowerCase()) {
    throw new Error('Unexpected PostgreSQL executable path');
  }

  const info = await lstat(executable);

  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error('PostgreSQL executable must be a regular file');
  }

  const bytes = await readFile(executable);
  const actualHash = createHash('sha256')
    .update(bytes)
    .digest('hex')
    .toUpperCase();

  if (actualHash !== EXPECTED_SHA256) {
    throw new Error('PostgreSQL executable fingerprint mismatch');
  }

  return {
    verified: true,
    executable: EXPECTED_PATH,
    sha256: actualHash
  };
}
