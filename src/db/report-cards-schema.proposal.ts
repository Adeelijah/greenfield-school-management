// REVIEW-ONLY schema proposal. NOT exported from src/db/schema.ts, migrated, or deployed.
// This module must not be included in Drizzle Kit's configured schema entrypoint.
import { sql } from 'drizzle-orm';
import { check, foreignKey, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar, index } from 'drizzle-orm/pg-core';
// @ts-expect-error Node 22 type stripping requires the explicit source extension.
import { academicSessions, classes, memberships, students } from './schema.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { proposedAssessmentScopes, proposedAssessmentSources } from './academic-assessments-schema.proposal.ts';

// Shadow declaration ONLY: describes the required composite key on the existing
// terms table without changing the production schema or generating a migration.
// Never include this proposal file in a Drizzle Kit schema glob.
export const proposedTermsCompositeTarget = pgTable('terms', {
 id: uuid('id').primaryKey(),
 schoolId: uuid('school_id').notNull(),
 sessionId: uuid('session_id').notNull(),
}, t => [
 uniqueIndex('terms_school_session_id_unique').on(t.schoolId, t.sessionId, t.id),
]);

// Shadow prerequisite ONLY; the actual enrollments relation is created from
// schema.ts in fixtures, then this reviewed target index is added separately.
export const proposedEnrollmentCompositeTarget = pgTable('enrollments', {
 id:uuid('id').primaryKey(), schoolId:uuid('school_id').notNull(),
 studentId:uuid('student_id').notNull(), classId:uuid('class_id').notNull(), sessionId:uuid('session_id').notNull(),
},t=>[uniqueIndex('enrollments_report_binding_unique').on(t.schoolId,t.id,t.studentId,t.classId,t.sessionId)]);

export const proposedReportStage = pgEnum('report_card_stage', ['draft','submitted','returned','approved','published']);
export const proposedReportAction = pgEnum('report_card_action', ['submit','return','approve','publish','reopen']);

export const proposedReportCards = pgTable('report_cards', {
 id:uuid('id').defaultRandom().primaryKey(),
 schoolId:uuid('school_id').notNull(),
 enrollmentId:uuid('enrollment_id').notNull(),
 studentId:uuid('student_id').notNull(),
 classId:uuid('class_id').notNull(),
 sessionId:uuid('session_id').notNull(),
 termId:uuid('term_id').notNull(),
 stage:proposedReportStage('stage').default('draft').notNull(),
 version:integer('version').default(1).notNull(),
 assessmentScopeId:uuid('assessment_scope_id').notNull(),
 assessmentSourceVersionId:uuid('assessment_source_version_id').notNull(),
 assessmentRevision:integer('assessment_revision').notNull(),
 submittedBy:uuid('submitted_by'),
 approvedBy:uuid('approved_by'),
 publishedAt:timestamp('published_at',{withTimezone:true}),
 returnReason:text('return_reason'),
 createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
},t=>[
 uniqueIndex('report_cards_school_identity_unique').on(t.schoolId,t.studentId,t.classId,t.sessionId,t.termId),
 uniqueIndex('report_cards_school_id_unique').on(t.schoolId,t.id),
 uniqueIndex('report_cards_enrollment_scope_target_unique').on(t.schoolId,t.id,t.enrollmentId,t.assessmentScopeId),
 foreignKey({columns:[t.schoolId,t.enrollmentId,t.studentId,t.classId,t.sessionId],foreignColumns:[proposedEnrollmentCompositeTarget.schoolId,proposedEnrollmentCompositeTarget.id,proposedEnrollmentCompositeTarget.studentId,proposedEnrollmentCompositeTarget.classId,proposedEnrollmentCompositeTarget.sessionId],name:'report_cards_enrollment_binding_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.assessmentScopeId,t.classId,t.sessionId,t.termId],foreignColumns:[proposedAssessmentScopes.schoolId,proposedAssessmentScopes.id,proposedAssessmentScopes.classId,proposedAssessmentScopes.sessionId,proposedAssessmentScopes.termId],name:'report_cards_assessment_scope_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.assessmentSourceVersionId,t.assessmentScopeId,t.assessmentRevision],foreignColumns:[proposedAssessmentSources.schoolId,proposedAssessmentSources.id,proposedAssessmentSources.scopeId,proposedAssessmentSources.revision],name:'report_cards_assessment_source_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.studentId],foreignColumns:[students.schoolId,students.id],name:'report_cards_school_student_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.classId],foreignColumns:[classes.schoolId,classes.id],name:'report_cards_school_class_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.sessionId],foreignColumns:[academicSessions.schoolId,academicSessions.id],name:'report_cards_school_session_fk'}).onDelete('restrict'),
 // Requires separately approved prerequisite UNIQUE (school_id, session_id, id) on live terms.
 foreignKey({columns:[t.schoolId,t.sessionId,t.termId],foreignColumns:[proposedTermsCompositeTarget.schoolId,proposedTermsCompositeTarget.sessionId,proposedTermsCompositeTarget.id],name:'report_cards_school_session_term_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.submittedBy],foreignColumns:[memberships.schoolId,memberships.id],name:'report_cards_school_submitter_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.approvedBy],foreignColumns:[memberships.schoolId,memberships.id],name:'report_cards_school_approver_fk'}).onDelete('restrict'),
 check('report_cards_version_positive',sql`${t.version} > 0`),
 check('report_cards_assessment_revision_positive',sql`${t.assessmentRevision} > 0`),
 check('report_cards_stage_fields_valid',sql`
  (${t.stage} = 'draft' AND ${t.submittedBy} IS NULL AND ${t.approvedBy} IS NULL AND ${t.publishedAt} IS NULL AND ${t.returnReason} IS NULL) OR
  (${t.stage} = 'submitted' AND ${t.submittedBy} IS NOT NULL AND ${t.approvedBy} IS NULL AND ${t.publishedAt} IS NULL AND ${t.returnReason} IS NULL) OR
  (${t.stage} = 'returned' AND ${t.submittedBy} IS NOT NULL AND ${t.approvedBy} IS NULL AND ${t.publishedAt} IS NULL AND ${t.returnReason} IS NOT NULL AND length(trim(${t.returnReason})) > 0) OR
  (${t.stage} IN ('approved','published') AND ${t.submittedBy} IS NOT NULL AND ${t.approvedBy} IS NOT NULL AND ${t.submittedBy} <> ${t.approvedBy} AND ${t.returnReason} IS NULL AND
   ((${t.stage} = 'approved' AND ${t.publishedAt} IS NULL) OR (${t.stage} = 'published' AND ${t.publishedAt} IS NOT NULL)))
 `),
]);

export const proposedReportSnapshots = pgTable('report_card_snapshots',{
 id:uuid('id').defaultRandom().primaryKey(),
 schoolId:uuid('school_id').notNull(),
 reportId:uuid('report_id').notNull(),
 reportVersion:integer('report_version').notNull(),
 enrollmentId:uuid('enrollment_id').notNull(),
 assessmentScopeId:uuid('assessment_scope_id').notNull(),
 assessmentSourceVersionId:uuid('assessment_source_version_id').notNull(),
 assessmentRevision:integer('assessment_revision').notNull(),
 sourceVersions:jsonb('source_versions').notNull(),
 contentHash:varchar('content_hash',{length:64}).notNull(),
 canonicalPayload:jsonb('canonical_payload').notNull(),
 createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
},t=>[
 uniqueIndex('report_snapshots_school_id_unique').on(t.schoolId,t.id),
 uniqueIndex('report_snapshots_report_version_unique').on(t.schoolId,t.reportId,t.reportVersion),
 uniqueIndex('report_snapshots_report_version_target_unique').on(t.schoolId,t.reportId,t.id,t.reportVersion),
 index('report_snapshots_report_idx').on(t.schoolId,t.reportId),
 foreignKey({columns:[t.schoolId,t.reportId],foreignColumns:[proposedReportCards.schoolId,proposedReportCards.id],name:'report_snapshots_school_report_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.reportId,t.enrollmentId,t.assessmentScopeId],foreignColumns:[proposedReportCards.schoolId,proposedReportCards.id,proposedReportCards.enrollmentId,proposedReportCards.assessmentScopeId],name:'report_snapshots_report_binding_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.assessmentSourceVersionId,t.assessmentScopeId,t.assessmentRevision],foreignColumns:[proposedAssessmentSources.schoolId,proposedAssessmentSources.id,proposedAssessmentSources.scopeId,proposedAssessmentSources.revision],name:'report_snapshots_assessment_source_fk'}).onDelete('restrict'),
 check('report_snapshots_hash_length',sql`${t.contentHash} ~ '^[a-f0-9]{64}$'`),
 check('report_snapshots_payload_valid',sql`${t.reportVersion} > 0 AND ${t.assessmentRevision} > 0 AND jsonb_typeof(${t.canonicalPayload}) = 'object' AND CASE WHEN jsonb_typeof(${t.sourceVersions}) = 'array' THEN jsonb_array_length(${t.sourceVersions}) > 0 ELSE false END`),
]);

export const proposedReportAudit = pgTable('report_card_audit',{
 id:uuid('id').defaultRandom().primaryKey(),
 schoolId:uuid('school_id').notNull(),
 reportId:uuid('report_id').notNull(),
 actorMembershipId:uuid('actor_membership_id').notNull(),
 action:proposedReportAction('action').notNull(),
 beforeStage:proposedReportStage('before_stage').notNull(),
 afterStage:proposedReportStage('after_stage').notNull(),
 beforeVersion:integer('before_version').notNull(),
 afterVersion:integer('after_version').notNull(),
 snapshotId:uuid('snapshot_id'),
 snapshotReportVersion:integer('snapshot_report_version'),
 occurredAt:timestamp('occurred_at',{withTimezone:true}).defaultNow().notNull(),
},t=>[
 index('report_audit_school_report_idx').on(t.schoolId,t.reportId,t.occurredAt),
 foreignKey({columns:[t.schoolId,t.reportId],foreignColumns:[proposedReportCards.schoolId,proposedReportCards.id],name:'report_audit_school_report_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.actorMembershipId],foreignColumns:[memberships.schoolId,memberships.id],name:'report_audit_school_actor_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.reportId,t.snapshotId,t.snapshotReportVersion],foreignColumns:[proposedReportSnapshots.schoolId,proposedReportSnapshots.reportId,proposedReportSnapshots.id,proposedReportSnapshots.reportVersion],name:'report_audit_school_snapshot_fk'}).onDelete('restrict'),
 check('report_audit_version_step',sql`${t.afterVersion} = ${t.beforeVersion} + 1 AND ${t.beforeVersion} > 0`),
 check('report_audit_snapshot_binding_valid',sql`
  (${t.action} = 'approve' AND ${t.snapshotId} IS NOT NULL AND ${t.snapshotReportVersion} IS NOT NULL AND ${t.snapshotReportVersion} = ${t.afterVersion}) OR
  (${t.action} = 'publish' AND ${t.snapshotId} IS NOT NULL AND ${t.snapshotReportVersion} IS NOT NULL AND ${t.snapshotReportVersion} + 1 = ${t.afterVersion}) OR
  (${t.action} NOT IN ('approve','publish') AND ${t.snapshotId} IS NULL AND ${t.snapshotReportVersion} IS NULL)
 `),
 check('report_audit_stage_transition_valid',sql`
  (${t.action} = 'submit' AND ${t.beforeStage} IN ('draft','returned') AND ${t.afterStage} = 'submitted') OR
  (${t.action} = 'return' AND ${t.beforeStage} = 'submitted' AND ${t.afterStage} = 'returned') OR
  (${t.action} = 'approve' AND ${t.beforeStage} = 'submitted' AND ${t.afterStage} = 'approved') OR
  (${t.action} = 'publish' AND ${t.beforeStage} = 'approved' AND ${t.afterStage} = 'published') OR
  (${t.action} = 'reopen' AND ${t.beforeStage} = 'approved' AND ${t.afterStage} = 'draft')
 `),
]);

export const proposedReportReceipts = pgTable('report_card_operation_receipts',{
 id:uuid('id').defaultRandom().primaryKey(),
 schoolId:uuid('school_id').notNull(),
 reportId:uuid('report_id').notNull(),
 actorMembershipId:uuid('actor_membership_id').notNull(),
 operationKey:varchar('operation_key',{length:128}).notNull(),
 fingerprint:varchar('fingerprint',{length:64}).notNull(),
 resultingVersion:integer('resulting_version').notNull(),
 outcome:jsonb('outcome').notNull(),
},t=>[
 uniqueIndex('report_receipts_school_actor_key_unique').on(t.schoolId,t.actorMembershipId,t.operationKey),
 foreignKey({columns:[t.schoolId,t.reportId],foreignColumns:[proposedReportCards.schoolId,proposedReportCards.id],name:'report_receipts_school_report_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.actorMembershipId],foreignColumns:[memberships.schoolId,memberships.id],name:'report_receipts_school_actor_fk'}).onDelete('restrict'),
 check('report_receipts_hash_length',sql`${t.fingerprint} ~ '^[a-f0-9]{64}$'`),
 check('report_receipts_payload_valid',sql`length(trim(${t.operationKey})) > 0 AND jsonb_typeof(${t.outcome}) = 'object'`),
 check('report_receipts_version_positive',sql`${t.resultingVersion} > 0`),
]);

export const proposedReportReleases = pgTable('report_card_releases',{
 id:uuid('id').defaultRandom().primaryKey(),
 schoolId:uuid('school_id').notNull(),
 reportId:uuid('report_id').notNull(),
 reportVersion:integer('report_version').notNull(),
 snapshotId:uuid('snapshot_id').notNull(),
 snapshotReportVersion:integer('snapshot_report_version').notNull(),
 publishedBy:uuid('published_by').notNull(),
 releasedAt:timestamp('released_at',{withTimezone:true}).defaultNow().notNull(),
 revokedAt:timestamp('revoked_at',{withTimezone:true}),
},t=>[
 uniqueIndex('report_releases_school_report_version_unique').on(t.schoolId,t.reportId,t.reportVersion),
 uniqueIndex('report_releases_one_active_unique').on(t.schoolId,t.reportId).where(sql`${t.revokedAt} IS NULL`),
 foreignKey({columns:[t.schoolId,t.reportId,t.snapshotId,t.snapshotReportVersion],foreignColumns:[proposedReportSnapshots.schoolId,proposedReportSnapshots.reportId,proposedReportSnapshots.id,proposedReportSnapshots.reportVersion],name:'report_releases_exact_snapshot_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.publishedBy],foreignColumns:[memberships.schoolId,memberships.id],name:'report_releases_school_publisher_fk'}).onDelete('restrict'),
 foreignKey({columns:[t.schoolId,t.reportId],foreignColumns:[proposedReportCards.schoolId,proposedReportCards.id],name:'report_releases_school_report_fk'}).onDelete('restrict'),
 check('report_releases_version_positive',sql`${t.snapshotReportVersion} > 0 AND ${t.reportVersion} = ${t.snapshotReportVersion} + 1`),
 check('report_releases_revocation_order',sql`${t.revokedAt} IS NULL OR ${t.revokedAt} >= ${t.releasedAt}`),
]);
