# Durable attendance — isolated PostgreSQL candidate

This milestone adds an actual SQL save function and transaction adapter for a generated local disposable fixture. It does **not** install attendance into the existing managed staging database, enable the Save button or complete assessment saving/review/finalization. The existing published report and source tables are not read or changed by this candidate.

## Storage and command behavior

Four attendance tables hold the daily class/session register and optimistic version, exact enrollment/student marks, immutable versioned audit (including marks and correction reason), and school/actor operation receipts. Composite foreign keys bind school, register, enrollment, student, class, session and date. Daily student uniqueness spans classes. A correction changes statuses on the same register and preserves prior audit entries; it cannot replace an enrollment after a roster change. New operations require an exact active roster and reject duplicate active session enrollment. A historical identical request can replay after pupil departure, but only while the actor still has current membership/class authority. No old attendance is recreated.

The fixture-only SECURITY DEFINER function takes an exclusive discovery gate **before** actor, assignment, receipt or roster discovery. All fixture parent INSERT/UPDATE/DELETE statements take that gate before row discovery; TRUNCATE is denied. The coarse gate deliberately serializes independent attendance operations during this first proof. It does not claim production throughput. Current teacher assignment must resolve exactly once; admin does not need an assignment. A bursar or ambiguous active membership set is denied before receipt lookup. Dates use server time in Africa/Lagos, the selected current school session and a real calendar date. Status, command keys, integer storage limits and correction reasons are checked again in SQL.

All register/mark/audit/receipt persistence occurs in the caller's owning transaction. The TypeScript adapter rejects owner execution, parameterizes the verified auth ID and command, checks the scalar result and aborts on a rejected/malformed result or SQL exception. It has no driver, environment lookup or application route. Identical JSONB commands replay; changed payload under an actor's existing key conflicts. Corrections require the exact current register version. Audit and receipt UPDATE/DELETE/TRUNCATE, including zero-row statements, are rejected by statement triggers. Registers and marks cannot be deleted/truncated through this candidate.

## Security scope and limits

Only exact generated `at_it_` namespaces are accepted. Two generated NOLOGIN, NOINHERIT, non-superuser, non-BYPASSRLS roles own/execute the candidate. The worker has schema USAGE and EXECUTE on one private save function, with no direct table/helper grants. Every fixture relation forces RLS; the private owner policy permits complete actor lookup. These fixture policies are **not** a school-filtered application read policy. The fixture uses reduced foundation prerequisites, not the live upgrade catalog, and tests restricted execution via SET LOCAL ROLE on distinct operator-owned sessions, **not** a generated LOGIN or the Next/Supabase identity bridge.

The UUID-taking function is a private trusted-server test API. Never expose it to anon/authenticated/PostgREST or treat its argument as browser-authenticated identity. A managed staging implementation still needs the existing private request-auth binding, coordinated source/authority gate, full installed catalog review, attendance read/history API, dedicated service-role and LOGIN preflight, fixed-school RLS/denial probes, and managed ownership/grant cleanup. Do not grant attendance or academic DML to the existing report runtime. No public-schema installer is supplied here.

## One consolidated operator check

After pulling the commit, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-attendance-disposable.ps1
```

It runs the complete offline verifier first, then prompts once for the authorized **local disposable** PostgreSQL superuser and password. It requires the existing `greenfield_report_cards_disposable` database on localhost. It does not ask for staging credentials or alter `.env` files. Previous process environment values are restored and local password variables removed in `finally`. The explicit opt-in node harness requires both disposable/role-admin confirmations; an unconfigured invocation exits with status 2, not a successful test result.

The rehearsal creates only a generated schema and two exact temporary roles. Assertions cover save/replay/correction, stale requests, role/assignment/membership denial, all four injected persistence failures and an outer post-write failure with retry, distinct-session blocking and stale-key races, reader-first zero-row parent blocking, parent-first assignment change, departed-roster replay and immutable history/denied table access. Lock rendezvous and SQL queries have bounded waits. Finally it removes only that generated schema and roles and verifies their absence. A cleanup failure prints the generated schema name for inspection. No DROP OWNED or public-schema cleanup is used.

Authoring checks cover offline unit/static tests, harness guard behavior and syntax. Actual PostgreSQL assertions and full installed TypeScript/ESLint remain unrun in the authoring environment. A PASS is required from the operator rehearsal before adapting this candidate to managed staging. Browser Save remains disabled. Assessment editing/review/finalization still requires its separate academic writer, and is not implemented by this attendance milestone.
