-- GREENFIELD ACADEMY — SECURITY DESIGN DRAFT, NOT A MIGRATION.
-- DO NOT EXECUTE. Requires role/grant review and integration testing.
-- This illustrates tenant isolation for the 12 application tables.
--
-- PREREQUISITES:
-- 1. Schema migrations and school_users.auth_user_id -> auth.users(id) FK reviewed.
-- 2. Revoke direct writes to schools, school_users, memberships and audit_events
--    from anon/authenticated; provisioning must use a trusted, audited server path.
-- 3. Review table owners, BYPASSRLS roles, grants and Supabase API exposure.
-- 4. No untrusted application operation may use the privileged DATABASE_URL role.
--
-- SECURITY DEFINER helper intentionally bypasses recursive membership RLS.
-- It must be owned by a trusted migration role, have a fixed search_path,
-- and be audited for function execution privileges.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_active_school_membership(target_school uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    JOIN public.school_users AS su ON su.id = m.user_id
    WHERE m.school_id = target_school
      AND m.status = 'active'
      AND su.auth_user_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.has_active_school_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_active_school_membership(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.has_school_role(target_school uuid, allowed_roles public.school_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    JOIN public.school_users AS su ON su.id = m.user_id
    WHERE m.school_id = target_school
      AND m.status = 'active'
      AND m.role = ANY(allowed_roles)
      AND su.auth_user_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.has_school_role(uuid, public.school_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_school_role(uuid, public.school_role[]) TO authenticated;

-- Policies below are intentionally SELECT-only until per-operation permissions,
-- tenant-safe insert/update checks and grants are reviewed.
-- All application tables are covered; writes must remain unavailable.
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- FORCE RLS protects even table owners without BYPASSRLS; privileged roles
-- including superusers and BYPASSRLS still bypass. Verify connection roles.
ALTER TABLE public.schools FORCE ROW LEVEL SECURITY;
ALTER TABLE public.school_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.terms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.classes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;
ALTER TABLE public.guardians FORCE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians FORCE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;

-- Membership reads: users can see only their own membership rows.
CREATE POLICY membership_self_read ON public.memberships FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.school_users su
 WHERE su.id = user_id AND su.auth_user_id = (SELECT auth.uid())
));

-- Profile reads: users see only their own school_users row.
CREATE POLICY school_user_self_read ON public.school_users FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.uid()));

CREATE POLICY school_member_read ON public.schools FOR SELECT TO authenticated
USING (private.has_active_school_membership(id));

CREATE POLICY session_member_read ON public.academic_sessions FOR SELECT TO authenticated
USING (private.has_active_school_membership(school_id));
CREATE POLICY term_member_read ON public.terms FOR SELECT TO authenticated
USING (private.has_active_school_membership(school_id));
CREATE POLICY class_member_read ON public.classes FOR SELECT TO authenticated
USING (private.has_active_school_membership(school_id));
CREATE POLICY student_member_read ON public.students FOR SELECT TO authenticated
USING (private.has_active_school_membership(school_id));
CREATE POLICY guardian_member_read ON public.guardians FOR SELECT TO authenticated
USING (private.has_active_school_membership(school_id));
CREATE POLICY student_guardian_member_read ON public.student_guardians FOR SELECT TO authenticated
USING (private.has_active_school_membership(school_id));
CREATE POLICY enrollment_member_read ON public.enrollments FOR SELECT TO authenticated
USING (private.has_active_school_membership(school_id));
CREATE POLICY admission_member_read ON public.admissions FOR SELECT TO authenticated
USING (private.has_active_school_membership(school_id));

-- Audit history restricted to active admins; writes server-only.
CREATE POLICY audit_admin_read ON public.audit_events FOR SELECT TO authenticated
USING (private.has_school_role(school_id, ARRAY['admin'::public.school_role]));

-- A policy alone does not grant access. Explicit grants must be designed.
-- No INSERT/UPDATE/DELETE policies or grants are supplied in this draft.
-- Do not apply these statements independently or in production.
