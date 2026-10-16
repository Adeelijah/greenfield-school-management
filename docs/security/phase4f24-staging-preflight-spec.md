# Phase 4F.24 - Staging Preflight Specification

Status: DESIGN ONLY
Remote connections authorized: NO
Database modifications authorized: NO

## Target identity

Expected Supabase project:
- Name: greenfield-staging
- Reference: hweoqkbgmzycyznrbvng
- Database: postgres

The project reference must be independently verified.
A hostname or database name alone is insufficient proof of identity.

## Offline checks

The preflight must:

1. Validate the staging manifest and transaction inventory.
2. Verify the expected project reference and database name.
3. Verify all SQL statement fingerprints.
4. Verify the exact transaction stage ordering.
5. Confirm all 10 security assertions are present.
6. Reject mismatched or incomplete metadata.
7. Reject deployment authorization or execution flags in review artifacts.

## Future read-only remote checks

These require separate authorization before implementation or execution:

1. Confirm the connection reaches the intended Supabase project.
2. Confirm current_database() is postgres.
3. Confirm required Supabase roles and auth infrastructure exist.
4. Inspect existing public schema objects.
5. Inspect existing Drizzle migration journal state.
6. Inspect existing grants, default privileges and RLS configuration.
7. Detect unexpected objects or conflicting migrations.

All checks must use read-only SQL.

## Execution boundaries

The preflight must never:

- Execute migrations or DDL.
- Create, alter or drop database roles.
- Modify Supabase Auth infrastructure.
- Insert or update the Drizzle migration journal.
- Change RLS policies or grants.
- Authorize deployment automatically.
- Print connection credentials.

## Deployment blockers

- Independently verified staging identity and credential scope.
- Approved backup and recovery procedure.
- Reviewed and tested remote deployment runner.
- Supabase effective privilege and JWT/PostgREST integration validation.
- Explicit authorization for the exact deployment revision.

Passing preflight does not authorize deployment.