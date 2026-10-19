# Disposable PostgreSQL integration testing — opt-in gate

The first harness is `scripts/report-card-postgres-disposable-smoke.mjs`. It uses the existing `postgres` dependency, requires **both** an explicit URL and confirmation token, and rejects any database name other than `greenfield_report_cards_disposable` (or that name with a suffix). It does **not** load application environment files. The test creates only PostgreSQL temporary tables, tests conditional optimistic-version updates, and verifies a savepoint rollback. It does not modify Greenfield application tables.

## Prerequisites

Create a **separate disposable PostgreSQL database** under your control. Never use Supabase development, production, staging, or a shared database, even if renamed to match the allowlist. Database naming is a guard, **not proof** of isolation. Review the hostname, project, credentials and database name before running. Use a least-privileged account that cannot modify production or application schemas.

Example for Windows PowerShell (substitute credentials for your isolated local/disposable database; do not paste passwords into chat):

```powershell
$env:REPORT_CARD_TEST_DATABASE_URL = 'postgresql://TEST_USER:TEST_PASSWORD@localhost:5432/greenfield_report_cards_disposable'
$env:REPORT_CARD_TEST_CONFIRM = 'DISPOSABLE_REPORT_CARD_TEST_ONLY'
node .\scripts\report-card-postgres-disposable-smoke.mjs
Remove-Item Env:REPORT_CARD_TEST_DATABASE_URL
Remove-Item Env:REPORT_CARD_TEST_CONFIRM
```

No application migrations or Report Cards schema are applied by this script.

## Coverage and limits

This first smoke harness exercises actual PostgreSQL temporary-table transaction semantics, optimistic compare-and-swap and savepoint rollback. It **does not** exercise the Report Cards transaction port against real tables, concurrent clients, idempotency uniqueness collisions, RLS, tenant policies, immutable snapshots or guardian release authorization. Those require an isolated test schema and fixtures after reviewing the schema proposal and permission boundaries.

Do not set the test URL to an existing Greenfield database. Do not use `db:migrate` or Drizzle Kit with the proposal file. The normal `node scripts/verify-offline.mjs` remains entirely database-free.

## Concurrency suite (second stage)

After the two smoke tests pass, use the **same separately created disposable local database** and the same opt-in environment variables to run:

```powershell
node .\scripts\report-card-postgres-concurrency.mjs
```

The suite creates a uniquely named `rc_it_...` schema, uses two concurrent transactions against the same locked report row, and removes the schema in `finally`. It checks competing versions, same-key replay, fingerprint conflict, explicit school-scoped lookup, rollback after injected failure, and approval-before-publication with competing release attempts.

**Limitations:** The test schema is a deliberately minimal model, **not** the actual proposed Drizzle Report Cards schema. This is not an implementation of `ReportTransaction` and does not exercise trusted authentication, verified class assignments, authoritative assessment source reads, RLS, snapshot hashing, immutable records or guardian access. Passing this suite proves PostgreSQL concurrency primitives in the disposable database, not production readiness. The schema cleanup uses `DROP SCHEMA ... CASCADE` only for its generated `rc_it_` schema; never use this script against any shared or application database. Test run results must be checked locally; committing the script does not mean it has run.
