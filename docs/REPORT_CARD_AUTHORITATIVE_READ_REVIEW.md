# Authoritative report read coordinator — isolated foundation

`src/lib/academics/report-card-authoritative-read.ts` composes existing projection, preflight, enrollment/source and snapshot-readiness policies behind a transaction-bound port. It has no SQL, auth SDK, environment access, routes or application wiring.

Only a report ID is supplied as a request selector. The port must obtain verified server identity, resolve exactly one auth-bound active school membership, scope the report lookup to that school, load class/session assignments, then retrieve the full academic roster and persisted source revisions. Missing/ambiguous membership, bursars and suspended users fail before report data loads. Teachers need exactly one active assignment before academic data loads; administrators do not need a teacher assignment.

The coordinator recomputes results through `prepareReportCard`, requires complete finalized subjects, validates the report's persisted enrollment identity and exact finalized roster, and checks assessment revision consistency before returning a non-publishable projection and snapshot binding. An extra revision read detects drift during loading; it is not a replacement for SQL locks. Errors return a generic failure without exposing database messages.

## Required adapter work before production use

- Implement this port inside one transaction, with verified server authentication and no client-derived identity/role/school authority.
- Lock membership, report, and the authoritative source revision consistently, and hold locks through workflow writes. All academic mutation paths must respect the same revision/locking protocol. Integrating this order with the existing report-first disposable writer remains pending; do not combine them blindly or start a nested transaction.
- Load the complete enrollment set and assigned subject roster with school-scoped queries. The coordinator cannot detect rows omitted by a dishonest or faulty adapter.
- Derive source-version keys from persisted assessment/configuration revisions; opaque keys supplied by a port are not proof of provenance. Confirm a monotonic revision strategy: the current coordinator requires `academic.version`, source revision and stored report assessment version to agree.
- The current assessment model has no separate student-identity collection; enrollment ownership must be joined to the actual student record by the future adapter. Verify schema mappings before writing SQL.
- Wire the coordinator into the transaction port only after independent adapter/concurrency tests. No live source reads or writes are enabled by this change.
- Snapshot hashing/persistence, RLS, guardians, migrations and rollout remain separate gates.

## Verification

Ten new offline tests cover successful scope derivation and recomputation; missing identity; suspended/bursar/foreign-auth/ambiguous membership; foreign or missing report; missing teacher assignment/admin access; duplicate/withdrawn enrollment; wrong term/session; missing scores; missing/unfinalized/foreign/stale sources; revision drift and sanitized read errors. The test is added to the inspected offline allowlist. No dependencies were installed and no database was accessed.


## Disposable SQL read adapter — implementation awaiting PostgreSQL verification

`report-card-postgres-disposable-read-adapter.ts` implements the port against synthetic `read_*` tables in a generated `rc_it_` schema. It is separate from the earlier report writer and is not imported by application routes. An already-open transaction and a server-owned identity callback are mandatory. The callback is fictional in tests; it does not implement Supabase authentication.

Read order is identity guard, school membership, report, assignments, academic scope, enrollment and subject source rows. The identity guard and membership/assignment rows are held `FOR SHARE`; report is held `FOR UPDATE`; academic scope/enrollment/subject rows are held `FOR SHARE`. Queries include school predicates; enrollment reads intentionally include every class for the student's session to expose duplicate active enrollment. Subject version keys are derived from persisted subject/config/source revision tuples. JSONB must already be decoded as an object; stringified JSON is rejected.

Synthetic academic data is still stored as a JSONB scope snapshot, not queried from real Drizzle score/configuration tables. This validates the read boundary, not the production relational mapping. Missing student joins, source provenance, RLS, write-port integration and real authentication remain blockers.

### Writer protocol — required, not enforced globally by this fixture

Membership/assignment mutations (including insertion/deletion) must lock the existing identity guard `FOR UPDATE` first. Academic mutations, including roster/enrollment inserts or deletes, must lock every affected existing academic scope guard `FOR UPDATE` in stable key order before touching rows and increment its revision atomically. An enrollment change affecting multiple class/term scopes must invalidate all affected scopes. These guards are essential because row locks do not protect absent rows from phantom inserts. The fixture has no triggers or grants enforcing this protocol; a direct writer bypass can still violate it. Do not treat these tests as a production concurrency proof.

The standalone disposable writer retains its original report-first entry point. The combined wrapper below acquires identity/membership/report/source locks first, then invokes the writer on the same connection and same report. Do not mix the standalone report-first entry point with the combined protocol in a live environment.

### Verification and local run

The user confirmed the previous coordinator milestone passed the complete offline gate: 199 tests, TypeScript, ESLint with one unrelated unused-import warning, and whitespace. Five new offline SQL-boundary tests cover schema guards, scope/identity preconditions, complete enrollment query scope, persisted version derivation and malformed JSONB/revisions. New PostgreSQL cases are prepared but **not run** by the assistant.

After configuring the same local disposable test variables, run:

```powershell
node --experimental-strip-types .\scripts\report-card-postgres-authoritative-read-integration.mjs
```

The harness accepts only loopback hosts and the disposable database name, creates fictional `read_*` fixture tables in its random schema, and cleans that schema in `finally`. It tests grade recomputation, auth-bound school scope, inactive membership/assignment, enrollment/source/revision rejection, and conflicting SQL updates using transaction-local lock/statement timeouts. Updates must fail with PostgreSQL `55P03` while the reader holds locks, then succeed after the reader commits. Nothing is connected to real student data, production schemas, Supabase or the live writer.


## Combined trusted transaction — pending PostgreSQL verification

The user confirmed the separate read adapter passed the full offline gate (204 tests, TypeScript, ESLint with the existing unrelated warning, whitespace) and all five local PostgreSQL source-read/locking groups on 2026-10-19.

`report-card-postgres-disposable-trusted-transaction.ts` now owns exactly one real `db.begin` for trusted identity, membership, report, assignment, source validation and workflow writes. The existing workflow adapter accepts only a fixed allowlist of two synthetic report table names (`reports`, default unchanged, or `read_reports`). The combined wrapper uses `read_reports` and a transaction-bound bridge that never issues BEGIN or commits. The original report row is re-locked on the same connection; no new report is discovered after source reads.

Only report ID and workflow command are selected from input. Actor/school derive from the trusted reader; a versioned SHA-256 operation fingerprint is generated internally from the copied command fields and report ID. The verified identity and clock callbacks remain test capabilities rather than production authentication. Request-body actor/school/fingerprint fields are ignored.

Crucially, `executeReportTransaction` catches errors and returns denied outcomes. The wrapper throws those outcomes across the outer `db.begin` boundary, forcing rollback of any prior report/audit/receipt/release writes before returning the sanitized outcome. A nested callback that simply returned `transaction_failed` would be unsafe. Offline regression tests explicitly cover this case, one transaction owner, derived actor identity, replay/conflict and missing identity.

The existing authoritative-read integration script is extended with a version column and synthetic audit/receipt/release tables after its original five read-only groups. New pending checks cover competing submissions and duplicate-key races, payload conflicts, audit/receipt/release rollback and retry, a source mutation attempted between report update and audit insertion, and a source-first writer that blocks submission then invalidates the report revision. Transaction-local lock and statement timeouts bound conflicts. These cases have not been run against PostgreSQL by the assistant.

A source-first timed-out read returns generic `read_failed`; the wrapper rolls the whole transaction back. After the source writer commits, a fresh attempt returns `stale_assessment`. There is no automatic retry loop. Replays also revalidate membership and current academic sources first; a previously successful operation may be denied after source revision drift rather than replayed from stale authority.

The fixture academic writer only locks/updates its source scope and subject metadata; it does not attempt a later report lock. Real mutation paths must share a reviewed global lock protocol, including all affected enrollment scopes. Guard enforcement, phantom prevention, real score/config/student joins, canonical immutable snapshots, RLS and live authenticated routes remain pending. Passing the synthetic combined harness will not close all of Phase B or establish production readiness.

Local contributor validation for this batch: 70 Report Cards offline tests, JavaScript harness syntax and whitespace passed. Full project TypeScript/ESLint still require the user's installed dependencies. No database was accessed or dependencies installed by the assistant.
