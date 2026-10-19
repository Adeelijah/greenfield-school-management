# Actual fixture revoke writer and restricted correction lifecycle

Status: prepared, not database-executed here. User verified all preceding 48 PostgreSQL groups. Latest explicitly confirmed full offline count is 357; the 364-test gate result has not yet been supplied. No production schema, migration, route, connection, auth or deployment changed.

## Transaction adapter

`executeFixtureReportRevocation` owns its transaction. It normalizes a strict six-field command, resolves verified identity through the shared source-gate/exclusive-actor anchor, requires an active school admin, locks the school/report row, resolves the actor-wide receipt key, locks report release history and reads the exact approved snapshot pin. It invokes the pure correction planner for new operations. No current academic source load or old teacher/publisher authority check blocks withdrawal.

A new operation conditionally changes only the exact active release revoked_at, optimistically advances the published report to draft, clears current submitter/approver/publication fields, and appends a bound revoke audit plus durable receipt. All post-write failures escape begin; generic error mapping happens after rollback. The snapshot is never rewritten. School/report/enrollment/scope/source pins are retained. Server fingerprints bind normalized command, school and actor using the revoke namespace, preserving global actor-key conflicts with other writer families.

Identical durable receipts replay after later report/source changes, before fresh-state transition checks. Replay rechecks active admin identity, stored outcome/report/release/snapshot/version/timestamp, the retained revoked release and exact immutable reason/actor audit. Changed reason, target or version conflicts. Missing/malformed outcome, pin or audit fails closed. The original release/snapshot remains the historical replay target after republishing a new version.

This is a trusted server fixture adapter, not a route, end-user SQL API, production authentication or proof of snapshot academic correctness. Withdrawal checks immutable structural pins without recalculating possibly invalid/stale source content. Full canonical source verification remains mandatory for later submission/approval/publication.

## Narrow fixture permissions

The security builder now includes the one-way release-history guards whenever it prepares grants. It removes writer UPDATE(id) on releases, grants only UPDATE(revoked_at), adds fixed-school revoke WITH CHECK, and permits that operation through the statement guard. Reader mutation remains denied. Snapshot/audit/receipt records remain insert-only, release original fields and restoration remain forbidden, and all delete/truncate privileges remain absent. Guard functions have PUBLIC EXECUTE revoked. Database service roles still trust server action authorization; school RLS does not itself distinguish an admin from a teacher using the same service connection, or force every raw owner mutation to have an audit/receipt.

## Prepared PostgreSQL additions

Five additional groups raise the opt-in harness from 48 to 53:

- Restricted actual revoke adapter: release/report/audit/receipt failure rollback, same-key retry/replay, reason conflict, teacher denial and release restoration rejection.
- Restricted correction cycle: resubmit, independent approve and republish a new snapshot, retaining old snapshot/release and old revoke replay.
- Second restricted correction: separate revoke event per publication with no active or resurrected old release.
- Outer actual writer: concurrent same-key calls apply once and replay once, changed intent conflicts, historical publication receipt still replays after withdrawal/source changes.
- Outer actual writer: every persistence failure rolls back all report/history state and a stale-source publication can be withdrawn on same-key retry.

Restricted setup remains one intentionally rolled-back role/policy/workload transaction with current_user checks and application savepoints. Separate-session concurrency is exercised for the outer writer under the owner fixture; it is not proof of restricted-role concurrent sessions. Optional mode now runs ten restricted groups plus 43 owner groups (53 total). Ordinary mode runs 43 owner groups and explicitly skips ten restricted groups. The existing complete admin URL/confirmation/cleanup block still applies.

Ten adapter unit tests and two privilege-plan tests raise expected offline count to 376. The shared fictional SQL transaction simulator now models release updates/history reads and revoke audit lookup; rollback restores its cloned store. All 62 selected offline tests, script syntax and whitespace passed here. Full TypeScript/ESLint and the new SQL groups remain pending local verification; no SQL was executed by the assistant.

## Remaining gates

After both local gates pass, close restricted independent-session concurrency and real least-privilege login/authority handling without persisting unwanted test roles. Reconcile the fixed-school fixture model with the actual server connection/auth strategy and global membership ambiguity policy. Then add a controlled server read/command boundary before route/UI integration and browser QA. Guardian endpoints, exports/display-name provenance, operational readiness, deployment and production release remain separate later milestones. Preserve existing no-merge/no-production restrictions.


## Fixture timestamp repair — 2026-10-19

The user ran the expanded harness: the first 51 groups passed (including all ten restricted-role groups and the three binding/history groups), then the owner concurrent-withdrawal group returned invalid_release twice. This is not a passing 53-group result; the final outer failure group was not reached.

Root cause: the earlier active-release/reopen guard test temporarily restaged its published report as approved, then restored published_at with now(). That changed report publication provenance while the immutable release retained its actual released_at. The new correction planner correctly requires exact equality and rejected the damaged fixture.

The guard test now saves the original published_at, restores that exact timestamp in finally, and immediately asserts equality with the active release. No application validation, security rule or revoke behavior is weakened. One new unit regression verifies that a mismatched timestamp is rejected without mutation and restoring the original permits withdrawal. All 63 selected offline tests, script syntax and whitespace passed here. Expected full offline total is 377; PostgreSQL expectation remains 53 and must be rerun. No SQL was executed by the assistant.
