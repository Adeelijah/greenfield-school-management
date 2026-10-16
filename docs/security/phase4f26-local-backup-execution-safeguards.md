# Phase 4F.26 - Local Backup Execution Safeguards

Status: DESIGN ONLY - EXECUTION NOT AUTHORIZED

## Scope

The workflow is restricted to the local disposable database:

Host: 127.0.0.1
Port: 5432
Database: greenfield_disposable_backup_source
Role: postgres

Remote PostgreSQL and Supabase connections are prohibited.

## Required safeguards

1. Require explicit operator approval before execution.
2. Never automatically load .env.local or migration credentials.
3. Validate the exact local database target.
4. Construct a restricted PostgreSQL process environment.
5. Use explicit connection parameters.
6. Independently verify database identity before backup.
7. Use a fixed, approved PostgreSQL executable path.
8. Reject arbitrary output directories and path traversal.
9. Never overwrite existing backup archives.
10. Never include passwords in command arguments or logs.
11. Prevent interactive password prompts.
12. Avoid persistent plaintext backup files.
13. Prefer streaming backup output directly into encryption.
14. Verify encryption success and archive integrity.
15. Record SHA-256 of the encrypted archive.
16. Keep backup archives excluded from Git.
17. Define secure storage, retention and cleanup procedures.
18. Fail closed on errors or incomplete output.
19. Test failure handling before permitting execution.
20. Require separate approval for any restore operation.

## Encryption considerations

The installed 7-Zip executable is version 26.04.

Its installation metadata and local SHA-256 have been
recorded, but independent authenticity verification
remains pending.

Do not assume that the local drive is encrypted.

Do not use command-line encryption passwords that could
be exposed through process listings or logs.

A suitable secure streaming or encrypted-storage design
must be reviewed before backup execution is enabled.

## Recovery verification

A successful backup command is not proof of recoverability.

Acceptance requires:

- Backup integrity verification.
- An isolated local restore.
- Migration journal verification.
- Privilege and RLS verification.
- Tenant-isolation testing.
- Recorded recovery duration.

## Authorization boundary

This document authorizes no database connections,
backup execution, restoration, migrations, deployment
or remote database modifications.

Remote staging operations remain blocked.