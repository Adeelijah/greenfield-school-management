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
