# Attendance managed staging rollback rehearsal

## Reviewed target evidence

The operator supplied `greenfield.staging.attendance.target.v1` for Greenfield staging `hweoqkbgmzycyznrbvng`, PostgreSQL 17.11, UTC. `inspection_issues` is empty. The non-superuser `postgres` operator has CREATEROLE/BYPASSRLS and public USAGE/CREATE. All sixteen selected foundation/source/report relations are postgres-owned and force RLS. All four required exact unique keys exist. Three attendance roles are absent. The report LOGIN retains its sole SET-only report runtime edge, and the existing bootstrap ADMIN-only operator edges remain unchanged. There are no selected PUBLIC restrictive policies. Existing private helper hashes/owners/ACLs are captured by the composer as a change guard.

The populated report baseline has one report, two snapshots, two releases, eight audit rows and eight operation receipts. These are real staging test-history records and must survive. No actual database connection or inspection was performed by the authoring agent; this is operator-supplied evidence.

## Exact candidate and what it does

`ATTENDANCE_MANAGED_ROLLBACK_REHEARSAL.sql` is the exact output of the pure `attendanceManagedRollbackReview` composer. The offline gate checks canonical LF byte equality (allowing Windows CRLF checkout endings only) so a stale checked-in SQL copy fails. This artifact has **one terminal ROLLBACK and no COMMIT**. It is not an installation script. Run it only in the confirmed Greenfield staging SQL editor, as `postgres`.

The candidate takes the existing source gate then the established authority advisory barrier, snapshots fixed-school report/source data and existing report role/edge/helper/guard/policy state into one transaction-local temporary table, and prepares four new attendance tables plus three dedicated attendance roles. The new LOGIN has PASSWORD NULL and no inheritance. No Auth records/passwords, existing report memberships, academic rows or publication/history rows are changed.

It reuses the proven attendance save/read/history implementation, exact existing enrollment keys, active class structure and complete membership/class assignment checks. The private functions accept the verified auth UUID from a trusted server boundary, not from the browser. No RPC or new live Next route is exposed. The new private owner gets only reviewed foundation reads, its own attendance storage and the source-gate locking privilege. New table/column/function ACLs are reset while postgres still owns the objects, including inherited provider default API grants. The new runtime then receives only save/read execution.

The managed ownership protocol matches the already-working staging pattern: preserve automatic bootstrap ADMIN-only grants; add an operator-owned SET-only edge and temporary schema CREATE for the new owner; finish trigger/policy/ACL work before ownership transfers; test unbound rejection while explicitly selecting that new owner; reset to postgres; revoke CREATE; and remove only the operator-owned temporary edge. The new LOGIN gets only a SET-only runtime membership and CONNECT. The old report LOGIN/runtime/authority owner and all existing helper ACLs remain unchanged. No provider Auth schema grant is requested.

In-transaction assertions verify exact role flags/edges, private table ownership and forced RLS, function owner/settings, denied direct data/API privileges, no residual schema CREATE, unbound actor rejection and byte-for-byte captured existing report/source/role/helper/guard/policy state. After ROLLBACK, another check requires the new attendance roles, tables, functions and policies to be absent. The final result is `attendance_managed_rollback: PASS`. Existing PostgreSQL transactional DDL semantics plus the unchanged-state check are used; no DROP/DELETE cleanup targets existing data.

## Operator run

After pulling this candidate, copy its complete SQL:

```powershell
Get-Content .\docs\staging\ATTENDANCE_MANAGED_ROLLBACK_REHEARSAL.sql -Raw | Set-Clipboard
```

Paste it into a **new query in Greenfield staging's Supabase SQL editor**, confirm the project, and run the complete batch once. Send the final JSON result. This is a database rehearsal, not a repeat of the local disposable test batch. It creates no usable application password and leaves Attendance Save disabled. If execution errors before the terminal ROLLBACK, run `ROLLBACK;` in that SQL session and share the error; do not replace ROLLBACK with COMMIT or try partial repair.

## Limits

Authoring validation covers pure SQL composition, source provenance, ordering, exact object scope, ACL/ownership cleanup text, artifact consistency and existing attendance regressions. These checks do not execute managed PostgreSQL or prove provider permissions. The staging rollback result is required before a separate commit-capable installer is prepared. This candidate is specifically scoped to the supplied staging evidence and refuses existing attendance objects or changed inspected helpers; it never adopts/replaces them. MD5 markers detect changes and are not a substitute for canonical snapshot hashes or source/authentication review.

Actual verified Supabase/Next identity bridge and captured-principal checks, dedicated attendance TLS connection/role inspection, password provisioning, live saved-register UI/server actions, pending/correction history rendering and browser QA remain after installation. The attendance SQL cannot by itself authenticate the UUID argument. Assessment save/review/finalization remains a separate outstanding workstream. No production changes or deployment are included.

Authoring result: 45 attendance-focused checks passed, followed by the managed-composer/upgrade checks after tightening final ACL/security-definer assertions. The checked-in artifact exactly matches the composer, syntax/whitespace checks pass, and there are no TypeScript or UI changes. SHA-256 of this rollback SQL with canonical LF endings: `39116b0e496e652504656d30897c3bf4286f82216681c1b0b794e465d8b39a2b`. Actual managed PostgreSQL execution remains unverified until the operator runs this rehearsal. No database connection, password inspection, SQL execution, live grants or installation occurred in authoring.
