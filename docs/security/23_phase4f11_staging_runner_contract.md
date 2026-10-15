# Phase 4F.11 — Staging deployment runner design and approval boundary

**STATUS: DESIGN REVIEW ONLY. No remote write runner is authorized.**

## Corrected operation order

The local Phase 4F.5/4F.6 tests exercised foundation -> Auth FK -> security -> assertions -> migration journal. The older `05_auth_user_fk_review.sql` comment instructing the FK to be added after security/bootstrap contradicts this tested order. That older document is review-only, not a migration; the final approved runner must use the tested order or explicitly re-test a revised order.

## Required runner invariants

1. An explicit `--target-project-ref hweoqkbgmzycyznrbvng` argument, independently checked against a verified connection endpoint and the operator's Supabase Dashboard. `current_database() = postgres` is **not** sufficient identity proof.
2. Dedicated staging credential, never silently read `.env.local` or use `DATABASE_URL` / `MIGRATION_DATABASE_URL`. Never print a credential, full connection URL, or token.
3. Fail if any Greenfield table, policy, FK or Drizzle journal exists, or if `auth.users` / `auth.uid()` are missing. Refuse non-empty or ambiguous schema state.
4. Pin the generated ordered foundation SHA-256 `c8f61c5f702ae6ebad9cc2950edb1d4a288eb2a2613281cdc612167b711cba62` and migration metadata.
5. Execute on **one PostgreSQL transaction connection**: foundation (55) -> Auth FK (1) -> security (35) -> assertions -> Drizzle journal -> commit.
6. Within the transaction, verify all 12 Greenfield tables have ENABLE and FORCE RLS, exactly seven reviewed policies, expected FK, expected grants/denials for `anon` and `authenticated` (including column grants, sequences, inherited and PUBLIC access). Verify no unexpected Greenfield-owned executable functions.
7. Verify the exact Drizzle journal hash and timestamp before committing. Never fabricate a journal record without a matching migration file and reviewed migrator behavior.
8. Explicit, separate operator authorization naming `greenfield-staging` and the exact runner commit before any execution. A generic “let's go” to development work is not deployment approval.
9. Fail closed on errors and verify rollback. On post-commit errors, do not automatically destroy schema; follow a reviewed forward-fix or restore plan.
10. Real JWT/PostgREST role and tenant-isolation tests must pass **after approved staging deployment** before enabling users.

## Security caveat

Supabase's `public` schema is exposed and has broad default grants for new tables/sequences/functions. Keeping foundation and security in a single transaction avoids a committed unsecured interval, but is not by itself proof of API safety. `service_role` and `postgres` bypass RLS; server endpoints need independent authorization.

## Next implementation gate

Build a **non-executing** compiler/validator for the proposed transaction and a separate local Supabase-like rehearsal. Do not expose an executable remote deployment command until the above checks and recovery process have been reviewed. The current local `rehearse-atomic-journal.mjs` is not a staging deployer.
