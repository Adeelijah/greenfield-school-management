import {
  randomBytes,
  scrypt as scryptCallback,
  createCipheriv,
  createDecipheriv
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const MAGIC = Buffer.from('GFBK');
const VERSION = 1;
const SALT_LENGTH = 32;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = 4 + 1 + SALT_LENGTH + NONCE_LENGTH;

const KDF_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024
};

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 16) {
    throw new Error('Encryption password must contain at least 16 characters');
  }
}

export async function encryptSyntheticData(plaintext, password) {
  validatePassword(password);

  if (!Buffer.isBuffer(plaintext)) {
    throw new Error('Plaintext must be a Buffer');
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

    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);

    return Buffer.concat([
      header,
      encrypted,
      cipher.getAuthTag()
    ]);
  } finally {
    key.fill(0);
  }
}

export async function decryptSyntheticData(archive, password) {
  validatePassword(password);

  if (!Buffer.isBuffer(archive)) {
    throw new Error('Archive must be a Buffer');
  }

  if (archive.length < HEADER_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted archive length');
  }

  const header = archive.subarray(0, HEADER_LENGTH);

  if (!header.subarray(0, 4).equals(MAGIC)) {
    throw new Error('Invalid encrypted archive identifier');
  }

  if (header[4] !== VERSION) {
    throw new Error('Unsupported encrypted archive version');
  }

  const salt = header.subarray(5, 5 + SALT_LENGTH);
  const nonce = header.subarray(
    5 + SALT_LENGTH,
    HEADER_LENGTH
  );

  const encrypted = archive.subarray(
    HEADER_LENGTH,
    archive.length - TAG_LENGTH
  );

  const tag = archive.subarray(archive.length - TAG_LENGTH);

  const key = await scrypt(password, salt, 32, KDF_OPTIONS);

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      nonce
    );

    decipher.setAAD(header);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  } finally {
    key.fill(0);
  }
}