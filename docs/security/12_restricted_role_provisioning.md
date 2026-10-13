# Restricted PostgreSQL role provisioning — operator review

This tool targets the **existing development Supabase project**, not production. Do not run `--execute` until its SQL has been reviewed and the project owner has approved creating the role. It does not apply migrations or create school records.

## 1. Dry-run (safe)

```powershell
node scripts/provision-restricted-db-role.mjs
```

Uses `MIGRATION_DATABASE_URL` from `.env.local`, performs **two SELECT catalog queries**, and reports whether `greenfield_app` already exists. No password needed for the dry run.

## 2. Operator-only creation (NOT approved by this document)

Once the SQL, Supabase permissions, credential-storage plan, backups, and tests have been reviewed, a human operator can explicitly opt in with `--execute --approve-create-role`. A password of at least 24 characters is required in `GREENFIELD_APP_DB_PASSWORD`. Never paste the password into chat or commit it to Git. Use a secret manager or a local environment variable that is not logged. This is a DDL write to the live database; **do not run during the current dry-run review**.

The operation refuses to change an existing role, creates a non-superuser, non-bypass LOGIN role, and verifies role flags and direct memberships. It intentionally does not grant any tenant-table privileges.

## 3. Follow-up verification

Run `node scripts/audit-database-privileges.mjs` and `node scripts/check-database-connection-roles.mjs`. Audit inherited/default/PUBLIC privileges and role membership, schema grants, function execution, and column-level permissions before considering the role safe. No RLS claims are assumed for direct PostgreSQL sessions.

**Do not update DATABASE_URL or GREENFIELD_VERIFIED_DB_ROLE yet.** The new role will not automatically have a user JWT or tenant scope. Application authorization must continue through the user-scoped Supabase client until a tested access design is in place.
