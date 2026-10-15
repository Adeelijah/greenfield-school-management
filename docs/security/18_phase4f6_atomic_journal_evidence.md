# Phase 4F.6 — Atomic migration journal rehearsal evidence

**Result: PASS (operator-reported local test). Remote staging remains unapproved.**

Command: `node scripts/rehearse-atomic-journal.mjs --execute-local-atomic`

Database: `greenfield_disposable_atomic_runner` (local PostgreSQL).

## Observed output

- `injectedFailureRolledBack: true`
- Committed foundation: 12 tables with FORCE RLS, 7 policies, 1 Auth FK
- `journalMatchesMigration: true`
- `journalEntriesAfterDrizzleRerun: 1`
- `cleanupRequired: true`
- `stagingApproved: false`; `supabaseChanged: false`

The rehearsal exercised a single-connection transaction with the migration journal inserted after security assertions and then confirmed Drizzle recognized the recorded migration.

## Remaining gates

- This local runner creates test-only `auth` objects and roles and is **not** a deployable Supabase runner.
- Supabase default grants and actual PostgREST/JWT behavior require verification.
- Verify the exact staging deployment mechanism, credentials, effective privileges, and operational recovery procedure; resolve document ordering.
- Obtain explicit approval before any staging SQL write.

## Cleanup

The successful local rehearsal **committed** disposable tables, auth stubs, roles, and a journal. Do not blindly drop shared PostgreSQL roles: first inspect their ownership and dependencies. Prefer removing the disposable database only after inspection, then remove the two test roles if they have no remaining dependencies. Never use a remote connection or database name for cleanup.
