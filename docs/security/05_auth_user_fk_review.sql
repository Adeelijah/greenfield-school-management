-- REVIEW-ONLY POST-FOUNDATION CHANGE — DO NOT EXECUTE YET.
-- Requires a previously applied Greenfield initial schema and Supabase auth.users.
-- For the initial empty staging deployment, the locally rehearsed atomic order is:
-- foundation -> this Auth FK -> RLS/grants -> assertions -> Drizzle journal.
-- This review file must not be applied separately. Staging acceptance tests follow
-- an explicitly approved atomic deployment, before enabling users.
-- This SQL deliberately does not create, alter or drop auth.users.
--
-- Preconditions:
-- - auth.users and public.school_users both exist.
-- - orphaned_school_users preflight count is zero.
-- - auth_user_id is UUID, NOT NULL and UNIQUE in public.school_users.
-- - verify migration journal state and absence of existing equivalent FK.
--
-- Restrict deletion: do not silently delete school user profiles, memberships
-- or audit references when an Auth account is deleted.
ALTER TABLE public.school_users
ADD CONSTRAINT school_users_auth_user_id_auth_users_id_fk
FOREIGN KEY (auth_user_id)
REFERENCES auth.users (id)
ON DELETE RESTRICT;
--
-- Rollback plan (staging only, operator reviewed):
-- ALTER TABLE public.school_users
-- DROP CONSTRAINT school_users_auth_user_id_auth_users_id_fk;
--
-- This is intentionally not stored in drizzle/ and not part of db:migrate.
