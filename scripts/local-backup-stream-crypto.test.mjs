import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';

import {
  encryptSyntheticStream
} from './local-backup-stream-crypto.mjs';

import {
  decryptSyntheticData
} from './local-backup-crypto-prototype.mjs';

const PASSWORD = 'synthetic-stream-test-password-2026';

async function encryptChunks(chunks) {
  const output = [];

  const writable = new Writable({
    write(chunk, encoding, callback) {
      output.push(Buffer.from(chunk));
      callback();
    }
  });

  await encryptSyntheticStream(
    Readable.from(chunks),
    writable,
    PASSWORD
  );

  return Buffer.concat(output);
}

test('round-trips a single synthetic chunk', async () => {
  const original = Buffer.from('Greenfield streaming test');
  const encrypted = await encryptChunks([original]);
  const decrypted = await decryptSyntheticData(encrypted, PASSWORD);

  assert.deepEqual(decrypted, original);
});

test('round-trips an empty stream', async () => {
  const encrypted = await encryptChunks([]);
  const decrypted = await decryptSyntheticData(encrypted, PASSWORD);

  assert.deepEqual(decrypted, Buffer.alloc(0));
});

test('preserves binary data across chunks', async () => {
  const chunks = [
    Buffer.from([0, 1, 2, 255]),
    Buffer.from([128, 0, 13, 10]),
    Buffer.from([254, 253, 0])
  ];

  const encrypted = await encryptChunks(chunks);
  const decrypted = await decryptSyntheticData(encrypted, PASSWORD);

  assert.deepEqual(decrypted, Buffer.concat(chunks));
});

test('handles a larger multi-chunk payload', async () => {
  const chunks = Array.from(
    { length: 64 },
    (_, index) => Buffer.alloc(16384, index)
  );

  const encrypted = await encryptChunks(chunks);
  const decrypted = await decryptSyntheticData(encrypted, PASSWORD);

  assert.deepEqual(decrypted, Buffer.concat(chunks));
});

test('uses randomized encryption for identical input', async () => {
  const input = [Buffer.from('same synthetic data')];

  const first = await encryptChunks(input);
  const second = await encryptChunks(input);

  assert.notDeepEqual(first, second);
});

test('rejects incorrect decryption passwords', async () => {
  const encrypted = await encryptChunks([
    Buffer.from('synthetic data')
  ]);

  await assert.rejects(
    decryptSyntheticData(
      encrypted,
      'incorrect-synthetic-password-2026'
    )
  );
});

test('detects tampering in a streamed archive', async () => {
  const encrypted = await encryptChunks([
    Buffer.from('synthetic data')
  ]);

  const tampered = Buffer.from(encrypted);
  tampered[50] ^= 1;

  await assert.rejects(
    decryptSyntheticData(tampered, PASSWORD)
  );
});

test('rejects invalid passwords before streaming', async () => {
  await assert.rejects(
    encryptSyntheticStream(
      Readable.from([Buffer.from('test')]),
      new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      }),
      'short'
    ),
    /at least 16 characters/
  );
});

test('propagates input stream failures', async () => {
  const readable = Readable.from(
    (async function* () {
      yield Buffer.from('synthetic data');
      throw new Error('Simulated input failure');
    })()
  );

  const writable = new Writable({
    write(chunk, encoding, callback) {
      callback();
    }
  });

  await assert.rejects(
    encryptSyntheticStream(readable, writable, PASSWORD),
    /Simulated input failure/
  );
});

test('propagates output stream failures', async () => {
  const readable = Readable.from([
    Buffer.from('synthetic data')
  ]);

  const writable = new Writable({
    write(chunk, encoding, callback) {
      callback(new Error('Simulated output failure'));
    }
  });

  await assert.rejects(
    encryptSyntheticStream(readable, writable, PASSWORD),
    /Simulated output failure/
  );
});
test('handles slow writable backpressure', async () => {
  const chunks = Array.from(
    { length: 128 },
    (_, index) => Buffer.alloc(8192, index % 256)
  );

  const output = [];

  const writable = new Writable({
    highWaterMark: 1024,
    write(chunk, encoding, callback) {
      output.push(Buffer.from(chunk));
      setImmediate(callback);
    }
  });

  await encryptSyntheticStream(
    Readable.from(chunks),
    writable,
    PASSWORD
  );

  const decrypted = await decryptSyntheticData(
    Buffer.concat(output),
    PASSWORD
  );

  assert.deepEqual(decrypted, Buffer.concat(chunks));
});

test('preserves highly fragmented binary input', async () => {
  const original = Buffer.from(
    Array.from({ length: 4096 }, (_, index) => index % 256)
  );

  const chunks = Array.from(original, value =>
    Buffer.from([value])
  );

  const encrypted = await encryptChunks(chunks);
  const decrypted = await decryptSyntheticData(
    encrypted,
    PASSWORD
  );

  assert.deepEqual(decrypted, original);
});

test('rejects output failure after partial encrypted output', async () => {
  let bytesWritten = 0;

  const readable = Readable.from([
    Buffer.alloc(8192, 1),
    Buffer.alloc(8192, 2),
    Buffer.alloc(8192, 3)
  ]);

  const writable = new Writable({
    highWaterMark: 1024,
    write(chunk, encoding, callback) {
      bytesWritten += chunk.length;

      if (bytesWritten > 100) {
        callback(new Error('Simulated partial output failure'));
      } else {
        callback();
      }
    }
  });

  await assert.rejects(
    encryptSyntheticStream(readable, writable, PASSWORD),
    /Simulated partial output failure/
  );

  assert.ok(bytesWritten > 0);
});