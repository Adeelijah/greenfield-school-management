# Source and history guards on the upgraded fixture

Date: 2026-10-22. The user's "all tests passed" response to the preceding request is recorded as confirmation of the 481-test full offline gate and all eight upgrade groups. Earlier 64 main fixture groups and eight standalone authority groups remain verified. New guard SQL groups below are prepared, not executed here.

## Prepared composition

`scripts/lib/report-card-upgrade-guards.mjs` composes the existing source-write, authority-parent and release-history builders for an exact generated fixture schema. It adds statement-level immutable-history guards for five assessment history families and three report history families, plus the row-level finalized-config freeze. All seven helper functions use a fixed pg_catalog search path and revoke default PUBLIC execution. The table owner retains its normal execution rights.

Source discovery is installed first, then parent guards, history freeze and one-way release enforcement. Existing source-revision claims ensure an affected scope advances once per transaction across enrollment and parent changes. The new builder performs no SQL, creates no roles or policies, grants no runtime access and imports no driver, configuration or application module.

Review found a defect in the shared fixture parent invalidator: its BEFORE ROW function returned NULL, suppressing the parent UPDATE/DELETE while source revision claims could still commit. It now returns OLD for DELETE and NEW for UPDATE. Existing unit coverage requires those return paths, the upgrade group verifies changed names/RETURNING rows and deletion of an unused level, and the main harness now asserts the committed school final year actually changed. The strict source/authority lock and invalidation rules remain. Both SQL harnesses must be rerun because this helper is shared.

`scripts/report-card-postgres-upgrade-integration.mjs` now applies the guard plan only after its previously verified structural/legacy checks. The structural upgrade still has 31 relations; the source protocol adds two generated helper tables. It uses at most two connections with fixed startup search path, bounded shared-gate readiness and a 200ms contender lock timeout. The lock holder is released/drained before outer cleanup on either success or failure. Exact generated-schema cleanup remains last.

This is a fixture guard installation, not the coordinated production authority/security package. It does not yet install the complete membership helper, shared/exclusive authority advisory protocol, RLS, restricted application roles or real SDK authentication on this upgrade layout. Authority parent writes here coordinate through the existing source gate; do not mistake that for global complete actor resolution or permission enforcement. Table owners/superusers can alter these guards; no owner-bypass resistance is claimed.

Revoking PUBLIC execution is a safe fixture default, not a finished grant plan. A future non-owner academic writer may need narrow helper execution and underlying row privileges, and a report writer needs its reviewed lock/read/transition rights. Those grants and the exact role/ownership map require the next isolated security milestone; no application fallback connection is introduced.

## Five additional PostgreSQL groups

- Roll back a full guard installation and verify that protocol tables, helper functions and data return to the structural baseline.
- Commit guards, inspect enabled history/authority triggers and verify all seven helpers lack PUBLIC execution.
- Create a fictional scope, then combine enrollment and real parent field updates; verify the rows change, an unused parent can be deleted, one revision bump occurs per transaction, and failed enrollment/parent/revision/claim changes roll back.
- Reject zero-row UPDATE/DELETE/TRUNCATE across all eight history families, reject mutation of a populated assessment audit and finalized config, and reject release truncation. The minimal finalized config is only a structural guard fixture, not a valid calculated academic source. Existing full-writer suites remain the evidence for populated report releases and canonical assessment behavior.
- Hold the shared source gate on one session; verify zero-row school, school-user and membership UPDATE statements time out before discovery, then complete once the reader releases. This proves the prepared reader-first cases; it is not a new writer-first or complete-actor membership test.

Expected upgrade total is **13 PASS groups**. Rerun the **64-group main harness** because the parent invalidator is shared and its committed-value assertion was strengthened. The standalone eight authority groups do not use this helper and need no rerun for this batch. No database connection, SQL execution, role creation, migration change, route wiring or deployment occurred here.

## Offline checks and local run

Six new pure guard-composition tests passed alongside 14 existing source/planner tests and five shared authority-guard tests (**25 selected checks**). Script syntax and scoped whitespace passed. The expanded installed gate is expected to report **487 tests across 64 files**; TypeScript/ESLint/full verification and all five new PostgreSQL groups remain pending. No dependencies were installed.

Pull report-cards-foundation and run `node .\scripts\verify-offline.mjs`. Then rerun the credential-cleaning PowerShell block in [REPORT_CARD_UPGRADE_REHEARSAL_REVIEW.md](REPORT_CARD_UPGRADE_REHEARSAL_REVIEW.md#opt-in-local-run); the command remains `node --experimental-strip-types .\scripts\report-card-postgres-upgrade-integration.mjs`. It needs the explicit local disposable URL and test confirmation, with no role-admin token. Expected final output is exact generated-schema cleanup after all 13 groups.

Next after these gates: reconcile least-privilege runtime roles/RLS and complete membership resolution with this upgraded layout in a separately opted-in fixture. Do not install public SQL, enable routes or infer production readiness from this test package.
