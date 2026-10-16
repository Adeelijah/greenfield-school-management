# Phase 4F.21 — Local Backup, Restore and Tenant-Isolation Verification

Date: 2026-10-16
Status: Local rehearsal passed; remote deployment not authorized.

## Scope

Local PostgreSQL server: 127.0.0.1:5432

Source database:
greenfield_disposable_backup_source

Restore database:
greenfield_disposable_backup_restore

The rehearsal used fictional data belonging to Cedar Academy and
Riverbank School. No remote Supabase database was modified.

## Backup and restore

A custom-format PostgreSQL backup was created from the local
synthetic source database and restored into a separate local database.

Backup SHA-256:
17772160DF46C57EEBEE766E9364EEE111B8C938625EE1022C6BEE2BBE4BAA0F

The restore used --single-transaction, --exit-on-error,
--no-owner and --no-acl.

The restored database required separately reviewed SELECT grants,
which were applied only to the authorized local restore database.

## Verified authorization controls

- 12 tables with FORCE ROW LEVEL SECURITY.
- 7 public RLS policies.
- Anonymous role: no public table SELECT privileges.
- Authenticated role: SELECT privileges limited to six public tables.
- Student date-of-birth column: not granted to authenticated.
- Neither anon nor authenticated received public table write privileges.
- No public default ACL entries in the restored database.

## Expanded tenant-isolation rehearsal

The rollback-only test passed for:

- Active Cedar teacher: own-school access; cross-school isolation.
- Active Riverbank teacher: own-school access; cross-school isolation.
- Own membership and school-user visibility.
- Unassigned user: no access to the seven tested protected tables.
- Suspended Cedar teacher: no access to the five tested school-data tables.

The suspended teacher could still read their own membership.
This behavior requires explicit policy acceptance or further review.

The rehearsal ended with ROLLBACK.

## Independent post-test verification

Database: greenfield_disposable_backup_restore

- auth.users: 0
- public.school_users: 0
- public.memberships: 0
- public.schools: 2
- public.students: 2
- Temporary authenticated USAGE grant on auth schema: absent
- FORCE RLS tables: 12
- Public RLS policies: 7
- Public default ACL entries: 0

All checks matched the expected values.

## Limitations

- Tests used fictional local records and a local auth.uid() stub.
- Full Supabase Auth integration has not been established by these tests.
- Not every application workflow or authorization path was tested.
- Successful local restoration does not establish production recovery readiness.
- Remote staging has not been populated or validated through this rehearsal.
- No remote database writes or migrations are authorized.

## Next steps

1. Review generated artifacts and unrelated working-tree changes.
2. Decide whether suspended users should see their own memberships.
3. Expand authorization testing where needed.
4. Review remote migration prerequisites and backup safeguards.
5. Obtain explicit authorization before any remote database changes.