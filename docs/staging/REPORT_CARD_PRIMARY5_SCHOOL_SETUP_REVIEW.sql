-- Greenfield staging ONLY: hweoqkbgmzycyznrbvng. Requires school-setup approval.
-- Creates one fictional school row. No Auth accounts, passwords, classes or users.
-- Does not change roles, grants, policies, schema or application configuration.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $primary5_school_setup$
DECLARE existing public.schools%ROWTYPE;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN
  RAISE EXCEPTION 'Reviewed staging setup operator required'; END IF;
 -- Match the installed source/authority discovery order before any school read.
 PERFORM id FROM public.assessment_source_write_gate WHERE id=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Installed source gate is missing'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1',0));
 IF EXISTS (SELECT 1 FROM public.schools WHERE id<>'0c594571-74c5-46fe-a835-a9b217a3a199'::uuid) THEN
  RAISE EXCEPTION 'Unexpected school already exists; no rows were adopted or changed'; END IF;
 SELECT * INTO existing FROM public.schools
  WHERE id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid FOR UPDATE;
 IF FOUND THEN
  IF existing.name IS DISTINCT FROM 'Greenfield Staging' OR existing.slug IS DISTINCT FROM 'greenfield-staging'
   OR existing.final_primary_year IS DISTINCT FROM 5 OR existing.structure_version IS DISTINCT FROM 0 THEN
   RAISE EXCEPTION 'Existing school does not match the reviewed fictional setup'; END IF;
  -- An exact retry performs no UPDATE and does not invalidate source revisions.
 ELSE
  INSERT INTO public.schools(id,name,slug,final_primary_year,structure_version)
   VALUES('0c594571-74c5-46fe-a835-a9b217a3a199'::uuid,'Greenfield Staging','greenfield-staging',5,0);
 END IF;
END $primary5_school_setup$;

SELECT jsonb_build_object(
 'school_setup','PASS', 'school_id',id, 'name',name, 'slug',slug,
 'final_primary_year',final_primary_year, 'structure_version',structure_version,
 'test_accounts_created',false, 'application_enabled',false
) AS school_setup_result
FROM public.schools WHERE id='0c594571-74c5-46fe-a835-a9b217a3a199'::uuid;
COMMIT;
