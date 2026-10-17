import {
  createDecipheriv,
  scrypt as scryptCallback,
} from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const MAGIC = Buffer.from('GFBK');
const VERSION = 1;
const SALT_LENGTH = 32;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + 1 + SALT_LENGTH + NONCE_LENGTH;

const KDF_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 16) {
    throw new Error('Decryption password must contain at least 16 characters');
  }
}

/**
 * Authenticates a GFBK v1 archive and writes its plaintext to a newly created
 * file. The output is untrusted and MUST NOT be consumed until this function
 * resolves successfully. On any failure, the partial output file is removed.
 *
 * The caller must provide a unique path in a private, access-controlled
 * temporary directory. `flags: 'wx'` prevents overwriting an existing path.
 */
export async function decryptArchiveToExclusiveFile(readable, outputPath, password) {
  validatePassword(password);

  if (!readable || typeof readable.pipe !== 'function') {
    throw new Error('Readable encrypted archive stream required');
  }
  if (typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new Error('Explicit temporary output path required');
  }

  let key;
  let header = Buffer.alloc(0);
  let tail = Buffer.alloc(0);
  let decipher;
  let authenticated = false;

  const decryptor = new Transform({
    transform(chunk, encoding, callback) {
      (async () => {
        let remaining = Buffer.from(chunk);

        if (!decipher) {
          const needed = HEADER_LENGTH - header.length;
          const take = Math.min(needed, remaining.length);
          header = Buffer.concat([header, remaining.subarray(0, take)]);
          remaining = remaining.subarray(take);

          if (header.length < HEADER_LENGTH) return;

          if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
            throw new Error('Invalid encrypted archive identifier');
          }
          if (header[MAGIC.length] !== VERSION) {
            throw new Error('Unsupported encrypted archive version');
          }

          const saltStart = MAGIC.length + 1;
          const salt = header.subarray(saltStart, saltStart + SALT_LENGTH);
          const nonce = header.subarray(saltStart + SALT_LENGTH, HEADER_LENGTH);
          key = await scrypt(password, salt, 32, KDF_OPTIONS);

          decipher = createDecipheriv('aes-256-gcm', key, nonce);
          decipher.setAAD(header);
        }

        if (remaining.length === 0) return;

        // Hold back the final tag-sized tail; only earlier bytes are ciphertext.
        const combined = Buffer.concat([tail, remaining]);
        if (combined.length <= TAG_LENGTH) {
          tail = combined;
          return;
        }

        const splitAt = combined.length - TAG_LENGTH;
        const ciphertext = combined.subarray(0, splitAt);
        tail = Buffer.from(combined.subarray(splitAt));

        const plaintext = decipher.update(ciphertext);
        if (plaintext.length) this.push(plaintext);
      })().then(() => callback(), callback);
    },

    flush(callback) {
      try {
        if (!decipher || header.length !== HEADER_LENGTH) {
          throw new Error('Truncated encrypted archive header');
        }
        if (tail.length !== TAG_LENGTH) {
          throw new Error('Truncated encrypted archive authentication tag');
        }

        decipher.setAuthTag(tail);
        // GCM authentication is only established if final() succeeds.
        const finalPlaintext = decipher.final();
        if (finalPlaintext.length) this.push(finalPlaintext);
        authenticated = true;
        callback();
      } catch (error) {
        callback(error);
      } finally {
        key?.fill(0);
      }
    },
  });

  let output;
  let outputOpened = false;
  try {
    output = createWriteStream(outputPath, {
      flags: 'wx',
      mode: 0o600,
    });
    // Only clean up the destination if this invocation successfully created it.
    // With flags:'wx', an EEXIST error means the path belongs to someone else.
    output.once('open', () => {
      outputOpened = true;
    });

    await pipeline(readable, decryptor, output);

    if (!authenticated) {
      throw new Error('Encrypted archive authentication did not complete');
    }

    return {
      authenticated: true,
      outputPath,
      format: 'GFBK',
      version: VERSION,
    };
  } catch (error) {
    output?.destroy();
    if (outputOpened) {
      try {
        await unlink(outputPath);
      } catch (cleanupError) {
        if (cleanupError?.code !== 'ENOENT') {
          throw new AggregateError(
            [error, cleanupError],
            'Decryption failed and partial plaintext cleanup also failed',
          );
        }
      }
    }
    throw error;
  } finally {
    key?.fill(0);
    tail.fill(0);
    header.fill(0);
  }
}
