import {
  randomBytes,
  scrypt as scryptCallback,
  createCipheriv
} from 'node:crypto';
import { promisify } from 'node:util';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const scrypt = promisify(scryptCallback);

const MAGIC = Buffer.from('GFBK');
const VERSION = 1;
const SALT_LENGTH = 32;
const NONCE_LENGTH = 12;

const KDF_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024
};

export async function encryptSyntheticStream(
  readable,
  writable,
  password
) {
  if (typeof password !== 'string' || password.length < 16) {
    throw new Error('Encryption password must contain at least 16 characters');
  }

  if (!readable || typeof readable.pipe !== 'function') {
    throw new Error('Readable stream required');
  }

  if (!writable || typeof writable.write !== 'function') {
    throw new Error('Writable stream required');
  }

  const salt = randomBytes(SALT_LENGTH);
  const nonce = randomBytes(NONCE_LENGTH);
  const key = await scrypt(password, salt, 32, KDF_OPTIONS);

  try {
    const header = Buffer.concat([
      MAGIC,
      Buffer.from([VERSION]),
      salt,
      nonce
    ]);

    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(header);

    let headerWritten = false;

    const encryptor = new Transform({
      transform(chunk, encoding, callback) {
        try {
          if (!headerWritten) {
            this.push(header);
            headerWritten = true;
          }

          this.push(cipher.update(chunk));
          callback();
        } catch (error) {
          callback(error);
        }
      },

      flush(callback) {
        try {
          if (!headerWritten) {
            this.push(header);
          }

          this.push(cipher.final());
          this.push(cipher.getAuthTag());
          callback();
        } catch (error) {
          callback(error);
        }
      }
    });

    await pipeline(readable, encryptor, writable);
  } finally {
    key.fill(0);
  }
}