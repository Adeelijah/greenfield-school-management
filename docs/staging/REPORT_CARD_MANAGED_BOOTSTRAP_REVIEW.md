# Managed staging bootstrap review — not installed

The operator supplied a read-only catalog result for project **hweoqkbgmzycyznrbvng**: PostgreSQL **17.11**, database/session/inspection role `postgres`, a non-superuser operator with CREATEROLE and BYPASSRLS, all three Greenfield roles absent, no membership edges involving those roles, and exactly one zero-argument UUID-returning `auth.uid` function. This is user-supplied evidence, not an assistant database inspection. The completed foundation remains user-reported as twelve protected tables. The fictional school's final primary year is **5**; its planned UUID is **0c594571-74c5-46fe-a835-a9b217a3a199**.

## Why the previous guard draft needs an explicit variant

PostgreSQL gives a non-superuser CREATEROLE creator an incoming ADMIN TRUE / SET FALSE / INHERIT FALSE membership in each new role, granted by the bootstrap superuser. That creator cannot remove the bootstrap-owned grant. The default strict staging contract still rejects these edges. The explicit `supabase-postgres-createrole` mode accepts exactly one such incoming edge from the observed `postgres` operator per Greenfield role, with superuser grantor evidence and the operator's observed capability flags. Missing, duplicated, unproven or more permissive edges reject. Neither mode permits an outgoing administrator membership from any application role.

The managed planner is fixed to this project, school, Primary 5 configuration and PostgreSQL 17 operator. It refuses to adopt existing roles. It creates the application login with a NULL password and no inheritance, superuser, RLS bypass, role/database creation or replication privileges. Runtime and authority-owner roles stay non-login and equally unprivileged. No password, Auth user or school row is included. The application remains disabled.

Function ownership transfer requires SET access to the new owner and CREATE permission for that owner on the function schema. The managed copy of the coordinated guards temporarily grants the operator SET-only membership, explicitly **GRANTED BY postgres**, and grants the authority owner CREATE on `public`. After all four ownership transfers it revokes CREATE and only the operator-owned membership. It preserves bootstrap-owned administration. Each GRANT uses one membership option, as required by PostgreSQL 17 syntax. The original coordinated SQL artifact is unchanged.

After policy installation, a final assertion requires the exact role flags, three bootstrap-owned administrative edges, the single application-to-runtime SET-only edge and no residual schema CREATE privilege for the authority owner. Unexpected PUBLIC schema privileges therefore fail the transaction rather than being silently changed. Source guards, fixed-school forced RLS, private helper access, immutable history and column grants remain in the composed package. This graph check does not replace an effective-privilege, ownership, policy or function-body audit.

## Offline package generation

After pulling this source commit and passing the installed offline verifier, run:

```powershell
node --experimental-strip-types .\scripts\report-card-staging-review-export.mjs
```

The exporter uses the repository's installed Drizzle metadata and reviewed composer. It refuses tracked source changes in the input directories while leaving unrelated files such as next-env.d.ts untouched. It writes `installation.review.sql` and `manifest.review.json` into a new `recovery-artifacts/report-card-staging-review-<commit>` directory and prints both full paths. Existing output is never overwritten. The manifest binds the complete SQL and every phase by SHA-256, records the source revision, target project, Primary 5 and disabled state. Phases are managed bootstrap, dependencies, proposal tables/FKs, guards with temporary-access cleanup, policy, and managed role verification, within one transaction. No database connection or SQL execution occurs. These files contain no credentials or school/student records.

**Do not paste the exported SQL into Supabase yet.** The previous authorization covered only the completed foundation. Review the complete exported bytes, current catalog compatibility, default/effective privileges, rollback behavior under this non-superuser role creator and recovery plan before requesting the next concrete staging-write approval. No production change, route enablement, application password, real SDK login or launch approval is implied. The full installed TypeScript/ESLint/metadata gate and a PostgreSQL rehearsal of this managed variant remain outstanding until actually run; pure SQL-text tests are not SQL execution.

References: official PostgreSQL 17 [role attributes](https://www.postgresql.org/docs/17/role-attributes.html), [GRANT](https://www.postgresql.org/docs/17/sql-grant.html), [REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html) and [ALTER FUNCTION](https://www.postgresql.org/docs/17/sql-alterfunction.html).

Local validation: 65 targeted pure/controlled checks passed, including strict and managed role graphs, existing real command dispatch, source recomputation, outer rollback and historical replay. Exporter/planner syntax checks passed. No dependencies were installed. The expanded full offline allowlist is expected to contain 574 tests across 77 files; TypeScript, ESLint and actual metadata export require the installed checkout and have not been claimed here.
