# Disposable PostgreSQL transaction-port adapter — integration boundary

`src/lib/academics/report-card-postgres-disposable-adapter.ts` implements the existing `TransactionRunner` interface with SQL statements and a caller-supplied trusted loader. It uses a generated `rc_it_<16 lowercase hex>` schema, row locks, optimistic conditional update, append-only inserts and the driver's `begin` transaction callback. It is **not** imported into the app and is not a production adapter.

## Critical security boundary

The loader must supply an independently verified membership, teacher-class assignments, enrollment and finalized assessment projection from trusted database state under appropriate locks. **A caller-provided fake loader does not prove authentication or source integrity.** The adapter currently stores `ReportRecord` as JSONB in a disposable simplified schema, not in the proposed real Drizzle table columns. It does not perform canonical snapshot creation, enrollment/source validation, RLS, guardian authorization or production publication. `appendRelease` writes only to a disposable table and must never be used for real publication.

The adapter expects these isolated fixture tables in the generated schema:
- `reports(school_id text, id text, version integer, record jsonb)`, with composite primary key.
- `receipts(school_id text, actor_id text, operation_key text, report_id text, fingerprint text, resulting_version integer)`, with unique (school_id, actor_id, operation_key).
- `audits(school_id text, report_id text, version integer, payload jsonb)`.
- `releases(school_id text, report_id text, version integer, published_at text)`.

These differ from the earlier simplified concurrency suite; **do not point the adapter at those tables without a matching fixture harness**. The adapter has not yet been exercised by a PostgreSQL integration test and is not ready for application wiring.

## Next review gates

1. Add a disposable fixture harness that invokes `executeReportTransaction` using this adapter, with trusted fictional rows loaded from PostgreSQL rather than browser data.
2. Test concurrent duplicate keys, rollback and isolation through the actual port.
3. Implement authoritative enrollment/source gates and canonical immutable snapshots inside the transaction.
4. Resolve the reviewed Drizzle schema constraints and RLS/guardian policy before any migration or production use.

No migration, production database connection, deployment or merge is part of this change.
