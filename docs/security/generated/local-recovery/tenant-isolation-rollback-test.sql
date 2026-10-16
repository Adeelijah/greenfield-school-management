\set ON_ERROR_STOP on

BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'greenfield_disposable_backup_restore'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR inet_server_port() <> 5432
  THEN
    RAISE EXCEPTION 'Refusing test: unexpected database target';
  END IF;
END
$guard$;

GRANT USAGE ON SCHEMA auth TO authenticated;

INSERT INTO auth.users (id)
VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');

INSERT INTO public.school_users (id, auth_user_id, display_name)
VALUES
  ('44444444-4444-4444-8444-444444444444',
   '11111111-1111-4111-8111-111111111111',
   'Fictional Cedar Teacher'),
  ('55555555-5555-4555-8555-555555555555',
   '22222222-2222-4222-8222-222222222222',
   'Fictional Riverbank Teacher');

INSERT INTO public.memberships (school_id, user_id, role, status)
VALUES
  ('10000000-0000-4000-8000-000000000001',
   '44444444-4444-4444-8444-444444444444',
   'teacher', 'active'),
  ('10000000-0000-4000-8000-000000000002',
   '55555555-5555-4555-8555-555555555555',
   'teacher', 'active');

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

SELECT 'CEDAR_USER' AS test_identity, id, name
FROM public.schools
ORDER BY name;

SELECT 'CEDAR_STUDENTS' AS test_identity, school_id, first_name
FROM public.students
ORDER BY school_id;

SELECT set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

SELECT 'RIVERBANK_USER' AS test_identity, id, name
FROM public.schools
ORDER BY name;

SELECT 'RIVERBANK_STUDENTS' AS test_identity, school_id, first_name
FROM public.students
ORDER BY school_id;

SELECT set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);

SELECT 'UNASSIGNED_USER' AS test_identity, id, name
FROM public.schools
ORDER BY name;

RESET ROLE;

UPDATE public.memberships
SET status = 'suspended'
WHERE user_id = '44444444-4444-4444-8444-444444444444';

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

SELECT 'SUSPENDED_CEDAR_USER' AS test_identity, id, name
FROM public.schools
ORDER BY name;

RESET ROLE;

ROLLBACK;