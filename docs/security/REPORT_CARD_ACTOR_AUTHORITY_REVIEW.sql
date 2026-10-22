-- REVIEW DRAFT ONLY. Do not execute or apply through Drizzle.
-- Targets a Supabase PostgreSQL deployment only after catalog/RLS/role review.
-- This draft does not enable report routes or alter an already-applied policy.
--
-- Security model:
--   * authenticated RPC has no identity arguments and derives auth.uid().
--   * a non-login, non-BYPASSRLS function owner receives only the SELECT and
--     row-lock privileges needed on school_users, memberships and schools.
--   * policies for that owner role expose the complete three-table relation
--     only to SECURITY DEFINER functions. No login or SET ROLE membership may
--     be granted to the owner. Existing PUBLIC restrictive policies must be
--     audited: if they can filter the owner's relation, deployment is blocked.
--   * report_card_runtime is a separate private server role. Its lock function
--     accepts only an auth ID retained from getUser() by server-only code.
--     Do not grant this function to anon/authenticated or accept client IDs.
--   * all counts are across every school. A non-unique active set yields no row.

BEGIN;

CREATE ROLE greenfield_report_card_authority_owner
  NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE greenfield_report_card_runtime
  NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;

GRANT USAGE ON SCHEMA public, auth TO greenfield_report_card_authority_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO greenfield_report_card_authority_owner;
GRANT SELECT ON public.school_users, public.memberships, public.schools
  TO greenfield_report_card_authority_owner;
-- PostgreSQL requires UPDATE privilege for row-locking SELECT statements.
-- These columns are granted solely to the non-login function owner; function
-- bodies contain no UPDATE statements and the owner receives no table ownership.
GRANT UPDATE (id) ON public.school_users, public.memberships, public.schools
  TO greenfield_report_card_authority_owner;

CREATE POLICY report_card_authority_owner_read_school_users
  ON public.school_users FOR SELECT
  TO greenfield_report_card_authority_owner USING (true);
CREATE POLICY report_card_authority_owner_read_memberships
  ON public.memberships FOR SELECT
  TO greenfield_report_card_authority_owner USING (true);
CREATE POLICY report_card_authority_owner_read_schools
  ON public.schools FOR SELECT
  TO greenfield_report_card_authority_owner USING (true);
CREATE POLICY report_card_authority_owner_lock_school_users
  ON public.school_users FOR UPDATE
  TO greenfield_report_card_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY report_card_authority_owner_lock_memberships
  ON public.memberships FOR UPDATE
  TO greenfield_report_card_authority_owner USING (true) WITH CHECK (false);
CREATE POLICY report_card_authority_owner_lock_schools
  ON public.schools FOR UPDATE
  TO greenfield_report_card_authority_owner USING (true) WITH CHECK (false);

CREATE FUNCTION public.resolve_report_card_actor()
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
  verified_auth_id uuid := auth.uid();
  actor_user_id uuid;
  actor_user_count integer;
  active_count integer;
BEGIN
  IF verified_auth_id IS NULL THEN RETURN; END IF;

  -- Shared discovery gate precedes every authority row read.
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
      AND m.role IN ('admin', 'teacher')
      AND s.final_primary_year IN (5, 6);
END
$function$;
ALTER FUNCTION public.resolve_report_card_actor()
  OWNER TO greenfield_report_card_authority_owner;
REVOKE ALL ON FUNCTION public.resolve_report_card_actor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_report_card_actor() TO authenticated;

CREATE FUNCTION public.lock_report_card_actor(p_verified_auth_user_id uuid)
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
  actor_user_id uuid;
  actor_user_count integer;
  active_count integer;
  active_membership_id uuid;
  active_school_id uuid;
BEGIN
  IF p_verified_auth_user_id IS NULL THEN RETURN; END IF;

  -- Every authority writer takes the exclusive gate before row discovery.
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1', 0));

  SELECT su.id INTO actor_user_id
  FROM public.school_users su
  WHERE su.auth_user_id = p_verified_auth_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*)::integer INTO actor_user_count
  FROM public.school_users su WHERE su.auth_user_id = p_verified_auth_user_id;
  IF actor_user_count <> 1 THEN RETURN; END IF;

  -- Lock the complete set before counting. Every membership mutation trigger
  -- contends on the same actor anchor, so inserts cannot become a phantom.
  PERFORM m.id FROM public.memberships m
  WHERE m.user_id = actor_user_id ORDER BY m.id FOR SHARE;
  SELECT count(*)::integer INTO active_count
  FROM public.memberships m
  WHERE m.user_id = actor_user_id AND m.status = 'active';
  IF active_count <> 1 THEN RETURN; END IF;
  SELECT m.id, m.school_id INTO active_membership_id, active_school_id
  FROM public.memberships m
  WHERE m.user_id = actor_user_id AND m.status = 'active'
    AND m.role IN ('admin', 'teacher')
  FOR SHARE;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM s.id FROM public.schools s WHERE s.id = active_school_id FOR SHARE;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT p_verified_auth_user_id, actor_user_id, m.id, m.school_id,
      m.role::text, m.status::text, s.final_primary_year,
      actor_user_count, active_count
    FROM public.memberships m
    JOIN public.schools s ON s.id = m.school_id
    WHERE m.id = active_membership_id AND m.school_id = active_school_id
      AND m.status = 'active' AND m.role IN ('admin', 'teacher')
      AND s.final_primary_year IN (5, 6);
END
$function$;
ALTER FUNCTION public.lock_report_card_actor(uuid)
  OWNER TO greenfield_report_card_authority_owner;
REVOKE ALL ON FUNCTION public.lock_report_card_actor(uuid) FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.lock_report_card_actor(uuid)
--   TO greenfield_report_card_runtime; -- only after runtime role mapping review

-- Conservative database-wide authority gate. Reserve this advisory namespace
-- for these helpers; parallel report transactions use a shared transaction lock.
-- Statement triggers take the exclusive lock BEFORE PostgreSQL locks target rows,
-- including zero-row writes. Never modify authority in a report transaction that
-- already holds the shared gate, or combine this gate with the fixture source gate
-- without reviewing their common acquisition order.
CREATE FUNCTION public.lock_report_card_authority_write_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = on
AS $function$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'report authority truncate is prohibited' USING ERRCODE='P0001';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1', 0));
  RETURN NULL;
END
$function$;
ALTER FUNCTION public.lock_report_card_authority_write_gate()
  OWNER TO greenfield_report_card_authority_owner;
REVOKE ALL ON FUNCTION public.lock_report_card_authority_write_gate() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER report_card_authority_write_gate
  BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.school_users
  FOR EACH STATEMENT EXECUTE FUNCTION public.lock_report_card_authority_write_gate();
CREATE TRIGGER report_card_authority_write_gate
  BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.memberships
  FOR EACH STATEMENT EXECUTE FUNCTION public.lock_report_card_authority_write_gate();
CREATE TRIGGER report_card_authority_write_gate
  BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.schools
  FOR EACH STATEMENT EXECUTE FUNCTION public.lock_report_card_authority_write_gate();
CREATE TRIGGER report_card_authority_write_gate
  BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.teacher_class_assignments
  FOR EACH STATEMENT EXECUTE FUNCTION public.lock_report_card_authority_write_gate();

CREATE FUNCTION public.lock_report_card_membership_actor_anchor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET row_security = on
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM su.id FROM public.school_users su
      WHERE su.id = NEW.user_id FOR UPDATE;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM su.id FROM public.school_users su
      WHERE su.id = OLD.user_id FOR UPDATE;
    RETURN OLD;
  ELSIF OLD.user_id = NEW.user_id THEN
    PERFORM su.id FROM public.school_users su
      WHERE su.id = NEW.user_id FOR UPDATE;
    RETURN NEW;
  ELSE
    PERFORM su.id FROM public.school_users su
      WHERE su.id IN (OLD.user_id, NEW.user_id)
      ORDER BY su.id FOR UPDATE;
    RETURN NEW;
  END IF;
END
$function$;
ALTER FUNCTION public.lock_report_card_membership_actor_anchor()
  OWNER TO greenfield_report_card_authority_owner;
REVOKE ALL ON FUNCTION public.lock_report_card_membership_actor_anchor() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER report_card_membership_actor_anchor
  BEFORE INSERT OR UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.lock_report_card_membership_actor_anchor();

-- Pre-apply review must confirm: FORCE RLS policy role applicability, no
-- PUBLIC restrictive policy can hide memberships from the owner role, no
-- other role can SET ROLE to the owner, direct membership DML is serialized
-- by the statement gate before row discovery and the actor anchor, and report writers hold lock_report_card_actor's
-- locks through report/assignment authorization, mutation, audit and receipt.
-- This artifact is intentionally not journaled or applied.

COMMIT;

