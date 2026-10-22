-- REVIEW ONLY. Not journaled, not installed, and not authorized for execution.
-- Delta for a separately reconciled public 0000_broad_slayback baseline ONLY.
-- Requires an explicitly authorized isolated target and an enclosing transaction.
-- No IF NOT EXISTS: conflicting/partially installed definitions must be reviewed.
-- Keep endpoints/role grants disabled; this installs no security or source guards.
-- No class backfill or school final-year choice is inferred here.

CREATE TYPE public.academic_stage AS ENUM ('creche', 'nursery', 'primary');

ALTER TABLE public.schools ADD COLUMN final_primary_year integer;
ALTER TABLE public.schools ADD COLUMN structure_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.schools ADD CONSTRAINT schools_final_primary_year_valid CHECK (final_primary_year IN (5, 6));
ALTER TABLE public.schools ADD CONSTRAINT schools_structure_version_nonnegative CHECK (structure_version >= 0);
CREATE UNIQUE INDEX memberships_school_id_id_unique ON public.memberships (school_id, id);
CREATE UNIQUE INDEX enrollments_school_id_id_unique ON public.enrollments (school_id, id);
CREATE UNIQUE INDEX enrollments_school_id_student_id_unique ON public.enrollments (school_id, id, student_id);

CREATE TABLE public.academic_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL CONSTRAINT academic_levels_school_id_schools_id_fk REFERENCES public.schools(id) ON DELETE RESTRICT,
  name varchar(80) NOT NULL,
  stage public.academic_stage NOT NULL,
  primary_year integer,
  progression_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT academic_levels_primary_year_valid CHECK ((stage = 'primary' AND primary_year BETWEEN 1 AND 6) OR (stage <> 'primary' AND primary_year IS NULL)),
  CONSTRAINT academic_levels_order_positive CHECK (progression_order > 0)
);
CREATE UNIQUE INDEX academic_levels_school_id_id_unique ON public.academic_levels (school_id, id);
CREATE UNIQUE INDEX academic_levels_school_order_unique ON public.academic_levels (school_id, progression_order);
CREATE UNIQUE INDEX academic_levels_school_name_unique ON public.academic_levels (school_id, name);
CREATE UNIQUE INDEX academic_levels_school_primary_year_unique ON public.academic_levels (school_id, primary_year) WHERE stage = 'primary';

CREATE TABLE public.academic_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL CONSTRAINT academic_sections_school_id_schools_id_fk REFERENCES public.schools(id) ON DELETE RESTRICT,
  level_id uuid NOT NULL,
  name varchar(40) NOT NULL,
  display_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT academic_sections_school_level_fk FOREIGN KEY (school_id, level_id) REFERENCES public.academic_levels(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT academic_sections_order_positive CHECK (display_order > 0)
);
CREATE UNIQUE INDEX academic_sections_school_id_id_unique ON public.academic_sections (school_id, id);
CREATE UNIQUE INDEX academic_sections_school_level_id_id_unique ON public.academic_sections (school_id, level_id, id);
CREATE UNIQUE INDEX academic_sections_level_name_unique ON public.academic_sections (level_id, name);
CREATE UNIQUE INDEX academic_sections_level_order_unique ON public.academic_sections (level_id, display_order);

ALTER TABLE public.classes ADD COLUMN level_id uuid;
ALTER TABLE public.classes ADD COLUMN section_id uuid;
ALTER TABLE public.classes ADD CONSTRAINT classes_mapping_both_or_neither CHECK ((level_id IS NULL) = (section_id IS NULL));
ALTER TABLE public.classes ADD CONSTRAINT classes_school_level_fk FOREIGN KEY (school_id, level_id) REFERENCES public.academic_levels(school_id, id) ON DELETE RESTRICT;
ALTER TABLE public.classes ADD CONSTRAINT classes_school_level_section_fk FOREIGN KEY (school_id, level_id, section_id) REFERENCES public.academic_sections(school_id, level_id, id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX classes_school_level_section_unique ON public.classes (school_id, level_id, section_id) WHERE level_id IS NOT NULL AND section_id IS NOT NULL;

CREATE TABLE public.teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL CONSTRAINT teacher_class_assignments_school_id_schools_id_fk REFERENCES public.schools(id) ON DELETE RESTRICT,
  teacher_membership_id uuid NOT NULL,
  class_id uuid NOT NULL,
  session_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT teacher_class_assignments_school_teacher_fk FOREIGN KEY (school_id, teacher_membership_id) REFERENCES public.memberships(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT teacher_class_assignments_school_class_fk FOREIGN KEY (school_id, class_id) REFERENCES public.classes(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT teacher_class_assignments_school_session_fk FOREIGN KEY (school_id, session_id) REFERENCES public.academic_sessions(school_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX teacher_class_assignments_active_unique ON public.teacher_class_assignments (teacher_membership_id, class_id, session_id) WHERE ended_at IS NULL;
CREATE INDEX teacher_class_assignments_class_session_idx ON public.teacher_class_assignments (school_id, class_id, session_id);


-- Additional exact FK targets required by assessment/report proposals.
CREATE UNIQUE INDEX terms_school_session_id_unique ON public.terms (school_id, session_id, id);
CREATE UNIQUE INDEX teacher_class_assignments_school_id_id_unique ON public.teacher_class_assignments (school_id, id);
CREATE UNIQUE INDEX enrollments_report_binding_unique ON public.enrollments (school_id, id, student_id, class_id, session_id);

-- STOP: nullable school/class mapping is deliberate. Review fictional setup and
-- mapping before later NOT NULL enforcement. No UPDATE/backfill is included.
-- Assessment/report tables, common lock protocol, history guards, RLS/grants,
-- runtime/authentication and migration-journal reconciliation remain separate.
