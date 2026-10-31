# Managed staging attendance installation

The operator returned `attendance_managed_rollback: PASS`, `existing_report_state_checked: true`, and `new_attendance_objects_absent: true` after running the complete managed rollback rehearsal. No password was configured and Save remains disabled. This is managed PostgreSQL execution evidence supplied by the operator, not a database connection from authoring.

`ATTENDANCE_MANAGED_INSTALLATION.sql` is a separate permanent installer for Greenfield staging `hweoqkbgmzycyznrbvng` only. Its composer reuses every statement of every rehearsed phase, including refusal to adopt existing attendance objects, exact inspected helper hashes, coordinated locks, four new protected attendance tables, three dedicated roles, private function execution, ACL cleanup, temporary ownership-grant removal, and checks that existing report/source/security state has not changed. An additional empty-storage check runs before ownership transfer while postgres still owns the new tables. The in-transaction preservation check remains after transfer. A single COMMIT follows all those checks. Post-commit catalog checks confirm all three roles, four protected tables and three private functions remain installed.

This deliberately commits new tables, functions, policies and roles. It does not configure a password, enable attendance saving, change report-role membership, seed registers, change Auth or academic data, or expose an API RPC. The new attendance LOGIN remains PASSWORD NULL. No production installation or deployment is included. The authenticated Next/server bridge, separate dedicated TLS connection and runtime inspection, secure password provisioning and saved-register UI still follow.

## Operator run

Pull the branch and run the offline verifier. Copy the complete SQL only if verification passes:

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
node .\scripts\verify-offline.mjs
if ($LASTEXITCODE -ne 0) { throw 'Offline checks failed' }
Get-Content .\docs\staging\ATTENDANCE_MANAGED_INSTALLATION.sql -Raw | Set-Clipboard
```

Confirm **Greenfield staging** in Supabase, open a new SQL Editor query, paste and run the complete batch once. The expected JSON reports `attendance_managed_installation: PASS`, four tables, three dedicated roles, preserved report state, no configured login password and Save disabled.

If an error occurs before COMMIT, run `ROLLBACK;` in that SQL session and share the error. If an error occurs after COMMIT, the installation may already be committed: share the error before retrying. The installer intentionally refuses existing objects and must not be rerun to repair a partial or already completed installation. Do not remove its preflight or checks.

## Validation

33 focused offline checks passed across managed composition/artifact equality, upgrade layout, disposable SQL/probes, both no-credential harness guards and target inspection. Four new tests verify exact rehearsed-phase reuse, single commit ordering, disabled password/UI state and canonical LF artifact equality (Windows CRLF accepted). MJS syntax checks passed. No TypeScript or UI source changed. Full installed TypeScript/ESLint verification is left to the existing operator offline gate; no managed SQL was executed by authoring. The rollback SQL remains unchanged.

SHA-256 of the permanent SQL with canonical LF endings: `06faeaab64f927750b5ae3a4309eabb1f382458f33461f79a5248e64dec55208`.
