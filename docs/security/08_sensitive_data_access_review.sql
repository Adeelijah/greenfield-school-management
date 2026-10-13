-- GREENFIELD: REVIEW-ONLY least-privilege alternative for sensitive tables.
-- NOT AN EXECUTABLE MIGRATION. Replaces (does not augment) the corresponding
-- sensitive-table policies and table-wide grants in 07_read_only_rls_baseline.sql.
-- Never apply both versions as-is: permissive RLS policies combine with OR.
-- Prerequisites: foundation tables, auth FK, complete privilege audit,
-- nonprivileged JWT-backed tests and server-side authorization review.
--
-- Explicit access model for initial launch:
-- admin: student, guardian, relationships, enrollment and admission records
-- teacher: student identity/roster fields only; no date_of_birth, guardian
--          contact details, admission applications or audit records
-- bursar: no student, guardian, relationship, enrollment or admissions SELECT
-- These restrictions are conservative pending product requirements review.
--
-- The existing membership and school_users self-only SELECT policies in 07
-- are prerequisites; membership lookup must remain RLS-filtered to auth.uid().
-- SQL below is intentionally documentation, not executable migration.

-- For students: role-gated row policy, plus column-specific grants.
-- IMPORTANT: PostgreSQL column grants are cumulative with table grants.
-- Revoke the original table-wide SELECT first, then grant only safe columns.
REVOKE SELECT ON public.students FROM authenticated;
CREATE POLICY greenfield_student_admin_teacher_select ON public.students
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.school_id = students.school_id
    AND m.status = 'active'
    AND m.role IN ('admin', 'teacher')
));
-- A teacher could still read all columns if admin's full-table GRANT applied
-- to the shared 'authenticated' DB role. RLS cannot restrict columns by JWT
-- role when using the same PostgreSQL role. Do NOT grant full-table SELECT.
GRANT SELECT (id, school_id, admission_number, first_name, last_name, status)
ON public.students TO authenticated;

-- Guardian, student_guardians, enrollment and admissions are withheld from
-- the browser 'authenticated' role in this conservative baseline.
REVOKE SELECT ON public.guardians, public.student_guardians,
  public.enrollments, public.admissions FROM authenticated;
-- No browser SELECT policies for those four tables in this alternative.
--
-- Full admin access to sensitive columns must instead go through vetted
-- server-only handlers with verified auth identity, school and role checks,
-- using a separately reviewed least-privilege DB connection.
-- That server path must NOT rely on RLS if its DB role has BYPASSRLS.
--
-- REQUIRED before execution:
-- 1. Rewrite the 07 baseline as one coherent, tracked migration. Drop the
--    broad student/member policies rather than adding a second permissive one.
-- 2. Test role/tenant matrices using actual JWT claims and PostgREST.
-- 3. Check inherited grants, PUBLIC grants, default privileges and other
--    existing policies. A single permissive policy can widen access.
-- 4. Test all privileged server handlers independently.
-- 5. Determine whether teachers require guardian emergency contacts via a
--    purpose-limited endpoint; do not expose guardian table wholesale.
