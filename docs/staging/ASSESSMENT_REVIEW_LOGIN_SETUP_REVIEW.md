# Managed assessment review LOGIN setup

Target: Greenfield staging `hweoqkbgmzycyznrbvng` only. The operator confirmed the corrected rollback PASS and subsequently verified the installed review roles, guard and effective permissions with the existing catalog verification block. This evidence does not prove SDK/browser review execution or authenticated authorship of earlier seeded documents.

## Scope

`verify-assessment-review-staging.ps1` runs the full offline verifier before secure prompting. Default mode checks the existing dedicated password. Explicit `-ProvisionLogin` changes only `greenfield_assessment_review_app`'s password, using a parameterized PostgreSQL `format` literal and the fixed staging operator connection. It changes no roles, grants, policies, source documents or report/attendance/score records. If password provisioning passes but a later diagnostic fails, the newly configured password remains; retain it locally and rerun without provisioning after resolving the failure.

Credentials go to the child process through stdin, never command-line arguments, dotenv or a generated file. The fixed session-pooler host, port, project and database cannot be selected from input. Both connections require the existing CA certificate at `recovery-artifacts/greenfield-staging-ca.crt` with strict certificate verification; no TLS bypass is provided. Errors print only phase and bounded code.

The review password is separate from local disposable postgres, managed staging postgres, report, attendance and assessment-score passwords. Use a new password of at least 20 characters when provisioning. No account emails or passwords are requested for this connection-only milestone.

## Checks and runtime

The new pure managed runtime accepts exactly the two installed review roles, no ownership/privileged flags, one outgoing LOGIN-to-runtime SET-only edge and the observed incoming postgres ADMIN-only provider edges. It checks the session and fresh catalog in every transaction, permits only the exact execution role and expires its SQL lease. Caught SQL failures, outstanding operations and execution-role contamination reject the transaction. It has no public out-of-transaction SQL method and is not imported by application routes in this batch.

The operator-run diagnostic checks the unprivileged LOGIN has no public table/column data access, private helper access, auth schema usage, public schema creation or sequence privileges. After SET LOCAL ROLE it checks exact SELECT and UPDATE(id) locking grants on the 23 approved relations and INSERT on only the five append-only history relations. It rejects table mutation, other column grants, missing relations, disabled RLS, score/attendance/revision API access and sequence access. It reads the school under the actual runtime RLS and requires exactly the fixed fictional staging school. Transaction end must restore the dedicated LOGIN. The CASE-guarded sequence query preserves the managed catalog compatibility fix.

The diagnostic executes catalog/session/school SELECTs and a transaction-local role switch. It does not call the canonical writer or actor-lock helper, acquire the source discovery gate or insert review/finalization/audit/receipt rows. The existing managed installation checks remain the evidence for the guard body and policy layout; role inspection alone is not a substitute for those checks.

## Operator command

From the updated repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-assessment-review-staging.ps1 -ProvisionLogin
```

After initial provisioning, omit `-ProvisionLogin` to diagnose the same existing password. The application review/finalization flags and buttons remain disabled. Next: managed issued review scope, actual canonical writer, SDK-owned actions, current-source status and teacher/admin browser verification. Score corrections must precede review of every subject at the resulting shared class scope revision; seeded history is never deleted or presented as proof of an authenticated review.

## Validation limits

Eighteen new offline tests exercise the actual runtime/setup helper against controlled SQL transports, role drift, privilege denials, TLS options, URL encoding, provisioning boundaries, cleanup and secure wrapper ordering. Together with the 42 existing managed/restricted review checks, 60 focused checks pass. No authoring database connection, SQL execution, password configuration, full TypeScript/ESLint check or browser verification occurred. Full offline verification is required in the operator checkout before any credential prompt.
