# Actor authority harness lifecycle review

Date: 2026-10-22. Fixture-only change; no application authorization behavior or SQL review function body changes.

## Verified baseline and current scope

Commit 2e2d8d6210704efecd62e5f074597e1b91af751b is user-verified with 405 offline tests, TypeScript, ESLint and tracked whitespace. Its authority SQL remains an unexecuted review draft. The user has not run the standalone authority PostgreSQL harness. Earlier 59-group PostgreSQL results do not verify this new helper.

The review used an isolated source snapshot to preserve the older workspace's existing modified/untracked files. No dependencies were installed, credentials inspected, database connected or SQL executed.

## Failure paths corrected

The harness previously ignored schema and role cleanup errors and then printed cleanup PASS. Cleanup now checks generated-name consistency and acknowledged creation flags, drops the exact owned schema/roles in one transaction, and queries the catalogs afterward. A role-dependency failure rolls back cleanup and rejects; residual catalog objects also reject. The final PASS is reachable only after these checks. No prefix scan, DROP OWNED or unrelated-object deletion is used.

Held transactions previously signaled readiness through an unbounded promise. The new readiness helper races the readiness signal against transaction failure/premature completion and a five-second deadline. Lock-holder queries also have a ten-second statement timeout. Finally releases and drains both holders before cleanup and closes the pool even when cleanup fails. Simultaneous workload/cleanup failures retain both errors in an AggregateError.

Creation flags track successful CREATE acknowledgements. An interrupted process, server outage or lost acknowledgement can still leave generated fixture state; inspect the exact run names/catalog state before authorized manual cleanup. This helper does not claim crash-safe cleanup. Existing roles or schemas are not adopted after a failed CREATE.

## Verification and next gate

Eight meaningful offline lifecycle tests exercise successful exact cleanup, rollback on dependency errors, residual objects, partial setup, identifier refusal, readiness success, transaction failure and timeout. All 20 selected authority/static/lifecycle tests passed here, along with harness syntax and whitespace checks. Expected full offline count is 413; full TypeScript/ESLint and the expanded offline gate remain for the local installed toolchain.

Run the same explicit local disposable role-admin PowerShell setup/test/cleanup block with scripts/report-card-actor-authority-postgres-integration.mjs. Expected output remains five PASS groups: hidden second membership rejection, suspended history allowance, membership-insert serialization, suspension serialization, and verified exact cleanup. No additional SQL group is claimed from offline mocks.

This only hardens test lifecycle. Actual server RPC authentication, function-owner policies under deployed restrictive RLS, private runtime role mapping, writer-first membership lock ordering, assignment removal and replay after authority loss still precede route integration. The row-level anchor trigger alone does not establish that every writer acquires the actor lock before a membership row; test and resolve that ordering explicitly.
