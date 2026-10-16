# Phase 4F.26 - Streaming Encryption and Recovery Design

Status: DESIGN ONLY - EXECUTION BLOCKED

## Purpose

Support large PostgreSQL backups without buffering an
entire database dump in Node.js memory or creating a
persistent plaintext dump file.

## Encryption pipeline

1. Validate the exact disposable local database target.
2. Verify the connected PostgreSQL server and database.
3. Obtain an independently recoverable encryption secret.
4. Derive a key using the versioned scrypt parameters.
5. Generate a unique random salt and nonce.
6. Construct and authenticate the archive header.
7. Stream pg_dump stdout through AES-256-GCM.
8. Write ciphertext to a newly created temporary file.
9. Finalize encryption and append the authentication tag.
10. Confirm successful pg_dump and output-stream completion.
11. Publish the completed archive without overwriting files.
12. Record the encrypted archive SHA-256.

The existing pg_dump command builder is NOT approved
for execution because it specifies plaintext --file output.

## Critical decryption rule

AES-GCM can emit plaintext before final authentication.

Do not pipe decipher.update() output directly into
pg_restore, psql, or any other database operation.

Do not expose or publish partially authenticated plaintext.

## Safe recovery sequence

1. Validate archive structure, size and version.
2. Validate bounded, supported key derivation parameters.
3. Obtain the recovery secret securely.
4. Authenticate the complete archive before restoration.
5. Use an isolated, disposable recovery destination.
6. Ensure authenticated bytes alone reach pg_restore.
7. Reject authentication failure without database changes.
8. Verify restore completeness, RLS and tenant isolation.

## Authentication design options

Option A: Two-pass authentication and restoration.

Authenticate the entire encrypted archive first, then
reopen the same immutable archive for restoration.

This requires protection against file replacement or
modification between verification and restoration.

Option B: Authenticated temporary plaintext staging.

Decrypt to protected temporary storage, authenticate
the complete archive, then restore.

This introduces plaintext-at-rest exposure and requires
separately approved secure storage and cleanup controls.

Option C: Independently authenticated chunks.

Use a carefully specified chunked authenticated format,
including chunk ordering, lengths, final-chunk marking,
and whole-archive completeness authentication.

This requires additional design and adversarial tests.

No option is approved for execution yet.

## Mandatory failure tests

- Wrong recovery secret
- Modified header
- Modified ciphertext
- Modified authentication tag
- Truncated archive
- Appended data
- Interrupted encryption
- Interrupted decryption
- pg_dump nonzero exit
- Output write failure
- Archive replacement attempt
- Restore destination mismatch

## Outstanding controls

- Secure secret input and recovery-key custody
- Fixed executable identity
- Local PostgreSQL server identity verification
- Safe filesystem path resolution
- Symlink and overwrite protection
- Atomic archive publication on Windows
- Resource limits and cleanup
- Cross-machine recovery rehearsal

## Authorization boundary

No PostgreSQL connections, backup execution,
restoration, migrations, staging access, deployments,
or GitHub pushes are authorized by this document.