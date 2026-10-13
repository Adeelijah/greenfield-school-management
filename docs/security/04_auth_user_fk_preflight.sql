-- READ-ONLY PREFLIGHT — safe to inspect, but not necessary to run yet.
-- Run ONLY after the initial Greenfield schema exists in a disposable staging DB.
-- Never paste user IDs, email addresses, or other output into chat.
SELECT to_regclass('auth.users') IS NOT NULL AS auth_users_exists,
       to_regclass('public.school_users') IS NOT NULL AS school_users_exists;

-- Only run the query below when BOTH tables exist.
-- Count orphaned school user identities without disclosing personal information.
SELECT count(*) AS orphaned_school_users
FROM public.school_users su
LEFT JOIN auth.users au ON au.id = su.auth_user_id
WHERE au.id IS NULL;

-- Check for a pre-existing FK to avoid duplicate migrations.
SELECT conname, convalidated
FROM pg_constraint
WHERE conrelid = 'public.school_users'::regclass
  AND contype = 'f';
