# Phase 4F.8 — Staging deployment package readiness (NO EXECUTION)

**Status: review only; not authorized for Supabase writes.**

## Confirmed from staging SQL Editor (read-only)

- `public` exposed in Supabase Data API.
- Staging has no Greenfield public tables or Drizzle migration journal.
- `anon` and `authenticated` have no BYPASSRLS; `service_role` and `postgres` have BYPASSRLS.
- Default privileges for tables created by `postgres` and `supabase_admin` in `public` grant broad privileges to browser roles. Default privileges also grant sequence access and function EXECUTE. Preserve managed project-wide defaults until separately reviewed.
- The available screenshots only partially display some results. Do not infer exhaustive effective privileges from them.

## Offline review

1. Run `node scripts/prepare-staging-baseline.mjs --write-staging-preview` to regenerate local-only baseline.
2. Run `node scripts/review-staging-deployment-package.mjs --review-only`.
3. Expect 55 foundation statements, 35 security statements, 12 FORCE RLS statements, 7 policies, exact baseline hash, matching journal metadata.
4. This verifier reads local files only; it cannot approve remote deployment.

## Required before an executable staging runner

- Pin the exact Supabase staging project reference `hweoqkbgmzycyznrbvng` in operator-facing checks, while recognizing that PostgreSQL `current_database() = 'postgres'` alone cannot distinguish Supabase projects. Do not treat database name or connection hostname alone as cryptographic project identity.
- Independently confirm the actual staging host/project and an explicit operator approval; never reuse `DATABASE_URL` or `MIGRATION_DATABASE_URL` implicitly.
- Confirm `auth.users` and `auth.uid()` exist, no conflicting tables/policies/FK/journal, and exact expected PostgreSQL privileges.
- Reconcile the contradictory FK-order comments in `05_auth_user_fk_review.sql`; tested ordering is foundation -> FK -> security -> journal.
- Confirm the real Supabase role that creates tables and the journal schema/version; validate actual effective privileges for `anon`, `authenticated`, `PUBLIC`, inherited roles, and functions.
- Add failure-injection and abort-on-assertion checks that execute on the **same transaction connection**; no window for unsecured tables to be committed.
- Verify the server's privileged connection and tenant authorization; do not assume RLS protects `postgres` or `service_role`.
- Establish database backup/restore strategy and a separately reviewed recovery plan.
- Perform JWT/PostgREST integration testing against staging after an explicitly approved deployment; never claim those tests have already passed.

**Do not run `npm run db:migrate` against staging or paste review-only scripts as standalone migrations.**
