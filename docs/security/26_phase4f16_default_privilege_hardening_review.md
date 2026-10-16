# Phase 4F.16 — PUBLIC grants and future default-privilege hardening review

**STATUS: DESIGN / REVIEW ONLY. No remote DDL, no deployable migration, no staging write authorization.**

## Verified inputs

- Current `docs/security/09_consolidated_read_only_review.sql` revokes from `anon, authenticated` on all public tables/sequences, then enables and forces RLS on 12 tables, creates 7 SELECT policies and grants constrained browser reads.
- `scripts/staging-security-assertions.mjs` checks effective table, column and sequence privileges for `anon` and `authenticated` using `has_*_privilege`; this includes effective permissions from `PUBLIC` and inherited roles **for the tested operations**. It does not inspect future default ACLs or public executable functions.
- Staging audit 2026-10-16: no `public` relations/functions, no Greenfield journal; `anon` and `authenticated` do not inherit other roles; `postgres` and `supabase_admin` have broad per-schema default ACLs on tables, sequences and functions in `public`. `PUBLIC` has `USAGE` on schema `public`.

## Initial transaction: risks and decisions

1. **Effective privileges, not grant provenance:** A `REVOKE ... FROM anon, authenticated` cannot remove permissions granted through `PUBLIC` or a role membership. Current effective-access assertions catch many resulting unauthorized table/column/sequence operations and fail closed; preserve those checks.
2. **Do not blindly revoke `PUBLIC` schema USAGE or globally change defaults:** Supabase exposes `public` for API use, and platform-managed objects may depend on standard grants. A blanket `REVOKE ... FROM PUBLIC` across all schemas or default privileges is not approved.
3. **Scope all initial-object revokes:** Before proposing `REVOKE ... FROM PUBLIC`, inspect actual `PUBLIC` table/sequence/function ACLs and compare against the intended Greenfield-only object set. Initial staging has zero public objects; after foundation, the transaction must verify no unexpected objects appeared.
4. **Functions are a separate exposure surface:** The current 12-table foundation is expected to create no public application functions. Add an assertion for zero unexpected executable functions in `public`, or an explicit allowlist with audited signatures and effective `PUBLIC`/`anon`/`authenticated` EXECUTE checks. Do not claim existing assertions cover functions.
5. **Policies require semantics testing:** Policy names/modes alone cannot prove correct tenant isolation. Inspect expressions and conduct real JWT/PostgREST tests after a separately authorized staging deployment, before enabling users.
6. **Post-commit default privileges remain broad:** Current foundation grants may be constrained before commit, but the default ACLs will affect future objects. Require future migrations to apply object-scoped REVOKEs/RLS in the **same transaction** and verify final effective grants, until a separately reviewed default-ACL change is approved.

## Proposed default-privilege hardening (not executable SQL)

- Identify all object-creating roles and owners for future Greenfield migrations, including whether objects are created by `postgres` or `supabase_admin`; confirm exact `pg_default_acl` scope.
- Audit Supabase compatibility before changing any defaults; `ALTER DEFAULT PRIVILEGES FOR ROLE ... IN SCHEMA public` only affects objects subsequently created by that role and does not retroactively revoke existing object grants.
- Design least-privilege defaults for **Greenfield-created** tables/sequences/functions while retaining explicitly required Supabase behavior. Prefer a dedicated object-owning migration role if feasible and approved.
- Rehearse proposed changes in an isolated Supabase-like environment with both creating roles and verify defaults for newly created table, sequence and function using `has_*_privilege`; validate `PUBLIC`, `anon`, `authenticated`, `service_role`, inherited grants and expected application access.
- Do not issue `ALTER DEFAULT PRIVILEGES` against staging as part of the current reviewed 91-statement transaction. Any additional SQL changes require a new fingerprint, new local tests, new review and explicit approval.

## Required acceptance criteria before remote write authorization

- [ ] Expand fail-closed local assertions for public function exposure, object inventory, and effective privilege coverage including `MAINTAIN` where supported; preserve current assertions and tests.
- [ ] Inspect current effective `PUBLIC` access, including schema/table/sequence/function ACLs and defaults, without writes.
- [ ] Confirm backup limitations, recovery owner and forward-fix procedure; record acceptance of recovery risk or arrange stronger backup.
- [ ] Verify revised SQL and assertions in disposable local transaction with rollback and Drizzle journal consistency.
- [ ] Review final code revision and separately authorize `greenfield-staging` deployment. No such approval is implied by this review.

## Decision

**Initial deployment: BLOCKED. Future default-privilege hardening: PROPOSAL ONLY.** No privilege changes are authorized. Refer to `docs/security/23_phase4f11_staging_runner_contract.md`, `docs/security/24_phase4f13_backup_recovery_gate.md` and `docs/security/25_phase4f15_deployment_readiness_review.md`.
