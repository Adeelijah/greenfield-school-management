# Phase 4F.3 — Fresh staging deployment package review

**Status: review only. No Supabase SQL execution authorized.**

## Verified evidence (2026-10-15)

- The generated reordered foundation has 55 statements, preserving the original statement inventory.
- Local Drizzle migration runner created 12 application tables and 20 foreign keys. PostgreSQL reported 32 total public indexes (includes implicit indexes; not directly comparable to 19 explicit CREATE INDEX statements).
- The Drizzle journal contained exactly one row after migration and after repeated migrator execution.
- The disposable runner database was subsequently deleted by the operator.
- The original `drizzle/0000_broad_slayback.sql` and its metadata remain untouched.
- These local results **do not** prove Supabase Auth, JWT-backed RLS, API permissions, or server authorization.

## Baseline strategy for fresh staging

Use a dedicated, version-controlled **staging-only migration folder** generated from the original baseline using `node scripts/prepare-staging-baseline.mjs --write-staging-preview`. Preserve `drizzle/0000_broad_slayback.sql` and its metadata for historical review. Pin and verify the SHA-256 of the generated SQL and its source before any remote deployment. Do not use the default `npm run db:migrate` against staging.

The generated folder currently lives under `docs/security/generated/staging-baseline` and is **untracked** locally. Before a deployment gate can be approved, decide whether to track generated SQL and metadata or deterministically regenerate them in CI with pinned hashes. A passing local run does not itself authorize staging.

## Proposed ordering — not executable instructions

1. Independently verify the target is the disposable `greenfield-staging` Supabase project, and that application schema, migration journal, data and unexpected grants/policies are absent.
2. Review and approve the 55-statement corrected baseline, its matching journal/snapshot, and a staging-only migration runner with strict remote-target safeguards.
3. Apply the foundation using that approved runner, then verify all constraints, indexes, and exactly one journal entry.
4. Inspect `auth.users` and preflight `school_users.auth_user_id` for orphaned values, type, uniqueness and preexisting FK. Review the FK SQL in `docs/security/05_auth_user_fk_review.sql`.
5. Apply the approved Auth FK and consolidated RLS/grants in a planned, tightly controlled maintenance window **before any client/API exposure**. These security steps must be tracked and recoverable; avoid a window in which unrestricted application tables are exposed. The current FK review text says it follows RLS/bootstrap while the security review assumes the FK precedes it; resolve this documentation/order conflict first.
6. Audit PUBLIC, anon, authenticated, service_role, inherited privileges, default privileges, existing policies and PostgREST exposure. Verify `auth.uid()` semantics in the real Supabase environment.
7. Run JWT-backed cross-tenant, suspended-user, unaffiliated-user, column-level and forbidden-write tests. Verify server-side database roles and route authorization separately.
8. Record rollback, evidence and explicit approval before any primary-project work.

## Blocking review findings

- **Ordering conflict:** `05_auth_user_fk_review.sql` states the FK is applied after RLS/grants/bootstrap; `09_consolidated_read_only_review.sql` assumes it exists beforehand. Resolve and document one approved sequence.
- **Deployment tracking:** Auth FK and consolidated RLS/grants are review SQL, not tracked Drizzle migrations. There is no approved staging runner or tested recovery path for those changes.
- **Privileges:** `09_consolidated_read_only_review.sql` revokes grants from `anon` and `authenticated`, but the complete effective permissions including `PUBLIC`, inheritance, default privileges and service roles have not been audited in Supabase.
- **Server safety:** Verify whether the application `DATABASE_URL` uses a role with BYPASSRLS and independently audit authorization in all tenant-scoped server handlers.
- **Real Supabase testing:** The local Auth stub is not proof of JWT/PostgREST behavior. Synthetic test users and cross-tenant test data are still needed.

## Stop condition

**Do not apply the baseline, FK, or RLS SQL to Supabase; do not run `npm run db:migrate` against staging or the primary project.** Next action is a read-only staging identity/privilege preflight and resolution of the deployment-order and migration-tracking blockers. Obtain separate explicit operator approval for any staging write.
