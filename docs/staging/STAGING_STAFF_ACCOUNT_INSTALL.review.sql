-- STAGING ONLY: additive staff dashboard lookup, no module grants.
-- Review target in the Supabase SQL editor before running. Atomic installation.
BEGIN;
DO $preflight$
BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'Exact staging operator required'; END IF;
 IF pg_catalog.has_schema_privilege('greenfield_report_card_authority_owner','public','CREATE') OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles g ON g.oid=m.grantor JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE g.rolname='postgres' AND r.rolname='greenfield_report_card_authority_owner' AND u.rolname='postgres') THEN RAISE EXCEPTION 'Unexpected pre-existing operator grant'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid AND slug='greenfield-staging' AND final_primary_year=5) THEN
  RAISE EXCEPTION 'Wrong staging school';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='greenfield_report_card_authority_owner' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb) THEN
  RAISE EXCEPTION 'Unexpected authority owner';
 END IF;
 IF pg_catalog.to_regprocedure('public.report_card_request_auth_uid()') IS NULL OR pg_catalog.to_regprocedure('public.resolve_report_card_actor()') IS NULL THEN
  RAISE EXCEPTION 'Reviewed authority installation required';
 END IF;
 IF pg_catalog.to_regprocedure('public.resolve_staging_staff_account()') IS NOT NULL THEN
  RAISE EXCEPTION 'Staff lookup already exists; inspect before replacement';
 END IF;
END $preflight$;
-- Same transactional ownership-transfer protocol as the installed managed setup.
-- The operator-owned edge is separate from the preserved bootstrap ADMIN edge.
GRANT greenfield_report_card_authority_owner TO postgres WITH ADMIN FALSE GRANTED BY postgres;
GRANT greenfield_report_card_authority_owner TO postgres WITH INHERIT FALSE GRANTED BY postgres;
GRANT greenfield_report_card_authority_owner TO postgres WITH SET TRUE GRANTED BY postgres;
GRANT CREATE ON SCHEMA public TO greenfield_report_card_authority_owner;
CREATE FUNCTION public.resolve_staging_staff_account()
RETURNS TABLE (
  auth_user_id uuid,
  school_user_id uuid,
  membership_id uuid,
  school_id uuid,
  role text,
  status text,
  final_primary_year integer,
  school_user_count integer,
  active_membership_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = on
AS $function$
DECLARE
  verified_auth_id uuid := public.report_card_request_auth_uid();
  actor_user_id uuid;
  actor_user_count integer;
  active_count integer;
BEGIN
  IF verified_auth_id IS NULL THEN RETURN; END IF;

  -- Shared discovery gate precedes every authority row read.
  PERFORM id FROM public.assessment_source_write_gate WHERE id=1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing reviewed source gate'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1', 0));

  SELECT su.id INTO actor_user_id
  FROM public.school_users su WHERE su.auth_user_id = verified_auth_id;
  SELECT count(*)::integer INTO actor_user_count
  FROM public.school_users su WHERE su.auth_user_id = verified_auth_id;
  IF actor_user_count <> 1 THEN RETURN; END IF;
  SELECT count(*)::integer INTO active_count
  FROM public.memberships m
  WHERE m.user_id = actor_user_id AND m.status = 'active';
  IF active_count <> 1 THEN RETURN; END IF;

  RETURN QUERY
    SELECT verified_auth_id, su.id, m.id, m.school_id,
      m.role::text, m.status::text, s.final_primary_year,
      actor_user_count, active_count
    FROM public.school_users su
    JOIN public.memberships m ON m.user_id = su.id AND m.status = 'active'
    JOIN public.schools s ON s.id = m.school_id
    WHERE su.id = actor_user_id
      AND m.role IN ('admin', 'teacher', 'bursar')
      AND s.final_primary_year IN (5, 6);
END
$function$;
ALTER FUNCTION public.resolve_staging_staff_account()
  OWNER TO greenfield_report_card_authority_owner;
REVOKE ALL ON FUNCTION public.resolve_staging_staff_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_staging_staff_account() TO authenticated;
REVOKE CREATE ON SCHEMA public FROM greenfield_report_card_authority_owner;
REVOKE greenfield_report_card_authority_owner FROM postgres GRANTED BY postgres;
-- The module-specific report resolver, its role filter, policies and grants are unchanged.
DO $checks$
BEGIN
 IF EXISTS (SELECT 1 FROM public.resolve_staging_staff_account()) THEN
  RAISE EXCEPTION 'Unbound SQL editor session must resolve no staff actor';
 END IF;
 IF pg_catalog.has_function_privilege('anon','public.resolve_staging_staff_account()','EXECUTE') OR
    pg_catalog.has_function_privilege('greenfield_app','public.resolve_staging_staff_account()','EXECUTE') THEN
  RAISE EXCEPTION 'Unexpected staff lookup execution access';
 END IF;
END $checks$;
COMMIT;
