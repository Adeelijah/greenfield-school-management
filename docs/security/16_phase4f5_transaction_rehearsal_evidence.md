# Phase 4F.5 — Local secure transaction rehearsal evidence

**Result: PASS — local PostgreSQL only. Staging remains unapproved.**

Operator-run command: `node scripts/rehearse-secure-staging-transaction.mjs --execute-local-rollback`

Target: `greenfield_disposable_validation` (local PostgreSQL, disposable). Foundation inventory: 55 statements; consolidated security inventory: 35 statements.

## Observed results

- Injected failure after foundation creation: transaction rollback verified.
- Complete foundation + Auth FK + RLS/grants rehearsal: transaction rollback verified.
- Before security: simulated default privileges allowed `anon` SELECT and `authenticated` INSERT.
- After security: 12 FORCE RLS tables, 7 policies, one `school_users` Auth FK.
- After security: `anon` school SELECT denied; `authenticated` school INSERT denied; student date-of-birth SELECT denied; authenticated school SELECT granted (row access remains subject to RLS).
- `supabaseChanged: false`; `stagingApproved: false`.

## Boundaries and unresolved blockers

This was a transactional SQL rehearsal with a local Auth stub, not a real Supabase JWT/PostgREST test. The rehearsal intentionally rolled back; it does not validate a committed Drizzle journal in the same atomic deployment. It does not verify all Supabase default grants, roles, inherited privileges, RPC exposure, API routing, or server-side tenant authorization. The earlier local migration-runner test separately verified Drizzle journal idempotence, but **not** combined migration-journal + security atomicity.

Before staging execution: design and test the exact tracked combined deployment mechanism (including migration journal), resolve the contradictory Auth FK/security document ordering, audit Supabase effective grants and Data API exposure, and obtain explicit operator approval. No Supabase SQL changes authorized.
