# Supabase Auth FK and migration sequencing

**Status: review only. No database changes applied.**

## Why the FK is separate
Supabase owns `auth.users`. Greenfield's Drizzle schema currently stores `school_users.auth_user_id` as a unique UUID without a foreign key. Adding an external auth table to the Drizzle schema without carefully configuring migrations risks generating unwanted SQL for a Supabase-managed table.

For now, the reviewed FK is a separate SQL proposal, **not** a Drizzle migration or an instruction to run SQL manually. The application can continue to build with the existing Drizzle schema. The proposed FK uses `ON DELETE RESTRICT` to avoid cascading deletion of school memberships; account removal will need a controlled deprovisioning workflow.

## Before staging
1. Verify whether the locally generated `drizzle/0000_*.sql` migration and `drizzle/meta/_journal.json` exist and whether they were committed. Never regenerate over an already-applied migration.
2. Confirm the target database is a **disposable staging Supabase project**, not the primary Greenfield project.
3. Review the initial schema, auth FK, RLS, grants, definer helper privileges, and administrator bootstrap as one security unit.
4. Decide whether school-specific databases or a shared multi-tenant database is the deployment model. Existing code uses school_id scoping and assumes multiple schools can coexist.
5. Build and execute nonprivileged, multi-tenant authorization tests and verify privileged server-side query paths separately.
6. After staging baseline migration, run the read-only FK preflight; proceed only with zero orphans and no duplicate FK.
7. Apply the reviewed FK as a tracked migration with journal consistency; never paste it ad hoc into the primary project's SQL editor.
8. Re-run identity provisioning, delete restriction, and cross-school security tests.
9. Prepare a documented production change window, backup, rollback, and explicit operator approval before touching the primary project.

## Existing app behavior
- Authenticated user with no active membership remains on Access pending.
- The existing direct database connection may be privileged; **RLS alone is not a security boundary for that connection**.
- Never create an initial admin by accepting an unverified email or client-provided user id.
- Do not run `npm run db:migrate` yet.

## Local review commands
```powershell
git pull origin main
npm run typecheck
npm run build
Get-ChildItem .\drizzle -Recurse -File -ErrorAction SilentlyContinue | Select-Object FullName
git status --short
```
Share filenames and build output only; no credentials, SQL result rows containing user data, or environment variable values.
