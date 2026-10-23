-- REVIEW ONLY: coordinated source/history/authority guard port, not a complete migration.
-- Requires reconciled public academic/report tables and Supabase auth roles/functions.
-- No fixed-school runtime grants/RLS, greenfield_app membership, schema tables or app wiring.
-- Preserve original standalone draft. Do not apply either draft independently.
-- Review actual catalog, source writers, policies, ownership and recovery on an authorized
-- isolated target before any SQL execution. No production apply command is provided.
-- Source-derived 2026-10-23 from b8e9634204dc7d3e336c3c789f940c2949b72452.

BEGIN;

-- Layer 1: source discovery/invalidation, parent writes and immutable history.
CREATE TABLE "public"."assessment_source_write_gate" (id integer PRIMARY KEY CHECK(id=1));

INSERT INTO "public"."assessment_source_write_gate" VALUES (1);

CREATE TABLE "public"."assessment_source_write_claims" (transaction_id text NOT NULL,scope_id uuid NOT NULL,PRIMARY KEY(transaction_id,scope_id));

CREATE FUNCTION "public"."assessment_lock_source_write"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 PERFORM id FROM "public"."assessment_source_write_gate" WHERE id=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing reviewed source gate'; END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION "public"."assessment_mark_source_scope"(target uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE claimed uuid;
BEGIN
 INSERT INTO "public"."assessment_source_write_claims"(transaction_id,scope_id)
 VALUES (pg_current_xact_id()::text,target) ON CONFLICT DO NOTHING RETURNING scope_id INTO claimed;
 IF claimed IS NOT NULL THEN
  UPDATE "public"."assessment_scopes" SET revision=revision+1 WHERE id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing reviewed academic scope' USING ERRCODE='23503'; END IF;
 END IF;
END $$;

CREATE FUNCTION "public"."assessment_invalidate_source_rows"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE before_row jsonb; after_row jsonb; target uuid;
BEGIN
 IF TG_TABLE_SCHEMA <> 'public' THEN RAISE EXCEPTION 'invalid reviewed trigger schema'; END IF;
 before_row := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
 after_row := CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME='assessment_scopes' THEN
  PERFORM "public"."assessment_mark_source_scope"((after_row->>'id')::uuid);
 ELSIF TG_TABLE_NAME='assessment_subject_roster' THEN
  FOR target IN SELECT DISTINCT v.id FROM (VALUES ((before_row->>'scope_id')::uuid),((after_row->>'scope_id')::uuid)) AS v(id) WHERE v.id IS NOT NULL ORDER BY v.id LOOP
   PERFORM "public"."assessment_mark_source_scope"(target);
  END LOOP;
 ELSIF TG_TABLE_NAME='assessment_scores' THEN
  FOR target IN SELECT DISTINCT r.scope_id FROM "public"."assessment_subject_roster" r
   WHERE r.id IN ((before_row->>'roster_id')::uuid,(after_row->>'roster_id')::uuid) ORDER BY r.scope_id LOOP
   PERFORM "public"."assessment_mark_source_scope"(target);
  END LOOP;
 ELSIF TG_TABLE_NAME='enrollments' THEN
  FOR target IN SELECT s.id FROM "public"."assessment_scopes" s
   WHERE (s.school_id=(before_row->>'school_id')::uuid AND s.class_id=(before_row->>'class_id')::uuid AND s.session_id=(before_row->>'session_id')::uuid)
      OR (s.school_id=(after_row->>'school_id')::uuid AND s.class_id=(after_row->>'class_id')::uuid AND s.session_id=(after_row->>'session_id')::uuid)
   ORDER BY s.id LOOP
   PERFORM "public"."assessment_mark_source_scope"(target);
  END LOOP;
 ELSIF TG_TABLE_NAME IN ('assessment_config_versions','assessment_subjects') THEN
  FOR target IN SELECT DISTINCT r.scope_id FROM "public"."assessment_subject_roster" r
   WHERE (TG_TABLE_NAME='assessment_config_versions' AND r.config_version_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
      OR (TG_TABLE_NAME='assessment_subjects' AND r.subject_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid)) ORDER BY r.scope_id LOOP
   PERFORM "public"."assessment_mark_source_scope"(target);
  END LOOP;
 ELSE RAISE EXCEPTION 'unsupported reviewed source table';
 END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION "public"."assessment_reject_source_truncate"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'reviewed source truncate or scope deletion forbidden' USING ERRCODE='P0001'; RETURN NULL; END $$;

CREATE TRIGGER assessment_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."assessment_scores" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_source_no_truncate BEFORE TRUNCATE ON "public"."assessment_scores" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."assessment_subject_roster" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_source_no_truncate BEFORE TRUNCATE ON "public"."assessment_subject_roster" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."enrollments" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_source_no_truncate BEFORE TRUNCATE ON "public"."enrollments" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."assessment_config_versions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_source_no_truncate BEFORE TRUNCATE ON "public"."assessment_config_versions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."assessment_subjects" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_source_no_truncate BEFORE TRUNCATE ON "public"."assessment_subjects" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."assessment_scopes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_source_no_truncate BEFORE TRUNCATE ON "public"."assessment_scopes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_source_invalidate AFTER INSERT OR UPDATE OR DELETE ON "public"."assessment_scores" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_source_rows"();

CREATE TRIGGER assessment_source_invalidate AFTER INSERT OR UPDATE OR DELETE ON "public"."assessment_subject_roster" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_source_rows"();

CREATE TRIGGER assessment_source_invalidate AFTER INSERT OR UPDATE OR DELETE ON "public"."enrollments" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_source_rows"();

CREATE TRIGGER assessment_source_invalidate AFTER INSERT OR UPDATE OR DELETE ON "public"."assessment_config_versions" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_source_rows"();

CREATE TRIGGER assessment_source_invalidate AFTER INSERT OR UPDATE OR DELETE ON "public"."assessment_subjects" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_source_rows"();

CREATE TRIGGER assessment_new_scope_invalidate AFTER INSERT ON "public"."assessment_scopes" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_source_rows"();

CREATE TRIGGER assessment_no_scope_delete BEFORE DELETE ON "public"."assessment_scopes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."schools" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."schools" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."school_users" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."school_users" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."memberships" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."memberships" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."teacher_class_assignments" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."teacher_class_assignments" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."assessment_teacher_subjects" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."assessment_teacher_subjects" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."students" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."students" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."classes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."classes" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."academic_levels" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."academic_levels" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."academic_sections" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."academic_sections" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."academic_sessions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."academic_sessions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE TRIGGER assessment_authority_source_gate BEFORE INSERT OR UPDATE OR DELETE ON "public"."terms" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_lock_source_write"();

CREATE TRIGGER assessment_authority_no_truncate BEFORE TRUNCATE ON "public"."terms" FOR EACH STATEMENT EXECUTE FUNCTION "public"."assessment_reject_source_truncate"();

CREATE FUNCTION "public"."assessment_invalidate_parent_rows"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE before_row jsonb; after_row jsonb; target uuid;
BEGIN
 IF TG_TABLE_SCHEMA <> 'public' THEN RAISE EXCEPTION 'invalid reviewed parent schema'; END IF;
 before_row := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
 after_row := CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
 FOR target IN
  SELECT s.id FROM "public"."assessment_scopes" s
  WHERE (TG_TABLE_NAME='schools' AND s.school_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
   OR (TG_TABLE_NAME='classes' AND s.class_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
   OR (TG_TABLE_NAME='academic_sessions' AND s.session_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
   OR (TG_TABLE_NAME='terms' AND s.term_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
   OR (TG_TABLE_NAME='students' AND EXISTS (
    SELECT 1 FROM "public"."enrollments" e WHERE e.school_id=s.school_id AND e.class_id=s.class_id AND e.session_id=s.session_id
     AND e.student_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid)))
   OR (TG_TABLE_NAME IN ('academic_levels','academic_sections') AND EXISTS (
    SELECT 1 FROM "public"."classes" c WHERE c.school_id=s.school_id AND c.id=s.class_id
     AND ((TG_TABLE_NAME='academic_levels' AND c.level_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
       OR (TG_TABLE_NAME='academic_sections' AND c.section_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid)))))
  ORDER BY s.id
 LOOP
  PERFORM "public"."assessment_mark_source_scope"(target);
 END LOOP;
 -- BEFORE ROW must pass the row through after invalidation. NULL would cancel
 -- the parent mutation while still committing its source revision claim.
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER assessment_parent_invalidate BEFORE UPDATE OR DELETE ON "public"."schools" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_parent_rows"();

CREATE TRIGGER assessment_parent_invalidate BEFORE UPDATE OR DELETE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_parent_rows"();

CREATE TRIGGER assessment_parent_invalidate BEFORE UPDATE OR DELETE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_parent_rows"();

CREATE TRIGGER assessment_parent_invalidate BEFORE UPDATE OR DELETE ON "public"."academic_levels" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_parent_rows"();

CREATE TRIGGER assessment_parent_invalidate BEFORE UPDATE OR DELETE ON "public"."academic_sections" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_parent_rows"();

CREATE TRIGGER assessment_parent_invalidate BEFORE UPDATE OR DELETE ON "public"."academic_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_parent_rows"();

CREATE TRIGGER assessment_parent_invalidate BEFORE UPDATE OR DELETE ON "public"."terms" FOR EACH ROW EXECUTE FUNCTION "public"."assessment_invalidate_parent_rows"();

CREATE FUNCTION "public"."report_card_reject_history"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'upgrade reviewed history is immutable' USING ERRCODE='P0001'; RETURN NULL; END $$;

CREATE TRIGGER report_card_history_write BEFORE UPDATE OR DELETE ON "public"."assessment_source_versions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_truncate BEFORE TRUNCATE ON "public"."assessment_source_versions" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_write BEFORE UPDATE OR DELETE ON "public"."assessment_teacher_reviews" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_truncate BEFORE TRUNCATE ON "public"."assessment_teacher_reviews" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_write BEFORE UPDATE OR DELETE ON "public"."assessment_finalizations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_truncate BEFORE TRUNCATE ON "public"."assessment_finalizations" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_write BEFORE UPDATE OR DELETE ON "public"."assessment_audit" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_truncate BEFORE TRUNCATE ON "public"."assessment_audit" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_write BEFORE UPDATE OR DELETE ON "public"."assessment_operation_receipts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_truncate BEFORE TRUNCATE ON "public"."assessment_operation_receipts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_write BEFORE UPDATE OR DELETE ON "public"."report_card_snapshots" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_truncate BEFORE TRUNCATE ON "public"."report_card_snapshots" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_write BEFORE UPDATE OR DELETE ON "public"."report_card_audit" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_truncate BEFORE TRUNCATE ON "public"."report_card_audit" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_write BEFORE UPDATE OR DELETE ON "public"."report_card_operation_receipts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER report_card_history_truncate BEFORE TRUNCATE ON "public"."report_card_operation_receipts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE TRIGGER assessment_final_config_freeze BEFORE UPDATE OR DELETE ON "public"."assessment_config_versions" FOR EACH ROW WHEN (OLD.state='finalized') EXECUTE FUNCTION "public"."report_card_reject_history"();

CREATE FUNCTION "public"."report_card_guard_release_history"() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_SCHEMA <> 'public' THEN RAISE EXCEPTION 'invalid reviewed release schema'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'new release must be active' USING ERRCODE='23514'; END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') THEN
   RAISE EXCEPTION 'original publication facts are immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_at<OLD.released_at THEN
   RAISE EXCEPTION 'revocation is a single monotonic transition' USING ERRCODE='23514';
  END IF;
 ELSE RAISE EXCEPTION 'release history cannot be deleted or truncated' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER report_card_release_history BEFORE INSERT OR UPDATE ON "public"."report_card_releases" FOR EACH ROW EXECUTE FUNCTION "public"."report_card_guard_release_history"();

CREATE TRIGGER report_card_release_no_delete BEFORE DELETE ON "public"."report_card_releases" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_guard_release_history"();

CREATE TRIGGER report_card_release_no_truncate BEFORE TRUNCATE ON "public"."report_card_releases" FOR EACH STATEMENT EXECUTE FUNCTION "public"."report_card_guard_release_history"();

REVOKE ALL ON FUNCTION "public"."assessment_lock_source_write"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."assessment_mark_source_scope"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."assessment_invalidate_source_rows"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."assessment_reject_source_truncate"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."assessment_invalidate_parent_rows"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."report_card_reject_history"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."report_card_guard_release_history"() FROM PUBLIC;

-- Layer 2: complete request/command authority; always source gate before advisory gate.
CREATE ROLE greenfield_report_card_authority_owner
  NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE greenfield_report_card_runtime
  NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;

-- The existing restricted application login is a reviewed prerequisite.
-- Revoke known API/application defaults on new protocol objects only.
REVOKE ALL ON TABLE public.assessment_source_write_gate, public.assessment_source_write_claims
  FROM PUBLIC, anon, authenticated, greenfield_app, greenfield_report_card_runtime;
ALTER TABLE public.assessment_source_write_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_source_write_gate FORCE ROW LEVEL SECURITY;
CREATE POLICY report_card_protocol_setup_operator ON public.assessment_source_write_gate
  FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE public.assessment_source_write_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_source_write_claims FORCE ROW LEVEL SECURITY;
CREATE POLICY report_card_protocol_setup_operator ON public.assessment_source_write_claims
  FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
REVOKE ALL ON FUNCTION public.assessment_lock_source_write() FROM anon, authenticated, greenfield_app, greenfield_report_card_runtime;
REVOKE ALL ON FUNCTION public.assessment_mark_source_scope(uuid) FROM anon, authenticated, greenfield_app, greenfield_report_card_runtime;
REVOKE ALL ON FUNCTION public.assessment_invalidate_source_rows() FROM anon, authenticated, greenfield_app, greenfield_report_card_runtime;
REVOKE ALL ON FUNCTION public.assessment_reject_source_truncate() FROM anon, authenticated, greenfield_app, greenfield_report_card_runtime;
REVOKE ALL ON FUNCTION public.assessment_invalidate_parent_rows() FROM anon, authenticated, greenfield_app, greenfield_report_card_runtime;
REVOKE ALL ON FUNCTION public.report_card_reject_history() FROM anon, authenticated, greenfield_app, greenfield_report_card_runtime;
REVOKE ALL ON FUNCTION public.report_card_guard_release_history() FROM anon, authenticated, greenfield_app, greenfield_report_card_runtime;

GRANT USAGE ON SCHEMA public, auth TO greenfield_report_card_authority_owner;
GRANT SELECT, UPDATE (id) ON public.assessment_source_write_gate TO greenfield_report_card_authority_owner;
CREATE POLICY report_card_authority_owner_read_source_gate ON public.assessment_source_write_gate
  FOR SELECT TO greenfield_report_card_authority_owner USING (id=1);
CREATE POLICY report_card_authority_owner_lock_source_gate ON public.assessment_source_write_gate
  FOR UPDATE TO greenfield_report_card_authority_owner USING (id=1) WITH CHECK (false);
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
  PERFORM id FROM public.assessment_source_write_gate WHERE id=1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing reviewed source gate'; END IF;
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
-- already holds the shared gate. Every coordinated writer acquires the source
-- discovery gate before this advisory lock; do not reverse that order.
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
  PERFORM id FROM public.assessment_source_write_gate WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing reviewed source gate'; END IF;
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

-- Private application roles receive no authority EXECUTE until fixed-school
-- runtime grants and effective policy review are separately complete.
REVOKE ALL ON FUNCTION public.resolve_report_card_actor() FROM greenfield_app, greenfield_report_card_runtime;
REVOKE ALL ON FUNCTION public.lock_report_card_actor(uuid) FROM greenfield_app, greenfield_report_card_runtime;
REVOKE ALL ON FUNCTION public.lock_report_card_authority_write_gate() FROM greenfield_app, greenfield_report_card_runtime;
REVOKE ALL ON FUNCTION public.lock_report_card_membership_actor_anchor() FROM greenfield_app, greenfield_report_card_runtime;

COMMIT;
