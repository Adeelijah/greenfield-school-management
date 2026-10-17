import { open, unlink } from 'node:fs/promises';
import { encryptSyntheticStream } from './local-backup-stream-crypto.mjs';

export async function writeEncryptedArchive(readable, outputPath, password) {
  if (typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new Error('Explicit encrypted archive output path required');
  }

  if (!readable || typeof readable.pipe !== 'function') {
    throw new Error('Readable input stream required');
  }

  if (typeof password !== 'string' || password.length < 16) {
    throw new Error('Encryption password must contain at least 16 characters');
  }

  let handle;
  let created = false;

  try {
    handle = await open(outputPath, 'wx', 0o600);
    created = true;

    // The stream owns and closes the file descriptor when finished.
    const output = handle.createWriteStream({
      autoClose: true
    });

    await encryptSyntheticStream(readable, output, password);

    return {
      encrypted: true,
      outputPath,
      format: 'GFBK',
      version: 1
    };
  } catch (error) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // Preserve the original failure.
      }
    }

    if (created) {
      try {
        await unlink(outputPath);
      } catch (cleanupError) {
        if (cleanupError?.code !== 'ENOENT') {
          throw new AggregateError(
            [error, cleanupError],
            'Encryption failed and partial archive cleanup also failed'
          );
        }
      }
    }

    throw error;
  }
}
