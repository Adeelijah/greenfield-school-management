import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import {
  encryptSyntheticData
} from './local-backup-crypto-prototype.mjs';

import {
  authenticateSyntheticArchive
} from './local-backup-authenticated-decrypt.mjs';

const PASSWORD = 'synthetic-recovery-test-password-2026';

async function authenticate(encrypted, password = PASSWORD) {
  return authenticateSyntheticArchive(
    Readable.from([encrypted]),
    password
  );
}

test('authenticates and returns valid synthetic data', async () => {
  const original = Buffer.from('Greenfield recovery test');
  const encrypted = await encryptSyntheticData(original, PASSWORD);

  assert.deepEqual(await authenticate(encrypted), original);
});

test('authenticates an empty payload', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.alloc(0),
    PASSWORD
  );

  assert.deepEqual(
    await authenticate(encrypted),
    Buffer.alloc(0)
  );
});

test('preserves binary payloads', async () => {
  const original = Buffer.from([0, 1, 255, 128, 0, 10]);
  const encrypted = await encryptSyntheticData(original, PASSWORD);

  assert.deepEqual(await authenticate(encrypted), original);
});

test('handles fragmented encrypted input', async () => {
  const original = Buffer.from('Fragmented encrypted archive');
  const encrypted = await encryptSyntheticData(original, PASSWORD);

  const chunks = [];
  for (let i = 0; i < encrypted.length; i += 3) {
    chunks.push(encrypted.subarray(i, i + 3));
  }

  const decrypted = await authenticateSyntheticArchive(
    Readable.from(chunks),
    PASSWORD
  );

  assert.deepEqual(decrypted, original);
});

test('rejects an incorrect recovery password', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  await assert.rejects(
    authenticate(encrypted, 'incorrect-recovery-password-2026')
  );
});

test('rejects modified ciphertext', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  encrypted[50] ^= 1;

  await assert.rejects(authenticate(encrypted));
});

test('rejects modified authentication tags', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  encrypted[encrypted.length - 1] ^= 1;

  await assert.rejects(authenticate(encrypted));
});

test('rejects truncated archives', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  await assert.rejects(
    authenticate(encrypted.subarray(0, encrypted.length - 1))
  );
});

test('rejects appended archive bytes', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  await assert.rejects(
    authenticate(Buffer.concat([encrypted, Buffer.from([42])]))
  );
});

test('rejects oversized encrypted archives', async () => {
  const oversized = Buffer.alloc(8 * 1024 * 1024 + 1);

  await assert.rejects(
    authenticateSyntheticArchive(
      Readable.from([oversized]),
      PASSWORD
    ),
    /exceeds prototype size limit/
  );
});

test('propagates interrupted input streams', async () => {
  const readable = Readable.from(
    (async function* () {
      yield Buffer.from('partial archive');
      throw new Error('Simulated interrupted archive');
    })()
  );

  await assert.rejects(
    authenticateSyntheticArchive(readable, PASSWORD),
    /Simulated interrupted archive/
  );
});

test('rejects invalid readable streams', async () => {
  await assert.rejects(
    authenticateSyntheticArchive(null, PASSWORD),
    /Readable archive stream required/
  );
});