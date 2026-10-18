-- STEP 494 SECURITY PROPOSAL ONLY. DO NOT EXECUTE OR APPEND TO 09.
-- 09 is a read-only proposal, not proof of deployed state. Inspect pg_policy,
-- role inheritance, PUBLIC/default grants, owners and BYPASSRLS first. A broad
-- permissive policy ORs with a narrow one; replacement must be reviewed as a unit.
-- Separate school database is a deployment boundary, not permission to omit
-- school_id predicates or server-side resource authorization.

-- New tables: deny browser access by default. RLS is enforced even for owners
-- unless the connection is a superuser or has BYPASSRLS. Do not grant either.
ALTER TABLE academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_levels FORCE ROW LEVEL SECURITY;
ALTER TABLE academic_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE student_lifecycle_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_lifecycle_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE student_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_departures FORCE ROW LEVEL SECURITY;
ALTER TABLE student_readmissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_readmissions FORCE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_assignments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON academic_levels, academic_sections, student_lifecycle_decisions,
  student_departures, student_readmissions, teacher_class_assignments
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON academic_levels, academic_sections, student_lifecycle_decisions,
  student_departures, student_readmissions, teacher_class_assignments
  FROM greenfield_app;

-- Candidate browser read policies ONLY after replacing broad existing policies
-- and reviewing the school_users/memberships RLS dependency chain. Bursars have
-- finance access elsewhere, not student lifecycle access. No browser writes.
CREATE POLICY gf_level_staff_read ON academic_levels FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM memberships m JOIN school_users u ON u.id = m.user_id
  WHERE m.school_id = academic_levels.school_id AND m.status = 'active'
    AND m.role IN ('admin', 'teacher') AND u.auth_user_id = (SELECT auth.uid())
));
CREATE POLICY gf_section_staff_read ON academic_sections FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM memberships m JOIN school_users u ON u.id = m.user_id
  WHERE m.school_id = academic_sections.school_id AND m.status = 'active'
    AND m.role IN ('admin', 'teacher') AND u.auth_user_id = (SELECT auth.uid())
));
GRANT SELECT ON academic_levels, academic_sections TO authenticated;

-- No authenticated policy or grants for decisions, departures, readmissions,
-- assignments or audit. Admin full-profile/audit reads and all writes require a
-- separately reviewed server operation. Teacher roster/proposal must also
-- check active teacher_class_assignments for the student's current class and
-- session; no broad students SELECT policy may remain. There is no safe
-- teacher roster grant in this draft.

-- Candidate future greenfield_app grants are intentionally withheld. Before
-- adding them, prove (1) actual role is NOLOGIN? / login as intended, NOSUPERUSER,
-- NOBYPASSRLS, not table owner, (2) how RLS gets a trusted school identity for
-- each transaction, (3) operation-specific column grants or vetted functions,
-- (4) transaction audit cannot be bypassed by the application role. A caller-
-- writable custom GUC alone is not a trusted RLS identity.
