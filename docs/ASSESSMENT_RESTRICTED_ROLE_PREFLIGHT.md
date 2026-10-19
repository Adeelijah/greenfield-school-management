# Restricted fixture role prerequisites

Status: offline preparation; no roles, grants, RLS policies or database connections were created or changed.

The user verified 328 offline tests and all 38 PostgreSQL groups, including parent revision fan-out. These owner-run fixture tests establish transaction behavior, not restricted database authorization.

## New preflight

`fixtureRolePreflightPlan(schema)` accepts only generated rc_it schemas and derives two exact names: `<schema>_reader` and `<schema>_writer`. It returns a parameterized SELECT against pg_catalog.pg_roles, pg_catalog.pg_auth_members and pg_catalog.pg_shdepend. It does not execute SQL, load credentials, create roles or assume the current login can administer roles.

`inspectFixtureRestrictedRoles(schema, rows)` requires exactly one row per role. Both roles must be NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB and NOREPLICATION; they must own no objects anywhere and have no outgoing role memberships. Rejecting all outgoing edges conservatively prevents inherited, SET ROLE and ADMIN-option paths without relying on flag-specific graph traversal. The owner/test harness may be granted membership in a restricted role later; that is the incoming direction and must never be mistaken for restricted-role membership in the owner. All catalog flags must be actual booleans; absent, ambiguous or malformed evidence fails closed.

The ownership query examines shared ownership dependencies across the cluster, not just fixture tables. It is deliberately conservative: these roles are disposable leaf roles and must not own a schema, function, table, database or other object. A successful preflight means only that these specific role prerequisites were met at collection time. It does not certify PUBLIC privileges, executable functions, default privileges, grants, policies, login/harness authority or absence of concurrent administrative changes.

## Remaining implementation and execution gate

Prepare a separate opt-in security harness that provisions disposable roles with an explicitly authorized role-admin connection; never silently assume greenfield_test has CREATEROLE. Capture preflight inside the controlled setup, execute workload commands with SET LOCAL ROLE, verify current_user for each transaction and reset by transaction end. Keep ownership/setup credentials separate from the tested role and never count setup statements as restricted workload evidence. Cleanup only generated roles after dropping their own fixture dependencies.

Before granting SQL access, reconcile SELECT FOR SHARE/UPDATE requirements with reader privileges: the existing canonical reader uses locking reads, so a plain SELECT-only role is not sufficient for its current interface. Do not grant unrestricted UPDATE just to make its locks work. Choose a reviewed controlled function boundary or an equally explicit privilege/policy design, preserving actor/school/assignment verification.

Direct client access remains default deny in the review policy. Trusted server identity must not be replaced with caller-controlled SQL session settings. Test missing/forged identity, another school, suspended membership, ended assignment, direct writes, append-only records, source-gate permissions, receipt failures and historical replay under the actual restricted execution role. Parent/authority writes need a separate controlled boundary. Published correction/revocation and guardian access remain later gates.

The role-admin setup, grants, RLS and restricted workload harness are not implemented by this batch. No production migration/auth change is authorized or applied.

## Verification

Nine new offline tests cover exact role pairs, schema injection, missing/duplicate/substituted roles, superuser/RLS bypass, role administration/login/inheritance, outgoing memberships, ownership and malformed catalog evidence. Expected full offline count: 337. PostgreSQL harness remains the user-verified 38 groups; no database rerun is needed for this batch.

Catalog references: https://www.postgresql.org/docs/18/catalog-pg-auth-members.html and https://www.postgresql.org/docs/18/catalog-pg-shdepend.html . PostgreSQL records inheritance, SET ROLE and administration as distinct membership options; ownership uses shared dependency type o.
