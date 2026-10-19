# Disposable PostgreSQL transaction-port adapter — integration boundary

`src/lib/academics/report-card-postgres-disposable-adapter.ts` implements the existing `TransactionRunner` interface with SQL statements and a caller-supplied trusted loader. It uses a generated `rc_it_<16 lowercase hex>` schema, row locks, optimistic conditional update, append-only inserts and the driver's `begin` transaction callback. It is **not** imported into the app and is not a production adapter.

## Critical security boundary

The loader must supply an independently verified membership, teacher-class assignments, enrollment and finalized assessment projection from trusted database state under appropriate locks. **A caller-provided fake loader does not prove authentication or source integrity.** The adapter currently stores `ReportRecord` as JSONB in a disposable simplified schema, not in the proposed real Drizzle table columns. It does not perform canonical snapshot creation, enrollment/source validation, RLS, guardian authorization or production publication. `appendRelease` writes only to a disposable table and must never be used for real publication.

The adapter expects these isolated fixture tables in the generated schema:
- `reports(school_id text, id text, version integer, record jsonb)`, with composite primary key.
- `receipts(school_id text, actor_id text, operation_key text, report_id text, fingerprint text, resulting_version integer)`, with unique (school_id, actor_id, operation_key).
- `audits(school_id text, report_id text, version integer, payload jsonb)`.
- `releases(school_id text, report_id text, version integer, published_at text)`.

These differ from the earlier simplified concurrency suite; **do not point the adapter at those tables without a matching fixture harness**. The original six integration groups passed in the user’s local disposable PostgreSQL 18 database on 2026-10-19. The adapter is still not ready for application wiring.

## Next review gates

1. Retain the passing disposable fixture harness and JSONB round-trip checks.
2. Confirm the expanded denial, receipt-conflict and audit/release failure/retry tests locally.
3. Implement authoritative enrollment/source gates and canonical immutable snapshots inside the transaction.
4. Resolve the reviewed Drizzle schema constraints and RLS/guardian policy before any migration or production use.

No migration, production database connection, deployment or merge is part of this change.

## PostgreSQL port integration harness

`scripts/report-card-postgres-adapter-integration.mjs` now creates disposable fixture tables and invokes **`executeReportTransaction` via `disposableReportTransactionRunner`**. It loads fictional memberships, class assignments and assessment projections from the disposable PostgreSQL transaction itself. It tests conflicting submissions, same-key replay, cross-school membership rejection, receipt-failure rollback, and approval/publication serialization.

Use the same `REPORT_CARD_TEST_DATABASE_URL` and `REPORT_CARD_TEST_CONFIRM` as the earlier disposable smoke tests, then run:

```powershell
node --experimental-strip-types .\scripts\report-card-postgres-adapter-integration.mjs
```

The user reported all six original integration groups passing after commit `3d7f54c`: fixture JSONB round trips, concurrent submissions and JSONB writes, duplicate-key replay, cross-school membership rejection, receipt-failure rollback, and approval/single publication. This was a user-run PostgreSQL 18 check, not a database run by the assistant. The newly expanded cases have not yet been run against PostgreSQL. Fixture memberships and projections are fictional and inserted by the test harness; they do not establish real production authentication, authoritative enrollment, canonical snapshot persistence, RLS or guardian access. The test harness creates and removes only its randomly generated `rc_it_...` schema inside the explicitly named disposable database.


## Expanded Phase A coverage — pending local PostgreSQL verification

The harness now checks exact rejection codes and compares all report, audit, receipt and release rows before/after denied operations. New cases cover an existing other-school report ID, missing actor, missing assignment, suspended membership, stale command/source revisions, invalid approval stage, conflicting receipt fingerprints, audit insertion failure, and release insertion failure. Audit, receipt and release failures are followed by retry and replay with the same operation key to check rollback does not poison idempotency or duplicate publication. All data remains fictional; only generated disposable tables are altered.

Local contributor verification: JavaScript syntax check and 51 existing Report Cards offline tests passed. The expanded SQL cases remain unverified until the user reruns the harness. No production schema, application wiring, credentials, RLS or migrations were changed.
