import test from 'node:test';
import assert from 'node:assert/strict';

import {
  encryptSyntheticData,
  decryptSyntheticData
} from './local-backup-crypto-prototype.mjs';

const PASSWORD = 'synthetic-test-password-2026';
const WRONG_PASSWORD = 'incorrect-test-password-2026';

test('encrypts and decrypts synthetic data', async () => {
  const original = Buffer.from('Greenfield synthetic backup test');
  const encrypted = await encryptSyntheticData(original, PASSWORD);
  const decrypted = await decryptSyntheticData(encrypted, PASSWORD);

  assert.deepEqual(decrypted, original);
  assert.notDeepEqual(encrypted, original);
});

test('supports empty plaintext', async () => {
  const original = Buffer.alloc(0);
  const encrypted = await encryptSyntheticData(original, PASSWORD);
  const decrypted = await decryptSyntheticData(encrypted, PASSWORD);

  assert.deepEqual(decrypted, original);
});

test('produces different archives for identical plaintext', async () => {
  const original = Buffer.from('same synthetic data');

  const first = await encryptSyntheticData(original, PASSWORD);
  const second = await encryptSyntheticData(original, PASSWORD);

  assert.notDeepEqual(first, second);
});

test('rejects incorrect passwords', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  await assert.rejects(
    decryptSyntheticData(encrypted, WRONG_PASSWORD)
  );
});

test('detects ciphertext tampering', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  const tampered = Buffer.from(encrypted);
  tampered[50] ^= 1;

  await assert.rejects(
    decryptSyntheticData(tampered, PASSWORD)
  );
});

test('detects authentication tag tampering', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;

  await assert.rejects(
    decryptSyntheticData(tampered, PASSWORD)
  );
});

test('detects salt tampering', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  const tampered = Buffer.from(encrypted);
  tampered[10] ^= 1;

  await assert.rejects(
    decryptSyntheticData(tampered, PASSWORD)
  );
});

test('detects nonce tampering', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  const tampered = Buffer.from(encrypted);
  tampered[40] ^= 1;

  await assert.rejects(
    decryptSyntheticData(tampered, PASSWORD)
  );
});

test('rejects truncated archives', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  await assert.rejects(
    decryptSyntheticData(encrypted.subarray(0, 20), PASSWORD),
    /Invalid encrypted archive length/
  );
});

test('rejects invalid archive identifiers', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  const tampered = Buffer.from(encrypted);
  tampered[0] ^= 1;

  await assert.rejects(
    decryptSyntheticData(tampered, PASSWORD),
    /Invalid encrypted archive identifier/
  );
});

test('rejects unsupported archive versions', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('synthetic data'),
    PASSWORD
  );

  const tampered = Buffer.from(encrypted);
  tampered[4] = 99;

  await assert.rejects(
    decryptSyntheticData(tampered, PASSWORD),
    /Unsupported encrypted archive version/
  );
});

test('rejects short passwords', async () => {
  await assert.rejects(
    encryptSyntheticData(Buffer.from('test'), 'short'),
    /at least 16 characters/
  );
});

test('rejects non-buffer plaintext', async () => {
  await assert.rejects(
    encryptSyntheticData('test', PASSWORD),
    /Plaintext must be a Buffer/
  );
});

test('rejects non-buffer archives', async () => {
  await assert.rejects(
    decryptSyntheticData('not-an-archive', PASSWORD),
    /Archive must be a Buffer/
  );
});
test('preserves arbitrary binary data', async () => {
  const original = Buffer.from([
    0, 1, 2, 3, 127, 128, 254, 255, 0, 10, 13
  ]);

  const encrypted = await encryptSyntheticData(original, PASSWORD);
  const decrypted = await decryptSyntheticData(encrypted, PASSWORD);

  assert.deepEqual(decrypted, original);
});

test('preserves a larger synthetic payload', async () => {
  const original = Buffer.alloc(1024 * 1024);

  for (let i = 0; i < original.length; i++) {
    original[i] = i % 256;
  }

  const encrypted = await encryptSyntheticData(original, PASSWORD);
  const decrypted = await decryptSyntheticData(encrypted, PASSWORD);

  assert.deepEqual(decrypted, original);
});

test('detects removal of encrypted payload bytes', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('Greenfield synthetic recovery data'),
    PASSWORD
  );

  const tampered = Buffer.concat([
    encrypted.subarray(0, 55),
    encrypted.subarray(56)
  ]);

  await assert.rejects(
    decryptSyntheticData(tampered, PASSWORD)
  );
});

test('detects appended bytes', async () => {
  const encrypted = await encryptSyntheticData(
    Buffer.from('Greenfield synthetic recovery data'),
    PASSWORD
  );

  const tampered = Buffer.concat([
    encrypted,
    Buffer.from([0x42])
  ]);

  await assert.rejects(
    decryptSyntheticData(tampered, PASSWORD)
  );
});