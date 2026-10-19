# Disposable source-write guards — candidate protocol, not production security

The user confirmed the schema-faithful milestone passed the full offline gate with 239 tests and all seven PostgreSQL integration groups. This follow-up adds candidate source invalidation triggers and five PostgreSQL groups to the same disposable harness. No database was accessed by the assistant.

## Covered protocol

`scripts/lib/assessment-disposable-write-guards.mjs` builds SQL only for a generated `rc_it_` fixture schema. It creates a singleton source-write gate, transaction/scope claims, and fixture-local `SECURITY INVOKER` functions/triggers. It does not open a connection, load secrets, create roles, change RLS/grants or alter production tables.

Covered child/source tables are `assessment_scores`, `assessment_subject_roster`, `enrollments`, `assessment_config_versions` and `assessment_subjects`. Scope creation/update also acquires the gate. Each covered statement acquires an exclusive gate lock in a **BEFORE STATEMENT** trigger, before child-row locks. This ordering matters: a row trigger that locks the gate only after acquiring a child lock can deadlock with a gate-first writer. AFTER ROW triggers determine affected scopes and claim each scope once per transaction before advancing its revision.

- Scores invalidate old/new roster scopes.
- Roster writes invalidate old/new scopes.
- Enrollment writes invalidate all existing term scopes for both old/new school/class/session, not just one selected term.
- Config/catalog changes conservatively invalidate all referencing roster scopes, including historical roster references.
- New scope anchors start at the proposed revision default and are invalidated once by insertion, so the fixture's first revision after guarded creation is 2.
- Covered table truncation and scope deletion are rejected. Source-changing operations must be explicit row mutations.

All source edits within **one owning operation/transaction** advance a scope at most once, even if several score rows/statements change. Separate operations must use separate owning transactions; do not expect per-command increments from several independent commands packed into one transaction. Claim rows are deliberately retained only in this disposable prototype. A production design needs bounded retention or a different safe transaction-local tracking mechanism.

## Phantom prevention and reader obligations

A read transaction must acquire the helper's `readGate` (`FOR SHARE`) **before discovering scopes, rosters or enrollments**, and hold it through the read. Covered writers must wait until that transaction ends, including inserts into previously absent enrollment/scope rows. A read-then-write operation must acquire the exclusive gate up front; do not upgrade shared locks after both transactions have read, which can deadlock.

The singleton gate is intentionally conservative: it serializes fixture source writes across schools and blocks them behind protected reads. It is not a production scalability recommendation. Sharding barriers by school requires a reviewed protocol for multi-school input rejection and complete scope discovery before row locking.

The earlier combined report adapter does **not** automatically acquire this new gate. These new tests validate the candidate fixture protocol independently; the schema-faithful reader/combined adapter must be integrated explicitly before claiming phantom safety for the full report path.

## New PostgreSQL assertions prepared

1. A reader holding the shared discovery gate causes concurrent enrollment and previously absent scope inserts to fail with bounded `55P03` lock timeouts; neither phantom becomes visible. After the reader commits, insertion succeeds and all relevant class/session term scopes advance.
2. A cross-class enrollment move invalidates every old/new class term scope once, even with repeated score writes in the same transaction; an unrelated academic session remains unchanged.
3. A duplicate receipt aborts the whole transaction, restoring enrollment, every affected scope revision and transaction claim rows.
4. Enrollment deletion invalidates the former scopes; covered truncate and scope deletion are refused.
5. Materializing a source version, adding teacher review and finalization does not advance academic source revisions. Payloads remain intentionally synthetic; this is not canonical result/provenance validation.

The original seven constraint/append-only/revision groups remain intact and run before the new source triggers are installed. The new expected total is twelve PostgreSQL groups. Four dependency-free offline guard-builder tests validate identifier rejection, BEFORE STATEMENT ordering, claim/fan-out shape and the absence of role/security-definer changes. They are static checks, not SQL execution.

## Explicit remaining enforcement gaps

- Ownership, restricted roles, RLS, auth identity and operation-specific permissions are not tested. The fixture owner can bypass/drop guards or change the claim/gate tables; no privilege boundary is established.
- Direct child SQL is now invalidation-triggered for the covered tables, but it is not automatically authorized and does not automatically append audit/receipt rows. Complete mutation routines and privilege restrictions remain required.
- Class/level/section activity, session/term dates, school configuration, assignment changes and other parent inputs are not covered by these source triggers. They must either be immutable/restricted in the release design or participate in complete invalidation before live use.
- Discovery of scopes that do not exist yet requires integration with provisioning under the same barrier. The fixture guards scope inserts, but does not infer/create every required scope itself.
- Immutable configurations, source snapshots, review/finalization payload validation and correction policies retain the limits already recorded in the schema proposal. Statement locks do not validate scores, grades or student eligibility.
- Permanent claim retention, handling safe counter limits, transaction retries, lock timeout responses and observability must be resolved before production deployment.

## Verification and next step

JavaScript syntax, four new guard-builder tests and 90 existing scoped domain tests passed locally. The user subsequently confirmed the full offline gate passed with 243 tests and all twelve PostgreSQL groups passed. The next relational source-reader milestone is documented in `ASSESSMENT_RELATIONAL_SOURCE_READER.md`; its new assertions remain pending.

Run the usual offline gate, then the same `scripts/assessment-postgres-schema-integration.mjs` command with the existing dedicated loopback disposable database and explicit opt-in variables. It creates and drops only its own generated schema. After this passes, continue the schema-faithful trusted read/combined adapter integration and remaining parent mutation/role enforcement; do not ask for another routine development go-ahead under the user's standing authorization.
