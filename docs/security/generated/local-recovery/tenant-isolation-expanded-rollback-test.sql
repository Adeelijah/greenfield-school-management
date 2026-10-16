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

-- Verify active Cedar and Riverbank teacher isolation.
DO $assert$
DECLARE
  expected_school uuid;
  actual_school uuid;
  user_label text;
  visible_count integer;
  table_name text;
BEGIN
  FOR user_label, expected_school, actual_school IN
    SELECT *
    FROM (VALUES
      ('CEDAR', '10000000-0000-4000-8000-000000000001'::uuid,
       '11111111-1111-4111-8111-111111111111'::uuid),
      ('RIVERBANK', '10000000-0000-4000-8000-000000000002'::uuid,
       '22222222-2222-4222-8222-222222222222'::uuid)
    ) AS identities(label, school_id, auth_id)
  LOOP
    PERFORM set_config('request.jwt.claim.sub', actual_school::text, true);

    FOREACH table_name IN ARRAY ARRAY[
      'schools', 'academic_sessions', 'terms', 'classes', 'students'
    ]
    LOOP
      EXECUTE format(
        'SELECT COUNT(*) FROM public.%I WHERE %s = $1',
        table_name,
        CASE WHEN table_name = 'schools' THEN 'id' ELSE 'school_id' END
      )
      INTO visible_count
      USING expected_school;

      IF visible_count <> 1 THEN
        RAISE EXCEPTION
          '% expected one own-school record in %, got %',
          user_label, table_name, visible_count;
      END IF;

      EXECUTE format(
        'SELECT COUNT(*) FROM public.%I WHERE %s <> $1',
        table_name,
        CASE WHEN table_name = 'schools' THEN 'id' ELSE 'school_id' END
      )
      INTO visible_count
      USING expected_school;

      IF visible_count <> 0 THEN
        RAISE EXCEPTION
          '% can see cross-school records in %',
          user_label, table_name;
      END IF;
    END LOOP;

    SELECT COUNT(*) INTO visible_count FROM public.memberships;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION
        '% expected one visible membership, got %',
        user_label, visible_count;
    END IF;

    SELECT COUNT(*) INTO visible_count FROM public.school_users;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION
        '% expected one visible school-user record, got %',
        user_label, visible_count;
    END IF;

    RAISE NOTICE '% active-user isolation passed', user_label;
  END LOOP;
END
$assert$;

-- Restore Cedar identity for the original test queries.
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

-- Unassigned-user isolation checks.
DO $assert_unassigned$
DECLARE
  table_name text;
  visible_count integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM
    '33333333-3333-4333-8333-333333333333'::uuid
  THEN
    RAISE EXCEPTION 'Unexpected unassigned-user identity';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'schools',
    'academic_sessions',
    'terms',
    'classes',
    'students',
    'memberships',
    'school_users'
  ]
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM public.%I',
      table_name
    )
    INTO visible_count;

    IF visible_count <> 0 THEN
      RAISE EXCEPTION
        'Unassigned user can see % records in %',
        visible_count, table_name;
    END IF;
  END LOOP;

  RAISE NOTICE 'Unassigned-user isolation passed';
END
$assert_unassigned$;
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

-- Expanded RLS checks for the suspended Cedar teacher.
-- This section executes before the final RESET ROLE / ROLLBACK.

DO $assert$
DECLARE
  visible_schools integer;
  visible_students integer;
  visible_sessions integer;
  visible_terms integer;
  visible_classes integer;
  visible_memberships integer;
BEGIN
  SELECT COUNT(*) INTO visible_schools FROM public.schools;
  SELECT COUNT(*) INTO visible_students FROM public.students;
  SELECT COUNT(*) INTO visible_sessions FROM public.academic_sessions;
  SELECT COUNT(*) INTO visible_terms FROM public.terms;
  SELECT COUNT(*) INTO visible_classes FROM public.classes;
  SELECT COUNT(*) INTO visible_memberships FROM public.memberships;

  IF visible_schools <> 0
     OR visible_students <> 0
     OR visible_sessions <> 0
     OR visible_terms <> 0
     OR visible_classes <> 0
  THEN
    RAISE EXCEPTION
      'Suspended user can still access protected school records';
  END IF;

  RAISE NOTICE
    'Suspended-user isolation passed. Visible memberships: %',
    visible_memberships;
END
$assert$;
RESET ROLE;

ROLLBACK;