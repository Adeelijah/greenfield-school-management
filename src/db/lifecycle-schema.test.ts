import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableConfig } from 'drizzle-orm/pg-core';
// @ts-expect-error Node 22 direct type stripping requires the TypeScript extension.
import * as schema from './schema.ts';

const config = (table: Parameters<typeof getTableConfig>[0]) => getTableConfig(table);
const indexNames = (table: Parameters<typeof getTableConfig>[0]) => config(table).indexes.map(index => index.config.name);
const foreignKeyNames = (table: Parameters<typeof getTableConfig>[0]) => config(table).foreignKeys.map(key => key.getName());

test('academic structure has ordered levels and independent school-scoped sections', () => {
  assert.deepEqual(schema.academicStage.enumValues, ['creche', 'nursery', 'primary']);
  assert.ok(indexNames(schema.academicLevels).includes('academic_levels_school_order_unique'));
  assert.ok(indexNames(schema.academicSections).includes('academic_sections_level_name_unique'));
  assert.ok(foreignKeyNames(schema.academicSections).includes('academic_sections_school_level_fk'));
  assert.ok(foreignKeyNames(schema.classes).includes('classes_school_level_section_fk'));
  assert.ok(config(schema.classes).checks.some(check => check.name === 'classes_mapping_both_or_neither'));
});

test('decisions, departures and readmissions retain tenant and student links', () => {
  assert.ok(foreignKeyNames(schema.studentLifecycleDecisions).includes('lifecycle_decisions_source_student_fk'));
  assert.ok(foreignKeyNames(schema.studentDepartures).includes('student_departures_source_student_fk'));
  assert.ok(foreignKeyNames(schema.studentReadmissions).includes('student_readmissions_departure_student_fk'));
  assert.ok(indexNames(schema.studentLifecycleDecisions).includes('lifecycle_decisions_student_destination_applied_unique'));
  assert.ok(indexNames(schema.studentDepartures).includes('student_departures_source_unique'));
  assert.ok(indexNames(schema.studentReadmissions).includes('student_readmissions_departure_unique'));
});

test('assignment and audit preserve school-scoped actor references', () => {
  assert.ok(foreignKeyNames(schema.teacherClassAssignments).includes('teacher_class_assignments_school_teacher_fk'));
  assert.ok(foreignKeyNames(schema.auditEvents).includes('audit_events_school_actor_membership_fk'));
  assert.ok(indexNames(schema.teacherClassAssignments).includes('teacher_class_assignments_active_unique'));
});
