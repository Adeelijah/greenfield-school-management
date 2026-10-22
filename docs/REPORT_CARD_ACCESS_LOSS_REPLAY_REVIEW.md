# Report receipt replay after authority loss

Date: 2026-10-22. Status: prepared fixture integration tests; SQL not executed by the assistant.

## Verified baseline

The user supplied all 413 offline tests passing after the Windows line-ending fix, plus all five standalone actor-authority PostgreSQL groups passing. The prior main assessment/report harness has 59 verified PostgreSQL groups. These are separate suites; the five authority groups do not exercise full report writers or Supabase request authentication.

## New main-harness coverage

Two additional groups use the existing committed fictional fixture and actual generated least-privilege LOGIN. No report writer, production schema, live authorization or SQL review function body changes.

The first holds an actual historical submission replay after its teacher assignment SELECT FOR SHARE. A separate owner authority update with a bounded lock timeout must block. After replay completes, ending the assignment must deny both the historical operation key and a fresh submission key. Reactivating that exact assignment permits the original historical replay. Comparisons of report, snapshots, releases, audit and receipts before/after prove no report history changes.

The second suspends the teacher membership and verifies historical submission replay is denied, then restores it and verifies replay without a new write. Suspending the admin membership must deny historical approval, publication and revocation receipts. Restoring that membership permits the original receipts, preserving all five report history tables. Temporary suspension/reactivation is fictional fixture data only; the original release/snapshot history is never restored or rewritten.

The holder transaction uses the existing statement timeout and a bounded readiness helper. Finally releases and drains it before closing the login pool and dropping exact fixture objects. SQL outside the opted-in disposable environment remains prohibited.

## Validation and next step

All 52 selected authority/static/lifecycle and writer unit tests passed locally; script syntax and scoped text whitespace checks passed. Full offline test count stays 413 because the additions are integration groups. Main PostgreSQL expectation rises to 61 with existing role-admin opt-in (43 owner, ten prior restricted, eight independent login/access-loss groups). Without opt-in those latter groups explicitly skip; do not count skipped groups as verified.

Pull the branch, then use the same complete secure PowerShell admin setup/test/cleanup block, running node --experimental-strip-types .\\scripts\\assessment-postgres-schema-integration.mjs. Keep both disposable confirmations and credential cleanup. No new database target or confirmation is introduced. The two new SQL groups remain pending until that run passes.

This is evidence preparation for fixture writer replay only. The new complete-membership resolver/server identity bridge is still not wired to these fixture writers or application routes. Writer-first actor/membership lock ordering, assignment mutation edge cases, function-owner RLS/runtime mapping and real server authentication require further review/integration before route release. In particular, the standalone authority draft's row-level anchor trigger alone does not prove statement-before-row ordering for every writer. No production readiness claim follows from these tests.
