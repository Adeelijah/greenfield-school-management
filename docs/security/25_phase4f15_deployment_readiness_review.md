# Phase 4F.15 — Final staging deployment safety review

**Decision: NOT AUTHORIZED FOR REMOTE WRITES.** This document records operator-reported evidence and remaining gates; it is not a deployment runner or approval. Target: `greenfield-staging`, Supabase project ref `hweoqkbgmzycyznrbvng`.

## Evidence received (16 October 2026)

- Operator connected successfully using session pooler `aws-0-eu-west-1.pooler.supabase.com:5432`, username `postgres.hweoqkbgmzycyznrbvng`, database `postgres`; server reported PostgreSQL 17.11. This is strong target-context evidence but not independent proof of the backend project identity.
- Read-only `information_schema.tables` query returned **zero visible public base tables**. Prior audits reported no Greenfield migration journal. A full fresh inventory of views, sequences, policies, extensions and journal is still required.
- Custom-format, schema-only `public` archive (1,652 bytes) at operator-local `C:\Users\USER\Greenfield-Staging-Backups\greenfield-staging-predeployment-retry.dump`; SHA-256 `369BA09F690E4DB99889843B4D9F006FFCAB8F31678D2EC383A01D585387FD2B`. Generated with `--no-owner --no-acl`; contains `CREATE SCHEMA public` and schema comment only.
- Archive parsed with `pg_restore --list`, then successfully restored with `--clean --if-exists --single-transaction` **only to local** `greenfield_disposable_restore_test`. Local check found `public` with comment `standard public schema` and zero base tables. An earlier `--schema=public` invocation was not a valid restore test and is superseded.
- Read-only security inventory: `greenfield-staging-security-inventory-20261016.txt`, 3,413 bytes, SHA-256 `5E1617EA59E8B5EE200D35B4D902ACDFF61C970A763311F02507FF5595FF3A06`. Operator reviewed: `public` schema USAGE for API roles; six broad `public` default ACL records for objects created by `postgres` and `supabase_admin` (tables, sequences, functions); no public tables/functions; `anon` and `authenticated` without BYPASSRLS, `service_role` with BYPASSRLS.
- Operator-local `greenfield-staging-recovery-manifest.csv` contains the two correct file names, sizes and hashes. Files and manifest are **not** committed to Git.

## Recovery boundary

**Proven:** a small schema-only `public` archive is readable and restores its schema/comment in an isolated local PostgreSQL 18.6 database.

**Not proven:** restoration of ownership, ACLs, default ACLs, data, Drizzle journal, roles, Supabase Auth/Storage/Realtime or project configuration; successful restoration of application data after deployment; managed point-in-time recovery; recovery from post-commit data loss. The security inventory is descriptive text, **not** executable restore material. Operator reports no Supabase-managed backups. No encryption-at-rest/access-control verification or tested recovery-time objective has been recorded. Treat the snapshot as baseline evidence, **not** a complete disaster-recovery mechanism.

## Reviewed deployment safeguards

1. Require explicit, separately documented operator approval specifying `greenfield-staging`, runner revision and reviewed SQL fingerprints. Conversational permission to continue planning does not authorize writes.
2. Reconfirm endpoint/project identity, PostgreSQL role, `auth.users`, `auth.uid()`, all existing `public` objects and migration journal; abort on any unexpected state. Never infer identity solely from `current_database()`.
3. Use only a dedicated, reviewed staging connection; do not consume `.env.local` or migration environment variables implicitly; do not log secrets.
4. Pin ordered foundation SHA-256 `c8f61c5f702ae6ebad9cc2950edb1d4a288eb2a2613281cdc612167b711cba62` and matching migration journal metadata; validate all additional reviewed SQL against committed files.
5. If separately authorized later, apply foundation -> Auth FK -> security -> privilege assertions -> Drizzle journal in **one transaction on one connection**; any precommit error rolls back. Confirm 12 ENABLE/FORCE RLS tables, seven reviewed policies, FK, and effective role/table/column/sequence privileges including PUBLIC and inherited access before commit.
6. Never auto-drop deployed objects after commit. Prepare a forward-fix decision tree and recovery owner; if recovery coverage is insufficient, obtain explicit risk acceptance or delay deployment.

## Post-deployment acceptance tests (future; no execution approved)

- Read-only catalog inventory and journal/hash consistency.
- Real Supabase JWT/PostgREST tests with anon, authenticated users in two separate tenants, suspended/nonmember users and owner/admin/member roles; verify permitted reads and denied cross-tenant reads/writes.
- Verify browser credentials cannot perform direct writes, including column/sequence paths, and server-side service-role paths enforce explicit authorization and tenant scoping.
- Verify audit events, last-owner protection, onboarding and sign-in callbacks, and regression suite. Do not enable users until all acceptance checks pass.

## Open gates and next actions

- [ ] Confirm backup file access restrictions and encrypted storage, without uploading secrets or archive to Git.
- [ ] Capture complete fresh **read-only** object/role/default-privilege inventory and compare with preflight expectations.
- [ ] Document realistic recovery-point/time limits and obtain explicit operator acceptance of no managed backups; consider a stronger verified backup path before deployment.
- [ ] Review final runner implementation and immutable code revision, transaction assertions, and forward-fix plan.
- [ ] Obtain **new explicit authorization** for the exact target and revision. Until then: **NO REMOTE WRITES**.

Existing contracts: `docs/security/23_phase4f11_staging_runner_contract.md` and `docs/security/24_phase4f13_backup_recovery_gate.md`.
