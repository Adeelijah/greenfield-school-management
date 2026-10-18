-- STEP 494 REVIEW DRAFT ONLY. NOT A JOURNALED MIGRATION. DO NOT EXECUTE.
-- Forward-only DDL outline. Reconcile against deployed 0000 and run preflight
-- duplicate checks in an authorized isolated database before creating a migration.
-- Keep legacy class mapping nullable until every row is manually classified.
CREATE TYPE academic_stage AS ENUM ('creche', 'nursery', 'primary');
CREATE TYPE lifecycle_decision_kind AS ENUM ('promote', 'repeat', 'graduate');
CREATE TYPE lifecycle_decision_status AS ENUM ('proposed', 'applied', 'rejected');
CREATE TYPE student_departure_kind AS ENUM ('transfer', 'early_exit');

ALTER TABLE schools ADD COLUMN final_primary_year integer;
ALTER TABLE schools ADD COLUMN structure_version integer NOT NULL DEFAULT 0;
ALTER TABLE schools ADD CONSTRAINT schools_final_primary_year_valid CHECK (final_primary_year IN (5, 6));
ALTER TABLE schools ADD CONSTRAINT schools_structure_version_nonnegative CHECK (structure_version >= 0);
CREATE UNIQUE INDEX memberships_school_id_id_unique ON memberships (school_id, id);
CREATE UNIQUE INDEX enrollments_school_id_id_unique ON enrollments (school_id, id);
CREATE UNIQUE INDEX enrollments_school_id_student_id_unique ON enrollments (school_id, id, student_id);

CREATE TABLE academic_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name varchar(80) NOT NULL,
  stage academic_stage NOT NULL,
  primary_year integer,
  progression_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT academic_levels_primary_year_valid CHECK ((stage = 'primary' AND primary_year BETWEEN 1 AND 6) OR (stage <> 'primary' AND primary_year IS NULL)),
  CONSTRAINT academic_levels_order_positive CHECK (progression_order > 0)
);
CREATE UNIQUE INDEX academic_levels_school_id_id_unique ON academic_levels (school_id, id);
CREATE UNIQUE INDEX academic_levels_school_order_unique ON academic_levels (school_id, progression_order);
CREATE UNIQUE INDEX academic_levels_school_name_unique ON academic_levels (school_id, name);
CREATE UNIQUE INDEX academic_levels_school_primary_year_unique ON academic_levels (school_id, primary_year) WHERE stage = 'primary';

CREATE TABLE academic_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  level_id uuid NOT NULL,
  name varchar(40) NOT NULL,
  display_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT academic_sections_school_level_fk FOREIGN KEY (school_id, level_id) REFERENCES academic_levels(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT academic_sections_order_positive CHECK (display_order > 0)
);
CREATE UNIQUE INDEX academic_sections_school_id_id_unique ON academic_sections (school_id, id);
CREATE UNIQUE INDEX academic_sections_school_level_id_id_unique ON academic_sections (school_id, level_id, id);
CREATE UNIQUE INDEX academic_sections_level_name_unique ON academic_sections (level_id, name);
CREATE UNIQUE INDEX academic_sections_level_order_unique ON academic_sections (level_id, display_order);

ALTER TABLE classes ADD COLUMN level_id uuid;
ALTER TABLE classes ADD COLUMN section_id uuid;
ALTER TABLE classes ADD CONSTRAINT classes_mapping_both_or_neither CHECK ((level_id IS NULL) = (section_id IS NULL));
ALTER TABLE classes ADD CONSTRAINT classes_school_level_fk FOREIGN KEY (school_id, level_id) REFERENCES academic_levels(school_id, id) ON DELETE RESTRICT;
ALTER TABLE classes ADD CONSTRAINT classes_school_level_section_fk FOREIGN KEY (school_id, level_id, section_id) REFERENCES academic_sections(school_id, level_id, id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX classes_school_level_section_unique ON classes (school_id, level_id, section_id) WHERE level_id IS NOT NULL AND section_id IS NOT NULL;

CREATE TABLE student_lifecycle_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL,
  source_enrollment_id uuid NOT NULL,
  destination_session_id uuid,
  destination_class_id uuid,
  kind lifecycle_decision_kind NOT NULL,
  status lifecycle_decision_status NOT NULL DEFAULT 'proposed',
  structure_version integer NOT NULL,
  proposed_by_membership_id uuid NOT NULL,
  finalized_by_membership_id uuid,
  idempotency_key uuid NOT NULL,
  payload_fingerprint varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CONSTRAINT lifecycle_decisions_school_student_fk FOREIGN KEY (school_id, student_id) REFERENCES students(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT lifecycle_decisions_source_student_fk FOREIGN KEY (school_id, source_enrollment_id, student_id) REFERENCES enrollments(school_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT lifecycle_decisions_destination_session_fk FOREIGN KEY (school_id, destination_session_id) REFERENCES academic_sessions(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT lifecycle_decisions_destination_class_fk FOREIGN KEY (school_id, destination_class_id) REFERENCES classes(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT lifecycle_decisions_proposer_fk FOREIGN KEY (school_id, proposed_by_membership_id) REFERENCES memberships(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT lifecycle_decisions_finalizer_fk FOREIGN KEY (school_id, finalized_by_membership_id) REFERENCES memberships(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT lifecycle_decisions_destination_valid CHECK ((kind = 'graduate' AND destination_class_id IS NULL AND destination_session_id IS NULL) OR (kind IN ('promote', 'repeat') AND destination_class_id IS NOT NULL AND destination_session_id IS NOT NULL)),
  CONSTRAINT lifecycle_decisions_finalization_valid CHECK ((status = 'proposed' AND finalized_by_membership_id IS NULL AND finalized_at IS NULL) OR (status IN ('applied', 'rejected') AND finalized_by_membership_id IS NOT NULL AND finalized_at IS NOT NULL)),
  CONSTRAINT lifecycle_decisions_structure_version_nonnegative CHECK (structure_version >= 0)
);
CREATE UNIQUE INDEX lifecycle_decisions_school_id_id_unique ON student_lifecycle_decisions (school_id, id);
CREATE UNIQUE INDEX lifecycle_decisions_school_idempotency_unique ON student_lifecycle_decisions (school_id, idempotency_key);
CREATE UNIQUE INDEX lifecycle_decisions_student_destination_applied_unique ON student_lifecycle_decisions (student_id, destination_session_id) WHERE status = 'applied' AND destination_session_id IS NOT NULL;
CREATE UNIQUE INDEX lifecycle_decisions_source_graduation_applied_unique ON student_lifecycle_decisions (source_enrollment_id) WHERE status = 'applied' AND kind = 'graduate';

CREATE TABLE student_departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL,
  source_enrollment_id uuid NOT NULL,
  kind student_departure_kind NOT NULL,
  reason_code varchar(40) NOT NULL,
  effective_on date NOT NULL,
  destination_school_name varchar(180),
  guardian_review_confirmed boolean NOT NULL,
  finalized_by_membership_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  payload_fingerprint varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_departures_school_student_fk FOREIGN KEY (school_id, student_id) REFERENCES students(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT student_departures_source_student_fk FOREIGN KEY (school_id, source_enrollment_id, student_id) REFERENCES enrollments(school_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT student_departures_finalizer_fk FOREIGN KEY (school_id, finalized_by_membership_id) REFERENCES memberships(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT student_departures_guardian_review_required CHECK (guardian_review_confirmed = true),
  CONSTRAINT student_departures_transfer_destination_required CHECK (kind <> 'transfer' OR NULLIF(BTRIM(destination_school_name), '') IS NOT NULL)
);
CREATE UNIQUE INDEX student_departures_school_id_id_unique ON student_departures (school_id, id);
CREATE UNIQUE INDEX student_departures_school_id_student_id_unique ON student_departures (school_id, id, student_id);
CREATE UNIQUE INDEX student_departures_school_idempotency_unique ON student_departures (school_id, idempotency_key);
CREATE UNIQUE INDEX student_departures_source_unique ON student_departures (source_enrollment_id);

CREATE TABLE student_readmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL,
  departure_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  finalized_by_membership_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  payload_fingerprint varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_readmissions_school_student_fk FOREIGN KEY (school_id, student_id) REFERENCES students(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT student_readmissions_departure_student_fk FOREIGN KEY (school_id, departure_id, student_id) REFERENCES student_departures(school_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT student_readmissions_enrollment_student_fk FOREIGN KEY (school_id, enrollment_id, student_id) REFERENCES enrollments(school_id, id, student_id) ON DELETE RESTRICT,
  CONSTRAINT student_readmissions_finalizer_fk FOREIGN KEY (school_id, finalized_by_membership_id) REFERENCES memberships(school_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX student_readmissions_departure_unique ON student_readmissions (departure_id);
CREATE UNIQUE INDEX student_readmissions_enrollment_unique ON student_readmissions (enrollment_id);
CREATE UNIQUE INDEX student_readmissions_school_idempotency_unique ON student_readmissions (school_id, idempotency_key);

CREATE TABLE teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  teacher_membership_id uuid NOT NULL,
  class_id uuid NOT NULL,
  session_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT teacher_class_assignments_school_teacher_fk FOREIGN KEY (school_id, teacher_membership_id) REFERENCES memberships(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT teacher_class_assignments_school_class_fk FOREIGN KEY (school_id, class_id) REFERENCES classes(school_id, id) ON DELETE RESTRICT,
  CONSTRAINT teacher_class_assignments_school_session_fk FOREIGN KEY (school_id, session_id) REFERENCES academic_sessions(school_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX teacher_class_assignments_active_unique ON teacher_class_assignments (teacher_membership_id, class_id, session_id) WHERE ended_at IS NULL;
CREATE INDEX teacher_class_assignments_class_session_idx ON teacher_class_assignments (school_id, class_id, session_id);

ALTER TABLE audit_events ADD COLUMN request_id uuid;
ALTER TABLE audit_events ADD COLUMN actor_membership_id uuid;
ALTER TABLE audit_events ADD COLUMN actor_role school_role;
ALTER TABLE audit_events ADD COLUMN previous_state varchar(40);
ALTER TABLE audit_events ADD COLUMN next_state varchar(40);
ALTER TABLE audit_events ADD CONSTRAINT audit_events_school_actor_membership_fk FOREIGN KEY (school_id, actor_membership_id) REFERENCES memberships(school_id, id) ON DELETE RESTRICT;

-- Follow-up gate, not part of the additive phase: after reviewed mapping,
-- require classes.level_id/section_id and schools.final_primary_year NOT NULL.
-- Never infer ambiguous class rows from names, and never drop legacy columns
-- while historical enrollment/admission references depend on them.
