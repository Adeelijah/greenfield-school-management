-- GREENFIELD ACADEMY: REVIEW-ONLY READ ACCESS BASELINE
-- NOT A DRIZZLE MIGRATION. DO NOT EXECUTE UNTIL FOUNDATION SCHEMA IS APPLIED,
-- SECURITY REVIEW IS COMPLETE, AND A TEST/ROLLBACK PLAN IS APPROVED.
-- Assumes the 12 tables in drizzle/0000_broad_slayback.sql already exist.
-- Intentionally contains NO writes for browser authenticated users.
--
-- Unlike the earlier SECURITY DEFINER draft, this version relies on a
-- nonrecursive membership -> school_users RLS dependency. school_users
-- policy references only auth.uid(), so membership lookup terminates.
--
-- NOTE: direct server PostgreSQL connections may bypass RLS; separate
-- authorization and least-privilege database credentials are still required.
--
-- The following grants/revokes must be reviewed for all other roles,
-- preexisting policies, table ownership, and Supabase exposed schemas.
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

-- Force owners through RLS too; does not affect superusers/BYPASSRLS.
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

-- Self-only identity and membership. No recursive policy dependency.
CREATE POLICY greenfield_school_user_self_select ON public.school_users
FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.uid()));

CREATE POLICY greenfield_membership_self_select ON public.memberships
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.school_users su
  WHERE su.id = memberships.user_id
    AND su.auth_user_id = (SELECT auth.uid())
));

-- Memberships are RLS-filtered to the verified current user's records.
-- A school is visible only when the current user has an active membership.
CREATE POLICY greenfield_school_member_select ON public.schools
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = schools.id AND m.status = 'active'
));

CREATE POLICY greenfield_session_member_select ON public.academic_sessions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = academic_sessions.school_id AND m.status = 'active'
));

CREATE POLICY greenfield_term_member_select ON public.terms
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = terms.school_id AND m.status = 'active'
));

CREATE POLICY greenfield_class_member_select ON public.classes
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = classes.school_id AND m.status = 'active'
));

CREATE POLICY greenfield_student_member_select ON public.students
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = students.school_id AND m.status = 'active'
));

CREATE POLICY greenfield_guardian_member_select ON public.guardians
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = guardians.school_id AND m.status = 'active'
));

CREATE POLICY greenfield_student_guardian_member_select ON public.student_guardians
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = student_guardians.school_id AND m.status = 'active'
));

CREATE POLICY greenfield_enrollment_member_select ON public.enrollments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = enrollments.school_id AND m.status = 'active'
));

CREATE POLICY greenfield_admission_member_select ON public.admissions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = admissions.school_id AND m.status = 'active'
));

-- Audit events are visible only to active admins.
CREATE POLICY greenfield_audit_admin_select ON public.audit_events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = audit_events.school_id
    AND m.status = 'active'
    AND m.role = 'admin'
));

-- RLS is not a substitute for table privileges.
-- Only read access is granted; no INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES, or TRIGGER grants are given to anon/authenticated.
GRANT SELECT ON TABLE
  public.schools,
  public.school_users,
  public.memberships,
  public.academic_sessions,
  public.terms,
  public.classes,
  public.students,
  public.guardians,
  public.student_guardians,
  public.enrollments,
  public.admissions,
  public.audit_events
TO authenticated;

-- Release blockers:
-- 1. RLS integration tests using JWT-backed anon/authenticated sessions.
-- 2. Review access to sensitive student/guardian fields; table-wide SELECT
--    may be too broad for teachers/bursars. Role-specific column access is
--    required before real records.
-- 3. Secure write policies and server authorization, including last-admin rule.
-- 4. Review existing policies and default grants on public schema.
-- 5. Bootstrap via an audited operator-only transaction.
-- 6. Migration journal and deployment/rollback plan.
