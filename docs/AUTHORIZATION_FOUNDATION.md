# Authorization foundation — not yet production ready

The dashboard and all module pages now require a verified Supabase Auth identity **and exactly one active school membership**. A valid login without membership redirects to /access-pending. The authorization lookup fails closed if the schema or database is unavailable. Multiple active memberships also fail closed pending explicit school selection.

The lookup joins school_users.auth_user_id to the verified Supabase user id and requires memberships.status = active. School roles currently are admin, teacher and bursar. The requireSchoolRole helper exists but individual module-specific role permissions are not yet implemented.

**Expected local behavior right now:** the initial migration has not been applied, so signed-in QA users will see Access pending. This is intentional. Do not bypass this by inserting arbitrary memberships or turning off the guard.

**Outstanding security gates before migration or real data:** complete and review auth.users FK/provisioning, tenant-aware RLS and explicit grants, secure administrator bootstrap/invitation, cross-tenant/role tests, least-privilege database access and privilege escalation protections. A privileged server-side database connection can bypass RLS; all future reads and writes must additionally enforce the verified school id and role. No user-controlled school id can grant authorization.

Do not run npm run db:migrate yet.
