import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { writeEncryptedArchive } from './write-encrypted-local-archive.mjs';

export async function runEncryptedBackupProcess({
  executable,
  args,
  env,
  outputPath,
  password
}) {
  if (typeof executable !== 'string' || !executable.trim()) {
    throw new Error('Explicit executable required');
  }

  if (!Array.isArray(args) || !args.every(arg => typeof arg === 'string')) {
    throw new Error('Explicit process arguments required');
  }

  if (!env || typeof env !== 'object') {
    throw new Error('Explicit process environment required');
  }

  if (typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new Error('Explicit archive destination required');
  }

  if (typeof password !== 'string' || !password) {
    throw new Error('Encryption password required');
  }

  // Low-level adapter only. Caller must enforce target verification,
  // executable verification, filesystem restrictions, and authorization.
  const child = spawn(executable, args, {
    env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stderr.resume();

  const processResult = new Promise(resolve => {
    let startError = false;

    child.once('error', () => {
      startError = true;
    });

    child.once('close', (code, signal) => {
      resolve(!startError && code === 0 && signal === null);
    });
  });

  let archiveCreated = false;
  let processSucceeded = false;
  let archiveAttempted = false;

  try {
    archiveAttempted = true;
    await writeEncryptedArchive(child.stdout, outputPath, password);
    archiveCreated = true;

    processSucceeded = await processResult;

    if (!processSucceeded) {
      throw new Error('Backup process failed; encrypted archive rejected');
    }

    return {
      encrypted: true,
      processSucceeded: true,
      outputPath
    };
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
    }

    // Close stdout to release a child blocked on pipe output.
    child.stdout.destroy();

    // Wait for termination, but don't wait indefinitely.
    const closed = await Promise.race([
      processResult.then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), 5000))
    ]);

    if (!closed) {
      child.kill('SIGKILL');
      throw new AggregateError(
        [error],
        'Backup failed; child termination not confirmed. Inspect the process and archive manually.'
      );
    }

    if (archiveAttempted) {
      try {
        await unlink(outputPath);
      } catch (cleanupError) {
        if (cleanupError?.code !== 'ENOENT') {
          throw new AggregateError(
            [error, cleanupError],
            'Backup failed and archive cleanup failed'
          );
        }
      }
    }

    throw error;
  }
}
