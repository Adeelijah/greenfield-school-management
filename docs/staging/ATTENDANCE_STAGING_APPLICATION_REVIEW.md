# Attendance staging application connection and saved register UI

## Proven installation and current scope

The operator supplied `attendance_managed_installation: PASS`, four attendance tables, three dedicated roles, `existing_report_state_checked: true`, and both `login_password_configured` and `attendance_save_enabled` false. This confirms the managed staging installer completed; no database connection was made by authoring.

This coordinated source batch adds the dedicated attendance transport, exact managed-role inspection, verified SDK request entry, server actions, saved-register UI, reasoned correction history, loading states and a guarded password setup/connection command. It does not alter the installed SQL, report-role grants, Auth accounts, source finalizations or published report history. Assessment save/review/finalization stays disabled. The application remains local-development-only; no deployment or production change is included.

## Authority and transport

The fixed attendance URL accepts only `greenfield_attendance_app.hweoqkbgmzycyznrbvng` on the reviewed staging session pooler/port/database. It cannot accept the report LOGIN, postgres or a different project. A separate global pool slot reuses only TLS transport, never identity or role evidence. Strict CA verification, bounded lifetimes, transaction timeouts and expired/poisoned SQL leases follow the existing report transport. There is no fallback to DATABASE_URL, owner credentials or the report connection.

Each private save/read invocation owns SDK `auth.getUser()` verification and passes only its authenticated UUID as a parameter. Browser requests cannot supply an auth callback, school, membership, role or assignment. Attendance intentionally does not capture or reuse the dashboard/report RPC authority snapshot: the installed private SQL routine derives the complete current actor and fixed school under its coordinated source and authority gates, then checks current class/session assignment before reading register history or replaying any receipt. Thus there is one transaction-bound authority resolution, not two principal snapshots to reconcile. The staff RPC remains presentation routing only.

Every transaction requires the incoming session and current user to be the dedicated LOGIN, inspects all three role flags and both membership directions (including only the observed managed bootstrap ADMIN-only edges), selects exactly the attendance runtime with SET LOCAL ROLE, verifies it again before work and before commit, and expires its SQL lease afterward. The private SQL function is the fresh membership/assignment authority. Catalog role inspection is not itself proof of table RLS or SQL body integrity; the successful managed installation and earlier disposable rehearsals supply the corresponding evidence. Safe negative or malformed responses abort the owning transaction.

Save requests use the existing closed seven-field decoder and parameterized text-to-JSONB transport. History is validated for exact date, contiguous versions, reasons, pupil/status integrity and agreement with the current stored marks. The fixture adapter shares only the strict scalar outcome decoder; its generated-schema limits are unchanged and it still refuses public.

## Operator setup and browser batch

Stop the existing development server with Ctrl+C first. Run from the repository root:

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-attendance-staging.ps1 -ProvisionLogin
if ($LASTEXITCODE -ne 0) { throw 'Attendance setup did not pass' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-report-card-local-staging.ps1 -EnableAttendanceWrites
```

The setup command runs the existing complete offline verifier before asking for credentials. Supply a **new dedicated attendance password of at least 20 characters**, retain it locally, and supply the **Greenfield staging postgres database password** for provisioning. This is not the local disposable PostgreSQL password. Only the dedicated attendance LOGIN password is set; no roles, policies, grants or attendance data are installed or seeded by this command. Passwords are secure prompts, passed to the short-lived Node process via UTF-8 stdin, not command-line arguments, .env files or printed errors. The command closes operator and runtime connections on completion/failure. If the password configuration PASS appears and a later connection check fails, the configured password remains in place; use it for subsequent diagnostic runs without ProvisionLogin.

The connection check requires the exact installed role graph, confirms denied direct table/column access for LOGIN and runtime, checks only the intended private function grants and requires an unbound history request to be forbidden. It does not authenticate a staff account or save a register. Its offline tests use fake transport only; their results do not attest the live connection.

The launcher then asks for the existing report app password and publishable key, plus the dedicated attendance password just configured. The attendance flag is independent of report commands. `-EnableAttendance` permits read-only saved history; `-EnableAttendanceWrites` explicitly allows fictional attendance saves. Omitting both disables attendance. Report writes remain disabled unless `-EnableTestWrites` is separately supplied. All process environment variables are restored when the launcher exits.

One browser pass:

1. Sign in as the existing teacher; open Attendance, select Primary 5 A and a valid date. Confirm the pupil-card skeleton matches the loaded roster. Mark all pupils and Save once; the pending state should block editing and duplicate submission.
2. Refresh and confirm the saved marks/version remain. Change one mark, enter a correction reason, save, and expand history: both versions must remain. Sign in as admin and verify the same saved version/history.
3. Open the same register in two tabs. Save a correction in one; a stale save in the other must require reload instead of overwriting the newer register. An uncertain network response retains the exact command/key for “Retry same save”; editing remains locked until its result is confirmed or history is reloaded.
4. Confirm bursar cannot open Attendance; check the published report/print remains intact. Check narrow mobile width, dropdown positioning, pending states and history wrapping.

A different historical pupil set is displayed as history and cannot be corrected from a changed current roster. Saved history never becomes an enrollment roster. Reload fetches current authority again; expired membership or assignment cannot access old history or replay receipts. Unexpected connection/auth/SQL failures return bounded public errors, not raw driver/provider details.

## Validation and remaining proof

70 focused attendance checks passed (including 21 new policy, actual server-entry/runtime, transport and guarded provisioning tests), plus 54 report/account regressions. The actual entry/runtime runs with mocked SDK and SQL transport in offline tests; permission denials, input copying, fresh authentication, wrong-role rejection, post-write rollback, historical reads and poisoned leases are exercised. The provisioning runner has no-driver startup guards and fake-transport tests for its exact password-only action, TLS, least-privilege checks and cleanup. Source stripping/JavaScript parsing checks passed for the five new TypeScript modules; MJS syntax and scoped whitespace checks passed.

The authoring snapshot lacks installed project dependencies. Full TypeScript/ESLint checks, PowerShell execution, live dedicated password setup/connection, rendered browser behavior and persisted browser save/correction remain unverified until the operator batch. No managed SQL, credentials, database connection or browser action was executed by authoring. The managed installer/rehearsal artifacts are unchanged and must not be rerun for this application batch.
