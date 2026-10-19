# Published report revocation and correction policy

Status: pure, offline policy proposal only. No SQL, schema, route, grant, RLS or live authorization changed. User verified all 45 PostgreSQL groups before this batch. Latest explicitly confirmed full offline count remains 337; the 345-test gate result has not been supplied.

## Chosen correction behavior

An active administrator in the same school may withdraw a published report with a mandatory trimmed reason (1–2000 characters). The administrator may withdraw their own publication. Teachers, bursars, suspended and foreign-school actors are denied. The command includes only action, report ID, exact release ID, expected version, operation key and reason; additional authority fields, getters, symbols, unknown actions and malformed values are rejected.

`planReleaseCorrection` requires a structurally valid published report, exactly one active release, the pinned approved snapshot and complete school/report release rows. It checks optimistic version, snapshot/report/enrollment/scope/source/revision bindings, unique release identities and publication versions, canonical UTC timestamps and chronological ordering. The release must identify the current publication and the snapshot version immediately before it. A future persistence adapter must supply locked trustworthy rows; the pure function neither authenticates nor proves discovery completeness or canonical snapshot content.

The planned atomic change is:

- Set the exact active release revoked_at once, retaining its original publisher, timestamp, report version and snapshot references.
- Advance report version and return to draft; clear submitter, approver, publication time and current return reason.
- Retain report identity/enrollment/scope and its old source pin for provenance; do not alter or delete any snapshot or previous release.
- Append an immutable revoke audit event with required reason, actor, release ID, approved snapshot ID/version, before/after report versions and timestamp.

Withdrawal deliberately requires no fresh academic source: an invalidated assessment must not block removal of an incorrect publication. Subsequent teacher submission must use the existing complete-current-source refresh path, followed by independent approval and publication of a new snapshot/version. No direct published-to-approved or immediate replacement publication is allowed. The existing pure guardian visibility rule hides the planned draft/revoked state, but no guardian endpoint is enabled by this policy.

## Required persistence follow-up

The current schema and writer do not yet support revoke audit events or this atomic operation. Preserve the passing writer/security harness. Prepare reviewed audit fields/composite FKs to bind the exact historical release and snapshot, add reason/action checks and one-way release-revocation guards. Do not just add unrestricted UPDATE on releases. Restrict the changed release columns, prevent edits to original publication facts, repeated timestamp changes or restoration of a revoked release, and prevent deletion/truncation. Preserve append-only audit/receipt/snapshot semantics and the active-release unique index.

The future transaction must use verified server identity and the shared actor-key lock protocol, lock the report then discover/lock its release and snapshot, and serialize competing revoke/publish/correction operations. Server-derived fingerprints include school, actor and normalized action/report/release/version/reason. Existing identical durable receipts replay historical outcomes before applying fresh transition checks; reused keys with changed intent or another command family conflict. The pure planner intentionally has no receipt/replay branch: invoking it again after application produces stale-version/transition denial unless the outer persistence boundary first resolves a valid replay. Suspended/foreign actors must still be denied on replay.

Persist report/release changes, immutable audit and receipt atomically. Add actual PostgreSQL and restricted-role rollback, retry/replay, stale source, substituted release/snapshot, duplicate active release, monotonic revocation, second correction and old-history preservation tests. Add independent-session concurrency and least-privilege login checks before production readiness. No production execution or deployment is authorized here.

## Offline verification

Twelve new tests cover successful planning, role/tenant denials, command injection/malformed inputs, published-only transition, stale/overflow/competing versions, ambiguous active releases, release and snapshot substitutions, timestamp and actor invariants, retained historical releases, immutable inputs and guardian visibility. All 38 selected policy/workflow/writer tests, script syntax and whitespace passed here. Expected full offline count: 357. Full TypeScript/ESLint remain pending the local gate. PostgreSQL harness remains the user-verified 45 groups and needs no rerun for this pure-only batch.
