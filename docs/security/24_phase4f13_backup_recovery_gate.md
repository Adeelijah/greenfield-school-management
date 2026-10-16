# Phase 4F.13 — Staging backup and recovery gate

**Status:** BLOCKED FOR REMOTE WRITES. Operator reports no available Supabase-managed backups on `greenfield-staging` (project ref `hweoqkbgmzycyznrbvng`). Dashboard project reference and direct host `db.hweoqkbgmzycyznrbvng.supabase.co` were confirmed by the operator; this is not an independent authenticated connection check.

## Scope and risks

Staging currently has no Greenfield application tables or Drizzle journal according to prior read-only audits. Supabase-managed schemas and roles **must not** be dropped, recreated or overwritten. A logical dump of `public` is not a full cluster/PITR backup, and does not preserve every Supabase platform setting, role, auth secret, storage object, or external integration. Do not imply otherwise.

## Required pre-deployment gates

1. Re-run read-only inventory of `public` tables, views, functions, sequences, policies, grants and default privileges; refuse if unexpected objects or migration journal appear.
2. Verify actual connection identity against the operator-confirmed project reference/host without displaying credentials. `current_database() = postgres` alone does not prove identity.
3. Choose an explicitly reviewed recovery mechanism. If managed backups are unavailable, create a **read-only logical snapshot** of relevant application schema and migration state using a dedicated, correctly scoped staging connection. A dump command must be reviewed separately and must not use `.env.local` implicitly.
4. Store any dump encrypted, with access controls, and outside the Git repository. Do not paste dump contents or credentials into chat. Record UTC time, project ref, tool version and SHA-256 fingerprint without including secrets.
5. Verify the dump can be parsed and, where feasible, restore it to a disposable isolated PostgreSQL instance; do **not** restore Supabase-managed `auth`, `storage`, `realtime`, or other platform schemas into a local instance as if that validated a full Supabase recovery.
6. Review a **forward-fix** procedure for post-commit defects. Transaction rollback works only before commit; after commit, never automatically drop the deployed schema.
7. Confirm restore-time objective and recovery-point limitations with the operator. With no managed backup, recovery of platform state may be unavailable; this must be an explicit deployment risk decision.
8. Require a new explicit authorization naming the target and exact deployment code revision before any staging write.

## Execution boundary

This document grants **no permission** to connect to or modify staging. No `db:migrate`, SQL Editor execution, remote DDL, or role/grant changes are approved. Existing local rehearsals do not replace actual Supabase JWT/PostgREST and server-authorization acceptance tests.

## Suggested read-only verification after backup plan review

Re-run the existing `docs/security/21_phase4f9_effective_access_read_only.sql` queries in the Supabase SQL Editor, capture only non-secret result summaries, and compare with earlier audits. Do not run any DDL.
