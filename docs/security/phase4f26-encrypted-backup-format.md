# Phase 4F.26 - Portable Encrypted Backup Format

Status: DESIGN ONLY - NOT APPROVED FOR EXECUTION

## Objective

Produce recoverable, authenticated encrypted archives
without creating persistent plaintext PostgreSQL dumps.

## Proposed pipeline

1. Validate the exact disposable local database.
2. Verify the connected database identity.
3. Start pg_dump with explicit local connection arguments.
4. Stream pg_dump stdout into Node.js encryption.
5. Write only encrypted output to a temporary archive.
6. Finalize authentication and verify process success.
7. Atomically publish the completed encrypted archive.
8. Record the encrypted archive SHA-256.

No executable backup runner is authorized yet.

## Cryptography

Algorithm: AES-256-GCM
Key derivation: scrypt
Salt: 32 random bytes per archive
Nonce: 12 random bytes per archive
Authentication tag: 16 bytes

Use a versioned binary container.

The container must include:

- Magic identifier and format version
- Key derivation parameters
- Random salt
- Random nonce
- Encrypted payload
- Authentication tag

Authenticate the complete header as additional
authenticated data (AAD).

Use a new salt and nonce for every archive.

Never reuse a nonce with the same encryption key.

## Credential handling

Never include encryption secrets in command arguments,
environment variables, logs or committed files.

Design a secure interactive or protected credential
delivery mechanism before execution.

Do not persist plaintext passwords or derived keys.

## Failure handling

- Never publish incomplete archives.
- Remove partial encrypted output on failure.
- Detect pg_dump failure independently.
- Reject authentication failures during decryption.
- Never restore unauthenticated plaintext.
- Prevent overwriting existing archives.
- Reject unsafe paths and filesystem links.

## Recovery requirements

Recovery must be possible on a different machine
using independently preserved recovery credentials.

Test encryption and decryption with synthetic data.

Verify complete round-trip integrity before connecting
the encryption pipeline to PostgreSQL.

An encrypted archive is not proof of recoverability.

## Outstanding design decisions

- Exact binary container layout
- scrypt cost and memory limits
- Secret input mechanism
- Secure output file creation
- Atomic publication on Windows
- Streaming decryption and restore
- Cross-machine recovery-key custody
- Backup retention and disposal

## Authorization

This document authorizes no database connection,
backup execution, restoration, migration, deployment,
or remote staging operation.