# Phase 4F.9 — Staging safeguards and recovery gate

**Read-only assessment. No staging writes authorized.**

## Project identity

Target Supabase project reference: `hweoqkbgmzycyznrbvng` (`greenfield-staging`). PostgreSQL `current_database() = postgres` is not unique to the project. Require an independent operator confirmation of the Supabase dashboard project reference AND the connection host/project reference before ever preparing a write-capable session. No script may silently reuse `.env.local`, `DATABASE_URL` or `MIGRATION_DATABASE_URL` for remote deployment.

## Permission audit

Run `docs/security/21_phase4f9_effective_access_read_only.sql` in the staging SQL Editor. It checks role membership, effective existing table privileges, PUBLIC/function execution and relevant default grants. A query returning zero rows for current public tables is expected in the previously observed empty staging state, **not** evidence that future tables are secure. Supabase's broad default privileges must be addressed by revokes and assertions within the same transaction as table creation.

## Transaction and recovery

- **Before commit:** fail closed; rollback the entire foundation, Auth FK, RLS policies, grants and journal together. Re-check that no Greenfield objects or journal entry remain.
- **After commit:** do **not** automatically drop tables or replay the migration. Stop application rollout, restrict API exposure if necessary, inspect database state and logs, then select a reviewed forward-fix or restore plan.
- Verify a usable backup/recovery point and restore permissions before deployment. An untested backup is not an approved recovery plan.
- Keep the original Supabase project completely out of scope.
- Reconcile the FK review's contradictory ordering comments before writing the deployer.
- Server-side `postgres`/`service_role` bypass RLS: audit every privileged handler and enforce tenant authorization explicitly.
- Actual JWT-backed and PostgREST tests cannot pass before an approved staging deployment; treat them as a post-deployment acceptance gate, not as predeployment evidence.

## Authorization

A separate, explicit user approval must name `greenfield-staging` and the exact reviewed deployment procedure. Passing local or read-only checks is insufficient. Do not run `npm run db:migrate` on either Supabase project.
