# Greenfield database security gate

The regenerated 0000 migration was reviewed from local output, **not executed**.

## Verified in generated SQL
- Composite tenant-scoped foreign keys on enrollments, student_guardians, admissions and terms.
- Session and term date ordering checks.
- Partial unique indexes restricting current session/term to at most one per school.

## Required before any school records or tenant access
1. Decide trusted server-only database access versus Supabase client API access. Never expose DATABASE_URL or service-role credentials to the browser.
2. Bind school_users.auth_user_id to auth.users(id) using a reviewed FK and provisioning process.
3. Define a trusted membership-based access model using auth.uid(), active membership, role and school_id; prevent self-assignment of roles and cross-school reads/writes.
4. Enable and FORCE RLS on all application tables, define least-privilege grants and explicit policies (including schools, school_users, memberships, audit_events and join tables). If server connections bypass RLS, enforce tenant and role authorization in server code and test it separately.
5. Prevent privilege escalation, ensure last-admin protection, and secure school bootstrap via an authenticated server-only transaction.
6. Confirm terms fall inside their parent session, enforce appropriate current term/session consistency, and decide class/section uniqueness semantics.
7. Verify policies with two independent schools, users with admin/teacher/bursar/suspended/no membership, and both read/write cross-tenant attack attempts.
8. Review cascading deletes and audit-event retention before production.

Do not run npm run db:migrate until a security implementation and acceptance tests are reviewed. Do not treat schema constraints as authorization.
