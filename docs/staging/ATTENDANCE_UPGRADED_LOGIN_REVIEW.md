# Attendance integration: real foundation keys, source gate and dedicated LOGIN

## Evidence accepted

The operator passed 665/665 offline checks and the complete original attendance PostgreSQL rehearsal: exact enrollment/register writes, correction audit, actor/assignment denial, historical replay, four persistence failures and outer rollback, independent restricted execution races, parent blocking, effective privileges, immutable history and exact cleanup. This establishes the reduced generated attendance fixture. It does not install attendance into staging.

## New coordinated integration candidate

`attendanceUpgradePlan` adds the same four attendance tables to a generated `rc_it_` upgrade built from the repository journal-source baseline, reviewed academic dependencies and actual assessment/report metadata. It reuses the already-existing exact enrollment composite key and coordinated `fixture_source_write_gate`; it creates no replacement foundation tables, indexes, source gate or parent triggers. The original fixture remains separate. Namespace adaptation is closed to generated schemas and exact fictional school/class bindings; `public` is refused.

Both save and saved-history functions use private attendance ownership and a separate execution role. Existing report reader/writer roles and their grants are unchanged. The private owner receives foundation SELECT for complete actor lookup, read visibility policies for that role only, and SELECT plus UPDATE(id) for the shared row-lock gate. It owns only new attendance storage/functions; the worker receives only save/read EXECUTE. Foundation forced RLS is a prerequisite; an unexpected PUBLIC restrictive policy stops installation for separate complete-authority review. Existing release guards are retained rather than recreated during security composition. Complete active membership resolution, fixed school, active class level/section, current session and exact teacher assignment are rechecked inside the coordinated lock. There is no caller-supplied role or school.

The new history read takes the shared gate and returns only the selected saved register, marks and versioned correction history. It preserves departed enrollment history; it does not turn historical marks into the current roster. The typed decoder rejects missing/non-contiguous versions, missing correction reasons, changed dates, mismatched pupil sets, malformed values or current marks that disagree with the latest audit. The adapter requires its exact attendance execution role, captures verified identity separately from selectors, and fails closed. The upgraded save adapter retains explicit text-to-JSONB transport and transaction abort behavior.

The operator rehearsal creates a generated unprivileged NOINHERIT LOGIN with one SET-only, non-admin attendance-role edge. It connects using that generated credential through two separate PostgreSQL backends, verifies role flags/edges, saves/replays/corrects and reads history, checks complete authority across hidden foreign membership, injects receipt failure and retries, proves the existing parent gate blocks history before discovery, and rejects direct data access or switching to attendance owner/report writer. It also compares source revision/claims and report tables around attendance writes. This fixture starts with empty report history; it does not independently prove preservation of a populated published report. The operator's actual staging publication is never accessed.

## Run one integration check

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-attendance-disposable.ps1 -Upgrade
```

The launcher runs the full offline verifier first, then asks for the existing **local disposable PostgreSQL** superuser/password. It uses only localhost and the existing disposable database. The rehearsal creates one generated schema and five exact temporary roles, including its LOGIN. No password is printed or written to a file. Finally it closes those clients, removes only its schema/roles and verifies absence. It restores previous process environment values. Default launcher behavior without `-Upgrade` remains the already-passed base rehearsal. Neither mode targets Supabase or changes `.env` files.

## Limits before managed staging enablement

This is a schema-faithful isolated rehearsal candidate, not a public-schema installer or live Next route. Its private functions still accept the auth UUID from a trusted test/server callback; no browser-supplied identity is trusted and it is not exposed to PostgREST. The actual Supabase/Next bridge, managed ownership/ACL preflight and rollback package, staging-specific service-role membership review, persisted read UI, save/correction server actions, pending states and browser QA remain outstanding. Existing role inspectors must be reviewed before adding any new membership to `greenfield_app`; this candidate deliberately does not change that live LOGIN.

Attendance Save remains disabled. Assessment save/review/finalization and its separate academic writer remain outstanding. Do not execute old fixture setup against staging, reset existing publications, grant academic DML to the report runtime, or substitute an owner URL. Authoring checks are offline unit/boundary/guard/syntax checks only; actual new PostgreSQL assertions must pass on the operator's disposable database before a managed installation is prepared.

Authoring result for this integration batch: 128 focused tests passed, including all new history/upgrade guard tests and existing report/dashboard boundaries. Changed TypeScript parsed, both rehearsal entry points passed syntax checks, and scoped whitespace passed. Full installed type/lint checks and actual upgraded PostgreSQL execution remain operator-side.
