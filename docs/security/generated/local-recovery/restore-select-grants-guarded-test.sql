-- Phase 4F.21: Local synthetic backup recovery ACL correction.
-- REVIEW ONLY. Do not apply to Supabase or production.
-- Intended target: greenfield_disposable_backup_restore.
-- This script contains no default privilege changes.

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'greenfield_disposable_backup_restore'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR inet_server_port() <> 5432
  THEN
    RAISE EXCEPTION 'Refusing recovery correction: unexpected database target';
  END IF;
END
$$;

GRANT SELECT ON TABLE
  public.academic_sessions,
  public.classes,
  public.memberships,
  public.school_users,
  public.schools,
  public.terms
TO authenticated;

GRANT SELECT (
  id,
  school_id,
  admission_number,
  first_name,
  last_name,
  status
)
ON TABLE public.students
TO authenticated;

ROLLBACK;
