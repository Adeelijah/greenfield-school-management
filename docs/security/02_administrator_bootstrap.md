# First school administrator: controlled bootstrap plan

**Status: design only. No executable bootstrap script, migration, or credentials.**

## Required invariants
1. Supabase Auth identity must be verified using `auth.getUser()` on the server. Never accept a caller-supplied `auth_user_id` as authentication.
2. Provisioning is restricted to an operator-only server process, not a public signup route or browser-side SQL.
3. School creation, school_users upsert and initial admin membership must be one atomic transaction, with a unique school slug and unique membership (school_id,user_id).
4. The initial admin must be an explicitly selected, existing Supabase Auth user; verify their identity out-of-band before binding the account.
5. Store only auth user ID and public display name in application tables. Never store a password or access token.
6. Bind `school_users.auth_user_id` to `auth.users(id)` using a reviewed foreign key; decide deletion semantics before migration.
7. Only trusted server code may assign, suspend or change membership roles. Admin users must not be able to promote themselves or change other schools' memberships.
8. Prevent deleting, suspending or demoting the final active administrator of a school, including concurrent operations.
9. Log operator, school, affected user and action to an append-only audit trail; restrict direct audit writes.
10. Provisioning must be idempotent or detect duplicate school/user attempts and fail clearly.

## Runtime authorization
- Every request must derive user identity from verified Supabase Auth.
- School membership must be active and scoped to an explicitly selected school when users belong to multiple schools.
- Roles: admin, teacher, bursar. Authorization for each read/write operation must be defined separately.
- Current `getDatabase()` uses a direct PostgreSQL connection and may run with a privileged role; **do not rely on RLS to protect that connection**. All server operations must scope queries by authorized school_id and check role, or use a proven least-privilege RLS-bound role.
- Existing `getSchoolAccess()` returns no access for multiple active memberships; this is deliberate until school selection exists.

## Release sequence
1. Inspect local generated migration and reconcile schema; do not run it.
2. Add auth.users FK and review grants/role ownership.
3. Review RLS policies and the helper's SECURITY DEFINER execution context.
4. Build automated two-school security tests with nonprivileged authenticated DB/API contexts.
5. Implement operator-only atomic bootstrap with explicit confirmation and dry-run.
6. Apply reviewed migrations to disposable staging project; execute acceptance matrix.
7. Only then plan controlled migration and first admin setup in the target project.

Never request or commit Supabase secrets, test account passwords or service-role credentials.
