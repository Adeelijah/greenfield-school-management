# Committed managed review-role installation

The operator returned the corrected managed rollback PASS: new review objects absent, existing report/source/score/attendance state checked, password unconfigured and review/finalization disabled. This is operator-provided staging PostgreSQL evidence, distinct from authoring tests. The sequence privilege check in this package includes the CASE guard proven by that successful rerun.

`ASSESSMENT_REVIEW_MANAGED_INSTALLATION.sql` is the committed counterpart for the same fixed Greenfield staging project `hweoqkbgmzycyznrbvng` and fictional school. Every statement from BEGIN through the last preservation check is byte-identical to the passed corrected rehearsal. The header and final transaction outcome/result differ: COMMIT retains the two dedicated roles, private invoker guard, 74 bounded policies, 23 triggers, read/locking/append-only grants and the one complete-helper EXECUTE addition. Rollback-only absence/restoration checks are omitted after commit.

No canonical source/review/finalization workload inserts occur. The negative probes still run in exception subtransactions, actual existing rows and metadata are checked preserved before commit, new guard API ACLs remain private, and temporary operator-owned SET edges are removed with their exact grantor before commit. Provider bootstrap ADMIN-only edges remain. The new LOGIN password stays NULL, application review/finalization stays disabled, and existing report/score/attendance LOGIN memberships are not expanded. Existing operator-seeded finalizations remain intact; this installer does not attest SDK-authenticated teacher review.

## Operator steps

Pull the branch, pass the complete offline verifier and copy the whole installation file:

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
node .\scripts\verify-offline.mjs
if ($LASTEXITCODE -ne 0) { throw 'Offline checks failed' }
Get-Content .\docs\staging\ASSESSMENT_REVIEW_MANAGED_INSTALLATION.sql -Raw | Set-Clipboard
```

Confirm the Greenfield staging project in the dashboard SQL Editor and execute the complete batch once as the same postgres inspection operator. Do not run fragments. Expected final JSON has `assessment_review_managed_installation: PASS`, `dedicated_roles: 2`, `existing_report_source_score_attendance_state_checked: true`, `login_password_configured: false` and `review_finalization_enabled: false`.

If it fails before COMMIT, issue `ROLLBACK;` in the same SQL session and share the error without changing expected markers or repairing permissions. If the connection drops near COMMIT, establish whether the new roles/guard committed before retrying: preflight intentionally rejects already-present objects and is not an upsert or repair mode. Do not delete installed roles/policies or canonical history to bypass it. No automatic uninstall or data deletion is provided.

After successful installation evidence, prepare the dedicated LOGIN password/TLS preflight, managed execution scope/runtime mapping, SDK-owned server actions and teacher/admin UI with fresh source/review versions, pending/retry behavior and current-authority checks. Begin authenticated browser review tests by making a reasoned fictional score change, then review/finalize the new revision completely; do not delete seeded review/finalization history. Existing published report snapshots and attendance must remain unchanged. Performance/public deployment/production launch remain separate gates.

## Authoring validation

Four new artifact/parity/transaction/default tests and 38 prior target/restricted-writer/managed-review checks pass (42 focused). The new test enforces exact BEGIN-through-verification equality, one COMMIT after temporary cleanup, retained sequence CASE guard, passwordless defaults and no canonical workload writes. Expected full offline count is 809; the operator checkout runs compiler/lint and the full allowlist. MJS syntax checking passes. No TypeScript/UI source changed and no authoring database connection or committed SQL execution occurred.
