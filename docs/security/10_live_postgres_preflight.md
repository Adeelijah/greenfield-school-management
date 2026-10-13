# Live PostgreSQL security preflight (read-only)

This is the first **live database inspection**, not an RLS integration test.
It does not create tables, apply migrations, insert fixtures, run transactions,
authenticate JWTs or impersonate users. It only reads PostgreSQL catalogs.

Run in PowerShell from the repository root:

```powershell
git pull origin main
node scripts/postgres-security-preflight.mjs
```

The script reads `MIGRATION_DATABASE_URL` from `.env.local`. Do not paste
credentials or your full connection URL into chat. The output includes database
name, database role, table/policy names and grants; review it before sharing.

A nonzero exit is **expected** while the initial schema and RLS are not yet
applied. Do not run `npm run db:migrate` to make this check pass.

## Before real multi-tenant integration tests

1. Use a disposable, isolated PostgreSQL/Supabase test environment, not the
   current development project with its Auth test account.
2. Review the immutable foundation migration, auth.users FK and consolidated
   RLS as one ordered migration; ensure policies and grants are not additive.
3. Verify that `authenticated` has only intended column-level privileges.
4. Seed fictional schools, students, guardians and users using operator-only
   fixtures with reliable cleanup and a separate test Auth project.
5. Run authenticated requests with real JWTs, and assert allowed/denied
   school, role, row and column access. Test unauthorized writes.
6. Separately test all server-only queries using their actual database role.
   PostgreSQL superusers and BYPASSRLS roles bypass RLS, including FORCE RLS.
7. Test failed provisioning rollback, duplicate provisioning and last-admin
   protection with actual transactions.

**Current blockers:** foundation not applied, auth FK missing, RLS review-only,
server connection may be privileged, and no JWT-backed integration harness.
