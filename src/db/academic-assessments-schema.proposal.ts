// REVIEW ONLY. Never export from schema.ts or include in a migration glob.
// Composite term/assignment targets below need separately reviewed prerequisites.
import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, integer, jsonb, numeric, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
// @ts-expect-error Node type stripping requires explicit source extension.
import { schools, academicLevels, academicSessions, terms, classes, memberships, enrollments, teacherClassAssignments } from './schema.ts';

export const proposedAssessmentConfigState = pgEnum('assessment_config_state', ['draft', 'finalized']);
export const proposedAssessmentMode = pgEnum('assessment_mode', ['numeric', 'observational']);
export const proposedAssessmentSubjects = pgTable('assessment_subjects', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(),
 code: varchar('code', { length: 40 }).notNull(), name: varchar('name', { length: 160 }).notNull(),
 isActive: boolean('is_active').default(true).notNull(), version: integer('version').default(1).notNull(),
}, t => [
 uniqueIndex('as_subject_school_id_uq').on(t.schoolId, t.id),
 uniqueIndex('as_subject_code_uq').on(t.schoolId, t.code),
 foreignKey({ columns: [t.schoolId], foreignColumns: [schools.id], name: 'as_subject_school_fk' }).onDelete('restrict'),
 check('as_subject_fields_valid', sql`${t.version} > 0 AND btrim(${t.code}) <> '' AND btrim(${t.name}) <> ''`),
]);
export const proposedAssessmentConfigs = pgTable('assessment_config_versions', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(),
 configKey: uuid('config_key').notNull(), revision: integer('revision').notNull(),
 levelId: uuid('level_id').notNull(), sessionId: uuid('session_id').notNull(), termId: uuid('term_id').notNull(),
 subjectId: uuid('subject_id'), mode: proposedAssessmentMode('mode').notNull(),
 state: proposedAssessmentConfigState('state').default('draft').notNull(),
 components: jsonb('components').notNull(), grading: jsonb('grading').notNull(),
}, t => [
 uniqueIndex('as_config_school_id_uq').on(t.schoolId, t.id),
 uniqueIndex('as_config_key_revision_uq').on(t.schoolId, t.configKey, t.revision),
 uniqueIndex('as_config_default_revision_uq').on(t.schoolId, t.levelId, t.sessionId, t.termId, t.revision).where(sql`${t.subjectId} IS NULL`),
 uniqueIndex('as_config_subject_revision_uq').on(t.schoolId, t.levelId, t.sessionId, t.termId, t.subjectId, t.revision).where(sql`${t.subjectId} IS NOT NULL`),
 foreignKey({ columns: [t.schoolId, t.levelId], foreignColumns: [academicLevels.schoolId, academicLevels.id], name: 'as_config_level_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.sessionId, t.termId], foreignColumns: [terms.schoolId, terms.sessionId, terms.id], name: 'as_config_term_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.subjectId], foreignColumns: [proposedAssessmentSubjects.schoolId, proposedAssessmentSubjects.id], name: 'as_config_subject_fk' }).onDelete('restrict'),
 check('as_config_payload_valid', sql`${t.revision} > 0 AND jsonb_typeof(${t.components}) = 'array' AND jsonb_array_length(${t.components}) > 0 AND jsonb_typeof(${t.grading}) = 'object'`),
]);
export const proposedAssessmentScopes = pgTable('assessment_scopes', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(),
 classId: uuid('class_id').notNull(), sessionId: uuid('session_id').notNull(), termId: uuid('term_id').notNull(),
 revision: integer('revision').default(1).notNull(),
}, t => [
 uniqueIndex('as_scope_school_id_uq').on(t.schoolId, t.id),
 uniqueIndex('as_scope_identity_uq').on(t.schoolId, t.classId, t.sessionId, t.termId),
 foreignKey({ columns: [t.schoolId, t.classId], foreignColumns: [classes.schoolId, classes.id], name: 'as_scope_class_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.sessionId], foreignColumns: [academicSessions.schoolId, academicSessions.id], name: 'as_scope_session_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.sessionId, t.termId], foreignColumns: [terms.schoolId, terms.sessionId, terms.id], name: 'as_scope_term_fk' }).onDelete('restrict'),
 check('as_scope_revision_positive', sql`${t.revision} > 0`),
]);
export const proposedAssessmentRoster = pgTable('assessment_subject_roster', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(), scopeId: uuid('scope_id').notNull(),
 subjectId: uuid('subject_id').notNull(), rosterVersion: integer('roster_version').default(1).notNull(), configVersionId: uuid('config_version_id').notNull(), isActive: boolean('is_active').default(true).notNull(),
}, t => [
 uniqueIndex('as_roster_school_id_uq').on(t.schoolId, t.id),
 uniqueIndex('as_roster_subject_version_uq').on(t.schoolId, t.scopeId, t.subjectId, t.rosterVersion),
 uniqueIndex('as_roster_active_subject_uq').on(t.schoolId, t.scopeId, t.subjectId).where(sql`${t.isActive} = true`),
 check('as_roster_version_positive', sql`${t.rosterVersion} > 0`),
 uniqueIndex('as_roster_config_target_uq').on(t.schoolId, t.id, t.configVersionId),
 uniqueIndex('as_roster_scope_target_uq').on(t.schoolId, t.id, t.scopeId),
 foreignKey({ columns: [t.schoolId, t.scopeId], foreignColumns: [proposedAssessmentScopes.schoolId, proposedAssessmentScopes.id], name: 'as_roster_scope_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.subjectId], foreignColumns: [proposedAssessmentSubjects.schoolId, proposedAssessmentSubjects.id], name: 'as_roster_subject_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.configVersionId], foreignColumns: [proposedAssessmentConfigs.schoolId, proposedAssessmentConfigs.id], name: 'as_roster_config_fk' }).onDelete('restrict'),
]);
export const proposedAssessmentTeachers = pgTable('assessment_teacher_subjects', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(),
 rosterId: uuid('roster_id').notNull(), classAssignmentId: uuid('class_assignment_id').notNull(),
 isActive: boolean('is_active').default(true).notNull(),
}, t => [
 uniqueIndex('as_teacher_subject_uq').on(t.schoolId, t.rosterId, t.classAssignmentId),
 foreignKey({ columns: [t.schoolId, t.rosterId], foreignColumns: [proposedAssessmentRoster.schoolId, proposedAssessmentRoster.id], name: 'as_teacher_roster_fk' }).onDelete('restrict'),
 // Requires UNIQUE(school_id,id) on actual teacher_class_assignments first.
 foreignKey({ columns: [t.schoolId, t.classAssignmentId], foreignColumns: [teacherClassAssignments.schoolId, teacherClassAssignments.id], name: 'as_teacher_class_assignment_fk' }).onDelete('restrict'),
]);
export const proposedAssessmentScores = pgTable('assessment_scores', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(),
 rosterId: uuid('roster_id').notNull(), configVersionId: uuid('config_version_id').notNull(),
 enrollmentId: uuid('enrollment_id').notNull(), studentId: uuid('student_id').notNull(),
 componentKey: varchar('component_key', { length: 128 }).notNull(),
 numericScore: numeric('numeric_score', { precision: 12, scale: 4 }), observationKey: varchar('observation_key', { length: 128 }),
 version: integer('version').default(1).notNull(), updatedBy: uuid('updated_by').notNull(),
}, t => [
 uniqueIndex('as_score_component_uq').on(t.schoolId, t.rosterId, t.enrollmentId, t.componentKey),
 foreignKey({ columns: [t.schoolId, t.rosterId, t.configVersionId], foreignColumns: [proposedAssessmentRoster.schoolId, proposedAssessmentRoster.id, proposedAssessmentRoster.configVersionId], name: 'as_score_roster_config_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.enrollmentId, t.studentId], foreignColumns: [enrollments.schoolId, enrollments.id, enrollments.studentId], name: 'as_score_enrollment_student_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.updatedBy], foreignColumns: [memberships.schoolId, memberships.id], name: 'as_score_actor_fk' }).onDelete('restrict'),
 check('as_score_value_valid', sql`${t.version} > 0 AND btrim(${t.componentKey}) <> '' AND ((${t.numericScore} IS NOT NULL AND ${t.numericScore} >= 0 AND ${t.numericScore} <> 'NaN'::numeric AND ${t.observationKey} IS NULL) OR (${t.numericScore} IS NULL AND ${t.observationKey} IS NOT NULL AND btrim(${t.observationKey}) <> ''))`),
]);
export const proposedAssessmentSources = pgTable('assessment_source_versions', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(), scopeId: uuid('scope_id').notNull(),
 revision: integer('revision').notNull(), sourceManifest: jsonb('source_manifest').notNull(), contentHash: varchar('content_hash', { length: 64 }).notNull(),
 createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
 uniqueIndex('as_source_scope_revision_uq').on(t.schoolId, t.scopeId, t.revision),
 uniqueIndex('as_source_scope_target_uq').on(t.schoolId, t.id, t.scopeId),
 foreignKey({ columns: [t.schoolId, t.scopeId], foreignColumns: [proposedAssessmentScopes.schoolId, proposedAssessmentScopes.id], name: 'as_source_scope_fk' }).onDelete('restrict'),
 check('as_source_payload_valid', sql`${t.revision} > 0 AND jsonb_typeof(${t.sourceManifest}) = 'object' AND ${t.contentHash} ~ '^[a-f0-9]{64}$'`),
]);
export const proposedAssessmentReviews = pgTable('assessment_teacher_reviews', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(), scopeId: uuid('scope_id').notNull(),
 rosterId: uuid('roster_id').notNull(), sourceVersionId: uuid('source_version_id').notNull(), reviewerMembershipId: uuid('reviewer_membership_id').notNull(),
 reviewedAt: timestamp('reviewed_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
 uniqueIndex('as_review_version_actor_uq').on(t.schoolId, t.rosterId, t.sourceVersionId, t.reviewerMembershipId),
 uniqueIndex('as_review_full_target_uq').on(t.schoolId, t.id, t.scopeId, t.rosterId, t.sourceVersionId),
 foreignKey({ columns: [t.schoolId, t.rosterId, t.scopeId], foreignColumns: [proposedAssessmentRoster.schoolId, proposedAssessmentRoster.id, proposedAssessmentRoster.scopeId], name: 'as_review_roster_scope_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.sourceVersionId, t.scopeId], foreignColumns: [proposedAssessmentSources.schoolId, proposedAssessmentSources.id, proposedAssessmentSources.scopeId], name: 'as_review_source_scope_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.reviewerMembershipId], foreignColumns: [memberships.schoolId, memberships.id], name: 'as_review_actor_fk' }).onDelete('restrict'),
]);
export const proposedAssessmentFinalizations = pgTable('assessment_finalizations', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(), scopeId: uuid('scope_id').notNull(), rosterId: uuid('roster_id').notNull(),
 sourceVersionId: uuid('source_version_id').notNull(), teacherReviewId: uuid('teacher_review_id').notNull(), finalizedBy: uuid('finalized_by').notNull(),
 results: jsonb('results').notNull(), contentHash: varchar('content_hash', { length: 64 }).notNull(),
 finalizedAt: timestamp('finalized_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
 uniqueIndex('as_finalization_source_subject_uq').on(t.schoolId, t.sourceVersionId, t.rosterId),
 foreignKey({ columns: [t.schoolId, t.teacherReviewId, t.scopeId, t.rosterId, t.sourceVersionId], foreignColumns: [proposedAssessmentReviews.schoolId, proposedAssessmentReviews.id, proposedAssessmentReviews.scopeId, proposedAssessmentReviews.rosterId, proposedAssessmentReviews.sourceVersionId], name: 'as_finalization_exact_review_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.finalizedBy], foreignColumns: [memberships.schoolId, memberships.id], name: 'as_finalization_actor_fk' }).onDelete('restrict'),
 check('as_finalization_payload_valid', sql`jsonb_typeof(${t.results}) = 'object' AND ${t.contentHash} ~ '^[a-f0-9]{64}$'`),
]);
export const proposedAssessmentAudit = pgTable('assessment_audit', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(), scopeId: uuid('scope_id').notNull(),
 actorMembershipId: uuid('actor_membership_id').notNull(), action: varchar('action', { length: 64 }).notNull(),
 beforeRevision: integer('before_revision').notNull(), afterRevision: integer('after_revision').notNull(),
 occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
 foreignKey({ columns: [t.schoolId, t.scopeId], foreignColumns: [proposedAssessmentScopes.schoolId, proposedAssessmentScopes.id], name: 'as_audit_scope_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.actorMembershipId], foreignColumns: [memberships.schoolId, memberships.id], name: 'as_audit_actor_fk' }).onDelete('restrict'),
 check('as_audit_revision_step', sql`${t.beforeRevision} > 0 AND ${t.afterRevision} IN (${t.beforeRevision}, ${t.beforeRevision} + 1) AND btrim(${t.action}) <> ''`),
]);
export const proposedAssessmentReceipts = pgTable('assessment_operation_receipts', {
 id: uuid('id').defaultRandom().primaryKey(), schoolId: uuid('school_id').notNull(), scopeId: uuid('scope_id').notNull(),
 actorMembershipId: uuid('actor_membership_id').notNull(), operationKey: varchar('operation_key', { length: 128 }).notNull(),
 fingerprint: varchar('fingerprint', { length: 64 }).notNull(), resultingRevision: integer('resulting_revision').notNull(), outcome: jsonb('outcome').notNull(),
}, t => [
 uniqueIndex('as_receipt_actor_operation_uq').on(t.schoolId, t.actorMembershipId, t.operationKey),
 foreignKey({ columns: [t.schoolId, t.scopeId], foreignColumns: [proposedAssessmentScopes.schoolId, proposedAssessmentScopes.id], name: 'as_receipt_scope_fk' }).onDelete('restrict'),
 foreignKey({ columns: [t.schoolId, t.actorMembershipId], foreignColumns: [memberships.schoolId, memberships.id], name: 'as_receipt_actor_fk' }).onDelete('restrict'),
 check('as_receipt_fields_valid', sql`${t.resultingRevision} > 0 AND btrim(${t.operationKey}) <> '' AND ${t.fingerprint} ~ '^[a-f0-9]{64}$' AND jsonb_typeof(${t.outcome}) = 'object'`),
]);
