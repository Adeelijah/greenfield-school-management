import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  decryptSyntheticData
} from './local-backup-crypto-prototype.mjs';

const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;

export async function authenticateSyntheticArchive(
  readable,
  password
) {
  if (!readable || typeof readable.pipe !== 'function') {
    throw new Error('Readable archive stream required');
  }

  const chunks = [];
  let totalBytes = 0;

  const collector = new Writable({
    write(chunk, encoding, callback) {
      totalBytes += chunk.length;

      if (totalBytes > MAX_ARCHIVE_BYTES) {
        callback(new Error('Encrypted archive exceeds prototype size limit'));
        return;
      }

      chunks.push(Buffer.from(chunk));
      callback();
    }
  });

  let encrypted;

  try {
    await pipeline(readable, collector);

    encrypted = Buffer.concat(chunks, totalBytes);

    return await decryptSyntheticData(encrypted, password);
  } finally {
    if (encrypted) {
      encrypted.fill(0);
    }

    for (const chunk of chunks) {
      chunk.fill(0);
    }
  }
}