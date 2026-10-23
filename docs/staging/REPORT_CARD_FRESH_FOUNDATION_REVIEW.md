# Fresh staging foundation review

The user identified isolated Greenfield staging as **hweoqkbgmzycyznrbvng** and supplied a catalog result showing **zero public tables**. This does not establish that all schemas, types, roles, functions or Auth accounts are empty. The assistant has not connected to the project or executed SQL. The user also reported the PostgreSQL upgrade rerun passed; the 556-test offline gate is verified separately.

The existing installation-review builder requires a reconciled semantic foundation. It cannot be applied directly to this observed empty public schema. `REPORT_CARD_FRESH_FOUNDATION_REVIEW.sql` is the concrete first-stage candidate for review, not authorization to execute it.

## Exact change

The candidate creates the twelve foundation tables from the unchanged historical migration: schools, school users, memberships, academic sessions, terms, classes, students, guardians, student-guardian links, enrollments, admissions and audit events. It retains four enums, nineteen explicit indexes, twenty foreign keys and the original column/default/check/unique definitions. All relations and enum references are qualified to public. Required indexes precede foreign keys rather than following the historical file's original order.

It sets a catalog-only search path and bounded lock/statement timeouts. The initial catalog guard rejects existing public tables, views, materialized/foreign tables or sequences; existing foundation types; missing Supabase API roles; and use of an API/application execution role as installer. It does not drop or repair conflicting objects, create a schema, register a migration, seed a school/pupil, change an Auth account, create roles or change role memberships/default ACLs.

Every new table receives enabled and forced RLS, revoked PUBLIC/anon/authenticated/service_role access and an installer-only setup policy. Existing known application/authority roles have direct table access revoked if present. The final check rejects remaining effective table or column data privileges for those known roles, including access obtained through PUBLIC or inherited grants. This is an additional gate, not a complete replacement for the separately required target role/schema/function/default-privilege audit. Unknown roles and background writers still require review. Run only during an approved exclusive installation window.

These protections commit with the definitions in one transaction. No report or guardian endpoint is enabled. On successful commit, the final read-only result should show **foundation_tables = 12** and **protected_tables = 12**. On an error, preserve the message and inspect rollback from a fresh session before retrying; do not remove the guard, restore API access or add IF NOT EXISTS to bypass a conflict. A successful commit makes the script intentionally non-repeatable.

## Compatibility and limits

The baseline definitions match the previously rehearsed semantic foundation. This is not proof that the unchanged raw journal replays and does not turn a generated fixture namespace into a production migration generator. The original Drizzle SQL and migration journal remain intact. The new draft does not write a Drizzle journal row; do not run Drizzle migrate against this manually prepared target without separately reconciling migration history.

The foundation is not the final current-source schema. The academic dependency/report review package remains a separate stage, adding the school final-year/class configuration surface, sixteen proposal relations and two protocol relations. Actual greenfield_app role provisioning, complete source/authority security installation, school configuration, source writers, fictional accounts/results and real SDK session testing are still required. No final Primary year or class mapping is inferred. Do not point the application at this incomplete foundation.

SQL cannot verify a Supabase project reference from current_database(), since multiple projects use the database name postgres. The operator must verify the dashboard project reference **hweoqkbgmzycyznrbvng** and the approved scope before any run. Keep secrets out of the review record. The existing target-bound restore/recovery review still applies to any non-public/provider state; zero public tables alone does not authorize changing Auth or other schemas.

## Evidence and execution hold point

Six source/semantic checks cover every baseline definition, enum/table/index/FK order, catalog guards, all twelve RLS/revocation surfaces, effective privilege checks, explicit target/review limits and LF/CRLF handling. They passed with eight existing baseline-planner checks and four composition regressions: **18 passed locally**. The checks inspect SQL strings; they do not PostgreSQL-parse or execute the new DO/protection blocks. No dependencies were installed. The expanded allowlist prepares **562 offline tests across 75 files**, with its full installed rerun pending; no TypeScript/application source changes were made.

Before execution, obtain explicit authorization for this concrete twelve-table foundation on the named isolated project. AGENTS.md requires approval before executing SQL or applying schema/grant/RLS changes; standing source-work approval is not treated as permission for this database write. Do not run the old coordinated upgrade or the raw journal as a substitute. The next action after approval is the single complete fresh-foundation script, followed by catalog/privilege result review before preparing the next installation stage. No merge, deployment or production change is included.
