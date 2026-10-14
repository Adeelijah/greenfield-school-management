# Phase 4F — Supabase staging integration gate

**Status: preparation only. No Supabase changes authorized.**

## Verified local evidence

- PostgreSQL 18 isolated transaction: ordered foundation created 12 tables, 19 indexes and 20 FKs; rolled back.
- Local Auth stub + RLS: 12 tables FORCE RLS; six identity scenarios passed.
- Seven actual forbidden operations were denied as nonprivileged `authenticated` role.
- This does **not** establish real Supabase JWT/PostgREST behavior, migration-journal consistency, or privileged server safety.

## Required staging project

Create a **new, disposable Supabase project** separate from the existing Greenfield project. Use synthetic records only. Record its project reference privately; never commit its database URL, service role key, JWT, or password. Keep the existing project's migration state unchanged.

Before any staging SQL, obtain operator confirmation of the target project reference and verify the hostname and database identity independently. Confirm staging contains no existing application objects, no unexpected roles/policies/grants, and no real data. Do not run `npm run db:migrate`.

## Migration blocker

The committed `drizzle/0000_broad_slayback.sql` has composite FKs before required unique indexes. The ordering preview has passed local PostgreSQL execution but is **not** a deployable migration. A follow-up migration cannot repair a failed initial migration. Choose and review a baseline/journal strategy for a *fresh* staging project; do not silently edit the original migration or journal. Record a reproducible checksum and operator-approved sequence.

## Real Supabase acceptance matrix

1. Apply an explicitly reviewed baseline on the new staging project; verify Drizzle journal state and all constraints.
2. Add the tracked `school_users.auth_user_id -> auth.users.id ON DELETE RESTRICT` FK; test valid/invalid references and deletion behavior.
3. Apply reviewed RLS, column grants, and schema privileges; inspect pre-existing PUBLIC, anon, authenticated, service_role and inherited privileges.
4. Sign in as two real test-school users via Supabase Auth. Verify JWT-backed PostgREST requests see only their own school; repeat for teacher, bursar, suspended and unaffiliated identities.
5. Attempt prohibited column reads, table reads, INSERT/UPDATE/DELETE, and cross-school access over actual API requests. Check both 403 errors and filtered zero-row responses as appropriate.
6. Verify `DATABASE_URL` is a restricted non-BYPASSRLS role and all server routes independently authorize tenant membership. Never use a privileged client for user-scoped queries.
7. Validate no unexpected data exposure through RPC, views, storage, joins, service keys, and error messages.
8. Document tests, evidence, rollback, and explicit approval before considering the primary project.

## Current stop condition

**Do not run any staging or production migrations yet.** The immediate next task is to agree on a fresh staging project and resolve the baseline/journal strategy. Local review scripts may be run safely; deployment requires separate explicit approval.
