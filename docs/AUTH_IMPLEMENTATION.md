# Authentication implementation status

## Added
- Supabase SSR server and browser client factories.
- Verified-user helper using supabase.auth.getUser(), not unverified session claims.
- No service-role key is used in browser code.

## Not yet implemented — do not claim the app is protected
- Login, logout, callback, password recovery and session refresh proxy.
- School bootstrap and staff invitations.
- Membership authorization on every server read/write.
- RLS and least-privilege database grants.
- Authorization tests for admin, teacher, bursar, suspended and cross-school users.
- Link school_users.auth_user_id to Supabase auth.users(id) in the migration.

## Environment
Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
These are Supabase's public project URL and publishable/anon key, **not** the service_role secret.
Do not commit .env.local. Existing DATABASE_URL and MIGRATION_DATABASE_URL remain server-only.
The dashboard currently remains a demonstration shell; do not enter real pupil data.

## Before migration
Review RLS/grants and authentication provisioning. Do not run db:migrate.
