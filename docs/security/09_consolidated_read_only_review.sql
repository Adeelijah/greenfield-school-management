-- GREENFIELD ACADEMY: CONSOLIDATED READ-ONLY SECURITY REVIEW
-- NOT A MIGRATION. DO NOT EXECUTE. Requires integration tests, grant audit,
-- server connection review, operator approval and tracked deployment.
-- This proposal REPLACES 07 and 08; never apply the three together.
-- Assumes immutable 0000 foundation and the separately reviewed auth.users FK.
-- No browser write permissions. No school/administrator bootstrap execution.
--
-- Browser role model (conservative):
--  admin/teacher/bursar: own user + own memberships, active school metadata,
--    academic sessions, terms and classes for active schools
--  admin/teacher: limited student roster columns, no DOB
--  bursar: no student roster
--  all roles: no direct guardian, student_guardian, enrollment, admission or
--    audit SELECT. Admin access to those requires a separately reviewed
--    authenticated server endpoint and scoped database privileges.
--
-- Caution: RLS restricts rows, not columns. A full-table SELECT grant to the
-- shared authenticated DB role would defeat the roster column restriction.
-- Policies are permissive and OR together; audit preexisting policies.
-- Privileged direct DATABASE_URL may bypass RLS. Do not expose that client
-- through unscoped handlers.

-- Dedicated Greenfield public schema only. Audit preexisting privileges,
-- role inheritance and default privileges before applying.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

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

-- Terminating dependency: school_users policy references only auth.uid().
CREATE POLICY gf_user_self_read ON public.school_users
FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.uid()));

CREATE POLICY gf_membership_self_read ON public.memberships
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.school_users su
  WHERE su.id = memberships.user_id
    AND su.auth_user_id = (SELECT auth.uid())
));

-- Memberships are themselves filtered to the authenticated user.
CREATE POLICY gf_school_active_member_read ON public.schools
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = schools.id AND m.status = 'active'
));

CREATE POLICY gf_session_active_member_read ON public.academic_sessions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = academic_sessions.school_id AND m.status = 'active'
));

CREATE POLICY gf_term_active_member_read ON public.terms
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = terms.school_id AND m.status = 'active'
));

CREATE POLICY gf_class_active_member_read ON public.classes
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = classes.school_id AND m.status = 'active'
));

CREATE POLICY gf_student_staff_roster_read ON public.students
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = students.school_id
    AND m.status = 'active'
    AND m.role IN ('admin', 'teacher')
));

-- Deliberately no SELECT policies for guardians, student_guardians,
-- enrollments, admissions or audit_events. No direct browser access.

GRANT SELECT ON TABLE
  public.schools,
  public.school_users,
  public.memberships,
  public.academic_sessions,
  public.terms,
  public.classes
TO authenticated;

-- Never grant table-wide SELECT on public.students to authenticated.
GRANT SELECT (id, school_id, admission_number, first_name, last_name, status)
ON public.students TO authenticated;

-- Required before any execution:
-- 1. Merge into tracked, ordered migration after foundation and auth FK.
-- 2. Audit all existing policies, PUBLIC/inherited grants, default privileges,
--    PostgREST exposed schemas, and service_role access.
-- 3. Run real JWT-backed, nonprivileged role/tenant/column tests.
-- 4. Test direct DATABASE_URL access and server handler authorization.
-- 5. Test SQL transaction rollback and bootstrap under operator privileges.
-- 6. Review last-admin protections, audit retention, backups and rollback.
