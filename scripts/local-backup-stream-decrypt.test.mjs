import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { encryptSyntheticStream } from './local-backup-stream-crypto.mjs';
import { decryptArchiveToExclusiveFile } from './local-backup-stream-decrypt.mjs';

const PASSWORD = 'greenfield-streaming-recovery-test-password-2026';

async function encrypt(chunks) {
  const output = [];
  const { Writable } = await import('node:stream');
  const sink = new Writable({
    write(chunk, encoding, callback) {
      output.push(Buffer.from(chunk));
      callback();
    },
  });
  await encryptSyntheticStream(Readable.from(chunks), sink, PASSWORD);
  return Buffer.concat(output);
}

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'greenfield-decrypt-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('decrypts a GFBK v1 archive and returns only after authentication', async () => {
  await withTempDir(async dir => {
    const original = Buffer.from('Greenfield authenticated streaming recovery');
    const archive = await encrypt([original]);
    const destination = join(dir, 'plain.tmp');

    const result = await decryptArchiveToExclusiveFile(
      Readable.from([archive]), destination, PASSWORD,
    );

    assert.equal(result.authenticated, true);
    assert.deepEqual(await readFile(destination), original);
    assert.equal((await stat(destination)).isFile(), true);
  });
});

test('handles archives larger than the former 8 MB prototype limit', async () => {
  await withTempDir(async dir => {
    const chunks = Array.from({ length: 40 }, (_, i) =>
      Buffer.alloc(256 * 1024, i % 251),
    );
    const original = Buffer.concat(chunks);
    const archive = await encrypt(chunks);
    const destination = join(dir, 'large.tmp');

    await decryptArchiveToExclusiveFile(
      Readable.from(Array.from({ length: Math.ceil(archive.length / 8191) }, (_, i) =>
        archive.subarray(i * 8191, Math.min((i + 1) * 8191, archive.length)),
      )),
      destination,
      PASSWORD,
    );

    assert.deepEqual(await readFile(destination), original);
  });
});

test('supports empty plaintext', async () => {
  await withTempDir(async dir => {
    const archive = await encrypt([]);
    const destination = join(dir, 'empty.tmp');
    await decryptArchiveToExclusiveFile(Readable.from([archive]), destination, PASSWORD);
    assert.deepEqual(await readFile(destination), Buffer.alloc(0));
  });
});

test('rejects an incorrect password and removes partial plaintext', async () => {
  await withTempDir(async dir => {
    const archive = await encrypt([Buffer.alloc(1024 * 1024, 7)]);
    const destination = join(dir, 'wrong-password.tmp');

    await assert.rejects(
      decryptArchiveToExclusiveFile(
        Readable.from([archive]),
        destination,
        'incorrect-password-for-recovery-2026',
      ),
    );
    await assert.rejects(readFile(destination), { code: 'ENOENT' });
  });
});

test('rejects modified ciphertext and removes partial plaintext', async () => {
  await withTempDir(async dir => {
    const archive = await encrypt([Buffer.alloc(128 * 1024, 3)]);
    archive[60] ^= 0x01;
    const destination = join(dir, 'tampered.tmp');

    await assert.rejects(
      decryptArchiveToExclusiveFile(Readable.from([archive]), destination, PASSWORD),
    );
    await assert.rejects(readFile(destination), { code: 'ENOENT' });
  });
});

test('rejects a modified authentication tag and removes partial plaintext', async () => {
  await withTempDir(async dir => {
    const archive = await encrypt([Buffer.from('tag tampering test')]);
    archive[archive.length - 1] ^= 0x01;
    const destination = join(dir, 'bad-tag.tmp');

    await assert.rejects(
      decryptArchiveToExclusiveFile(Readable.from([archive]), destination, PASSWORD),
    );
    await assert.rejects(readFile(destination), { code: 'ENOENT' });
  });
});

test('rejects truncated archives and removes partial plaintext', async () => {
  await withTempDir(async dir => {
    const archive = await encrypt([Buffer.from('truncation test')]);
    const destination = join(dir, 'truncated.tmp');

    await assert.rejects(
      decryptArchiveToExclusiveFile(
        Readable.from([archive.subarray(0, archive.length - 5)]),
        destination,
        PASSWORD,
      ),
    );
    await assert.rejects(readFile(destination), { code: 'ENOENT' });
  });
});

test('rejects invalid identifiers and versions', async () => {
  await withTempDir(async dir => {
    const archive = await encrypt([Buffer.from('header test')]);
    const badMagic = Buffer.from(archive);
    badMagic[0] = 0;
    await assert.rejects(
      decryptArchiveToExclusiveFile(
        Readable.from([badMagic]), join(dir, 'bad-magic.tmp'), PASSWORD,
      ),
      /identifier/,
    );

    const badVersion = Buffer.from(archive);
    badVersion[4] = 99;
    await assert.rejects(
      decryptArchiveToExclusiveFile(
        Readable.from([badVersion]), join(dir, 'bad-version.tmp'), PASSWORD,
      ),
      /version/,
    );
  });
});

test('does not overwrite an existing destination', async () => {
  await withTempDir(async dir => {
    const destination = join(dir, 'existing.tmp');
    await writeFile(destination, 'preserve this file');
    const archive = await encrypt([Buffer.from('new plaintext')]);

    await assert.rejects(
      decryptArchiveToExclusiveFile(Readable.from([archive]), destination, PASSWORD),
      { code: 'EEXIST' },
    );
    assert.equal(await readFile(destination, 'utf8'), 'preserve this file');
  });
});

test('propagates interrupted input and removes partial output', async () => {
  await withTempDir(async dir => {
    const archive = await encrypt([Buffer.alloc(64 * 1024, 4)]);
    const destination = join(dir, 'interrupted.tmp');
    const readable = Readable.from((async function* () {
      yield archive.subarray(0, Math.floor(archive.length / 2));
      throw new Error('simulated interrupted archive stream');
    })());

    await assert.rejects(
      decryptArchiveToExclusiveFile(readable, destination, PASSWORD),
      /simulated interrupted archive stream/,
    );
    await assert.rejects(readFile(destination), { code: 'ENOENT' });
  });
});

test('rejects invalid passwords and invalid readable streams', async () => {
  await withTempDir(async dir => {
    await assert.rejects(
      decryptArchiveToExclusiveFile(
        Readable.from([]), join(dir, 'short-password.tmp'), 'short',
      ),
      /at least 16 characters/,
    );
    await assert.rejects(
      decryptArchiveToExclusiveFile(
        null, join(dir, 'invalid-readable.tmp'), PASSWORD,
      ),
      /Readable encrypted archive stream required/,
    );
  });
});
