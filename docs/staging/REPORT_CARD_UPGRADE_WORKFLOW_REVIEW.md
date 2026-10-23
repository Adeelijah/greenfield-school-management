# Real report commands on the upgraded restricted layout

Date: 2026-10-23. The user confirmed the full 499-test offline gate and all 22 upgrade groups, including actual generated LOGIN isolation and exact schema/role cleanup. Main 64 and standalone authority eight remain verified for their existing fixtures.

## Prepared workload

`scripts/lib/report-card-upgrade-workflow-probe.mjs` extends the existing opt-in upgrade rehearsal after its generated LOGIN authority checks. It receives the already authenticated restricted pool; it has no connection factory, application environment lookup or owner fallback. Every command transaction checks session_user, exact writer role and backend PID, then calls the real complete-authority outer boundary and the existing real workflow, canonical approval/publication or revocation adapter.

The setup connection creates a separate fictional Primary 5 class, independent level/section, session/term, teacher membership/assignment, pinned finalized Mathematics configuration and two active pupil enrollments/scores. It does not infer or backfill the earlier legacy class. The setup transaction owns the exclusive source gate before reading candidates. The actual complete relational reader/materializer creates canonical source and results documents, teacher review and independent admin finalization; no hard-coded trusted manifest, total or hash substitutes for calculation. A subsequent restricted read verifies the complete documents and exact rounded totals 86.00 and 70.00.

Five additional SQL PASS groups are prepared:

1. Complete two-pupil relational/canonical source and persisted JSONB verification through the actual LOGIN-selected writer.
2. Two distinct LOGIN backends concurrently create and submit the same operation keys. Each pair must apply once and replay once, with exactly one audit/receipt increment and one report creation where appropriate. Changed submission fingerprint is denied without writes.
3. Independent admin approval and publication pairs, each with distinct backends, produce one approved pupil-specific snapshot and one release. Teacher approval is denied. Publication reuses the approved snapshot and excludes the other pupil's enrollment from its payload.
4. The second pupil exercises all seven actions, including return, resubmission and approved reopen. Failures injected immediately after actual report/snapshot/audit/receipt/release writes must restore all five report tables exactly. Identical keys then apply and replay without additional writes. Reopen preserves the first snapshot and the next approval creates another. An outer rejection after a successful inner create must also roll back before same-key retry.
5. An edit to the other pupil's score invalidates the source. A new submission fails without report writes, while historical publication replay and concurrent stale-source withdrawal remain available to the authorized admin. Ended teacher assignment and suspended admin membership deny historical receipt access; reactivation permits unchanged historical replay. All snapshot rows remain byte-equivalent after JSON serialization throughout these operations.

Injected failures in group four are adapter exceptions after successful SQL writes, rather than deliberately generated PostgreSQL constraint failures. They test rollback of already executed writes and the outer boundary's rejected-outcome behavior. Existing constraint/SQL failure suites remain separate. Pair rendezvous requires distinct PIDs; each command checks exact count increments and an additional replay with unchanged history. These tests use trusted fixture identity callbacks and do not authenticate a real cookie, JWT or Supabase RPC request.

## Verification and limits

All 37 existing selected source/guard/security/LOGIN tests and syntax checks passed here. No offline allowlist or application TypeScript source changes; full offline expectation remains **499 tests across 66 files**. New workload groups have not been database-executed here. The user must run the opted-in disposable rehearsal; expected total with both confirmations is now **27 PASS groups**, including final cleanup. Without role-admin confirmation, 14 security/LOGIN/workflow groups are explicitly skipped and only the original 13 ordinary groups run.

Run the full existing password-prompt PowerShell block with `REPORT_CARD_TEST_CONFIRM=DISPOSABLE_REPORT_CARD_TEST_ONLY` and `REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM=DISPOSABLE_ROLE_ADMIN_TEST_ONLY`, using `node --experimental-strip-types .\scripts\report-card-postgres-upgrade-integration.mjs`. Running the node command alone after cleanup skips execution. The outer harness still closes the restricted pool before its acknowledged exact schema/four-role cleanup, checks absence, and propagates workload or cleanup failure. No broad cleanup or crash-safe guarantee is added.

No migration journal, public SQL draft, production schema, live authentication, configured application role, request route, UI or deployment changes. The main 64 and standalone eight harnesses are unchanged and need no rerun solely for this batch. Next after the expanded upgrade gate: controlled verified server-request integration with explicit runtime mapping; actual SDK authentication and an approved staging installation remain outstanding.


## User-verified completion — 2026-10-23

The user confirmed the requested full offline 499/499 and all 27 opted-in upgrade groups passed after commit 86db6b95bfc9840a63e81f99af4046af6f204463. The five workload groups above and final generated schema/role cleanup are now user-verified. No rerun is needed solely for this documentation update. They verify the real fixture command/SQL boundary with trusted fictional identities, not actual Supabase cookies/JWTs or a deployed application role. The next server-entry integration scope is recorded in the handoff roadmap; implementation has not started while the execution environment is unavailable.
