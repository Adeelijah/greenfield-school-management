# Managed score installation after successful staging rollback

The operator reported the corrected rollback rehearsal PASS: new assessment objects absent, existing report/source/attendance state checked, no LOGIN password configured and score saving disabled. This is operator-provided PostgreSQL evidence, distinct from authoring tests.

`ASSESSMENT_SCORE_MANAGED_INSTALLATION.sql` is the committed counterpart for the same Greenfield staging project `hweoqkbgmzycyznrbvng` and fictional school. Every statement from BEGIN through the last preservation verification is byte-identical to the corrected rollback package. Only the explanatory header and final transaction outcome differ: COMMIT retains three dedicated roles, the private score function, narrowly scoped policies and grants; the rollback-only absence check is omitted. No foundation/assessment tables, existing helper bodies, old role memberships or application flags are changed.

The three score save/replay/rejection probes still roll back their own subtransactions before preservation verification. Thus score rows, source revisions/claims, audit/receipts, canonical source documents, reports and attendance are checked unchanged before commit. The new LOGIN remains passwordless, the app remains disabled, provider-default function API grants are reset, and temporary operator SET/schema CREATE access is removed before commit. The existing target preflight refuses adoption of already-present new roles/API; this installer is intentionally not rerunnable after success.

## Run once in confirmed Greenfield staging

Pull the branch and pass `node .\scripts\verify-offline.mjs`, then copy the entire SQL file to the confirmed Greenfield staging SQL Editor as the same `postgres` operator. Run the complete batch once. Do not execute fragments or change the transaction boundary.

Expected final JSON: `assessment_score_managed_installation: PASS`, `dedicated_roles: 3`, `existing_report_source_attendance_state_checked: true`, `login_password_configured: false`, `assessment_save_enabled: false`.

If it errors before commit, issue `ROLLBACK;` in that session and share the error without repairing guards or grants. If the connection drops near COMMIT, do not blindly rerun: establish whether the three new roles/API committed first. Do not drop installed objects to make preflight pass. No automatic uninstall/data deletion is provided.

After installation evidence, the next implementation batch is dedicated assessment LOGIN setup and TLS preflight, SDK-owned request/server boundary, editable versioned score grids and correction/retry/pending/history behavior in the approved shared UI. Teacher review and independent canonical finalization remain subsequent work. Existing operator-seeded finalizations are not proof of authenticated review. LOGIN/SDK/browser score behavior is not proven by this installation.

## Validation

Four new pure tests check artifact parity, exact rehearsal equivalence through verification, single final COMMIT and disabled/passwordless defaults. All 32 focused score checks pass in authoring. The full offline verifier includes the new tests; TypeScript/ESLint and the full suite must run in the operator checkout. No PostgreSQL connection or installation execution occurred in authoring.
