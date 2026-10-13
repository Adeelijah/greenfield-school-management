# Phase 4D — isolated security validation plan

Status: REVIEW ONLY. No migration or database execution authorized.

## Preconditions

- Use only local loopback PostgreSQL and a dedicated empty database named `greenfield_disposable_*`.
- Keep original Drizzle migration and journal unchanged.
- Use synthetic users, schools, students and guardians only.
- Prepare an `auth.users` stub and `auth.uid()` test function only inside a transaction that is always rolled back.
- Establish local `authenticated` and `anon` roles without BYPASSRLS; verify the connection does not accidentally bypass policies when checking access.

## Test cases

1. Apply corrected foundation in transaction, then the reviewed auth-user FK and consolidated RLS proposal; verify constraint and 12 FORCE RLS flags.
2. Seed two independent schools, admin, teacher, bursar, suspended member and unaffiliated user identities.
3. For each identity, execute SELECT as non-owner `authenticated` role, with test `auth.uid()` set to the matching identity. Assert only the correct school's metadata and memberships are visible.
4. Assert admin and teacher can read their school's permitted student roster columns, but bursar and unaffiliated users cannot.
5. Assert direct reads of guardians, admissions, enrollments, student_guardians and audit_events are denied.
6. Assert birth dates cannot be selected by the authenticated role and browser write attempts fail.
7. Assert invalid auth-user references violate the proposed foreign key.
8. Roll back deliberately, then verify no foundation tables, policies, roles, functions or temporary auth schema remain.

## Limitations and release gates

Local tests do not prove Supabase JWT/PostgREST behavior. A later disposable Supabase staging project must validate actual JWT claims, exposed schemas, privileges and server authorization. Drizzle migration journal strategy is unresolved; do not run `npm run db:migrate` or apply the review SQL to Greenfield Supabase.
