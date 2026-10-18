import { sql } from 'drizzle-orm';
import { boolean, check, date, foreignKey, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const schoolRole = pgEnum('school_role', ['admin', 'teacher', 'bursar']);
export const membershipStatus = pgEnum('membership_status', ['active', 'suspended']);
export const enrollmentStatus = pgEnum('enrollment_status', ['active', 'graduated', 'withdrawn']);
export const admissionStatus = pgEnum('admission_status', ['draft', 'submitted', 'reviewing', 'accepted', 'declined']);
// Step 494 proposals only: no migration is journaled or executed by these declarations.
export const academicStage = pgEnum('academic_stage', ['creche', 'nursery', 'primary']);
export const lifecycleDecisionKind = pgEnum('lifecycle_decision_kind', ['promote', 'repeat', 'graduate']);
export const lifecycleDecisionStatus = pgEnum('lifecycle_decision_status', ['proposed', 'applied', 'rejected']);
export const studentDepartureKind = pgEnum('student_departure_kind', ['transfer', 'early_exit']);

export const schools = pgTable('schools', {
 id: uuid('id').defaultRandom().primaryKey(),
 name: varchar('name',{length:180}).notNull(),
 slug: varchar('slug',{length:80}).notNull().unique(),
 email: varchar('email',{length:254}),
 phone: varchar('phone',{length:32}),
 address: text('address'),
 finalPrimaryYear: integer('final_primary_year'),
 structureVersion: integer('structure_version').default(0).notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[check('schools_final_primary_year_valid',sql`${t.finalPrimaryYear} IN (5, 6)`),check('schools_structure_version_nonnegative',sql`${t.structureVersion} >= 0`)]);

export const schoolUsers = pgTable('school_users',{
 id: uuid('id').defaultRandom().primaryKey(),
 // Matches a verified Supabase Auth user id; never trust a client-provided user id.
 authUserId: uuid('auth_user_id').notNull().unique(),
 displayName: varchar('display_name',{length:160}).notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
});

export const memberships = pgTable('memberships',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 userId: uuid('user_id').notNull().references(()=>schoolUsers.id,{onDelete:'cascade'}),
 role: schoolRole('role').notNull(),
 status: membershipStatus('status').default('active').notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('memberships_school_user_unique').on(t.schoolId,t.userId),uniqueIndex('memberships_school_id_id_unique').on(t.schoolId,t.id),index('memberships_user_idx').on(t.userId)]);

export const academicSessions = pgTable('academic_sessions',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 label: varchar('label',{length:24}).notNull(),
 startsOn: date('starts_on').notNull(),
 endsOn: date('ends_on').notNull(),
 isCurrent: boolean('is_current').default(false).notNull()
},t=>[uniqueIndex('sessions_school_label_unique').on(t.schoolId,t.label),uniqueIndex('sessions_school_id_id_unique').on(t.schoolId,t.id),uniqueIndex('sessions_one_current_per_school').on(t.schoolId).where(sql`${t.isCurrent} = true`),check('sessions_dates_valid',sql`${t.endsOn} >= ${t.startsOn}`)]);

export const terms = pgTable('terms',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 sessionId: uuid('session_id').notNull().references(()=>academicSessions.id,{onDelete:'cascade'}),
 name: varchar('name',{length:32}).notNull(),
 startsOn: date('starts_on').notNull(),
 endsOn: date('ends_on').notNull(),
 isCurrent: boolean('is_current').default(false).notNull()
},t=>[uniqueIndex('terms_session_name_unique').on(t.sessionId,t.name),foreignKey({columns:[t.schoolId,t.sessionId],foreignColumns:[academicSessions.schoolId,academicSessions.id],name:'terms_school_session_fk'}).onDelete('cascade'),uniqueIndex('terms_one_current_per_school').on(t.schoolId).where(sql`${t.isCurrent} = true`),check('terms_dates_valid',sql`${t.endsOn} >= ${t.startsOn}`)]);

export const academicLevels = pgTable('academic_levels',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'restrict'}),
 name: varchar('name',{length:80}).notNull(),
 stage: academicStage('stage').notNull(),
 primaryYear: integer('primary_year'),
 progressionOrder: integer('progression_order').notNull(),
 isActive: boolean('is_active').default(true).notNull(),
},t=>[uniqueIndex('academic_levels_school_id_id_unique').on(t.schoolId,t.id),uniqueIndex('academic_levels_school_order_unique').on(t.schoolId,t.progressionOrder),uniqueIndex('academic_levels_school_name_unique').on(t.schoolId,t.name),uniqueIndex('academic_levels_school_primary_year_unique').on(t.schoolId,t.primaryYear).where(sql`${t.stage} = 'primary'`),check('academic_levels_primary_year_valid',sql`(${t.stage} = 'primary' AND ${t.primaryYear} BETWEEN 1 AND 6) OR (${t.stage} <> 'primary' AND ${t.primaryYear} IS NULL)`),check('academic_levels_order_positive',sql`${t.progressionOrder} > 0`)]);

export const academicSections = pgTable('academic_sections',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'restrict'}),
 levelId: uuid('level_id').notNull(),
 name: varchar('name',{length:40}).notNull(),
 displayOrder: integer('display_order').notNull(),
 isActive: boolean('is_active').default(true).notNull(),
},t=>[uniqueIndex('academic_sections_school_id_id_unique').on(t.schoolId,t.id),uniqueIndex('academic_sections_school_level_id_id_unique').on(t.schoolId,t.levelId,t.id),uniqueIndex('academic_sections_level_name_unique').on(t.levelId,t.name),uniqueIndex('academic_sections_level_order_unique').on(t.levelId,t.displayOrder),foreignKey({columns:[t.schoolId,t.levelId],foreignColumns:[academicLevels.schoolId,academicLevels.id],name:'academic_sections_school_level_fk'}).onDelete('restrict'),check('academic_sections_order_positive',sql`${t.displayOrder} > 0`)]);

export const classes = pgTable('classes',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 name: varchar('name',{length:80}).notNull(),
 section: varchar('section',{length:40}).notNull(),
 levelId: uuid('level_id'),
 sectionId: uuid('section_id'),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('classes_school_name_unique').on(t.schoolId,t.name),uniqueIndex('classes_school_id_id_unique').on(t.schoolId,t.id),uniqueIndex('classes_school_level_section_unique').on(t.schoolId,t.levelId,t.sectionId).where(sql`${t.levelId} IS NOT NULL AND ${t.sectionId} IS NOT NULL`),foreignKey({columns:[t.schoolId,t.levelId],foreignColumns:[academicLevels.schoolId,academicLevels.id],name:'classes_school_level_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.levelId,t.sectionId],foreignColumns:[academicSections.schoolId,academicSections.levelId,academicSections.id],name:'classes_school_level_section_fk'}).onDelete('restrict'),check('classes_mapping_both_or_neither',sql`(${t.levelId} IS NULL) = (${t.sectionId} IS NULL)`)]);

export const students = pgTable('students',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 admissionNumber: varchar('admission_number',{length:50}).notNull(),
 firstName: varchar('first_name',{length:100}).notNull(),
 lastName: varchar('last_name',{length:100}).notNull(),
 dateOfBirth: date('date_of_birth'),
 status: enrollmentStatus('status').default('active').notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('students_school_admission_unique').on(t.schoolId,t.admissionNumber),uniqueIndex('students_school_id_id_unique').on(t.schoolId,t.id),index('students_school_name_idx').on(t.schoolId,t.lastName)]);

export const guardians = pgTable('guardians',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 fullName: varchar('full_name',{length:180}).notNull(),
 phone: varchar('phone',{length:32}),
 email: varchar('email',{length:254})
},t=>[index('guardians_school_idx').on(t.schoolId),uniqueIndex('guardians_school_id_id_unique').on(t.schoolId,t.id)]);

export const studentGuardians = pgTable('student_guardians',{
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 studentId: uuid('student_id').notNull(),
 guardianId: uuid('guardian_id').notNull(),
 relationship: varchar('relationship',{length:50}).notNull(),
 isPrimary: boolean('is_primary').default(false).notNull()
},t=>[uniqueIndex('student_guardian_unique').on(t.studentId,t.guardianId),foreignKey({columns:[t.schoolId,t.studentId],foreignColumns:[students.schoolId,students.id],name:'student_guardians_school_student_fk'}).onDelete('cascade'),foreignKey({columns:[t.schoolId,t.guardianId],foreignColumns:[guardians.schoolId,guardians.id],name:'student_guardians_school_guardian_fk'}).onDelete('cascade')]);

export const enrollments = pgTable('enrollments',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 studentId: uuid('student_id').notNull(),
 classId: uuid('class_id').notNull(),
 sessionId: uuid('session_id').notNull(),
 status: enrollmentStatus('status').default('active').notNull()
},t=>[uniqueIndex('enrollments_student_session_unique').on(t.studentId,t.sessionId),uniqueIndex('enrollments_school_id_id_unique').on(t.schoolId,t.id),uniqueIndex('enrollments_school_id_student_id_unique').on(t.schoolId,t.id,t.studentId),index('enrollments_class_session_idx').on(t.classId,t.sessionId),foreignKey({columns:[t.schoolId,t.studentId],foreignColumns:[students.schoolId,students.id],name:'enrollments_school_student_fk'}).onDelete('cascade'),foreignKey({columns:[t.schoolId,t.classId],foreignColumns:[classes.schoolId,classes.id],name:'enrollments_school_class_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.sessionId],foreignColumns:[academicSessions.schoolId,academicSessions.id],name:'enrollments_school_session_fk'}).onDelete('restrict')]);

export const admissions = pgTable('admissions',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 applicantName: varchar('applicant_name',{length:180}).notNull(),
 requestedClassId: uuid('requested_class_id'),
 status: admissionStatus('status').default('draft').notNull(),
 submittedAt: timestamp('submitted_at',{withTimezone:true})
},t=>[index('admissions_school_status_idx').on(t.schoolId,t.status),foreignKey({columns:[t.schoolId,t.requestedClassId],foreignColumns:[classes.schoolId,classes.id],name:'admissions_school_class_fk'})]);

export const studentLifecycleDecisions = pgTable('student_lifecycle_decisions',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'restrict'}),
 studentId: uuid('student_id').notNull(),
 sourceEnrollmentId: uuid('source_enrollment_id').notNull(),
 destinationSessionId: uuid('destination_session_id'),
 destinationClassId: uuid('destination_class_id'),
 kind: lifecycleDecisionKind('kind').notNull(),
 status: lifecycleDecisionStatus('status').default('proposed').notNull(),
 structureVersion: integer('structure_version').notNull(),
 proposedByMembershipId: uuid('proposed_by_membership_id').notNull(),
 finalizedByMembershipId: uuid('finalized_by_membership_id'),
 idempotencyKey: uuid('idempotency_key').notNull(),
 payloadFingerprint: varchar('payload_fingerprint',{length:64}).notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
 finalizedAt: timestamp('finalized_at',{withTimezone:true}),
},t=>[uniqueIndex('lifecycle_decisions_school_id_id_unique').on(t.schoolId,t.id),uniqueIndex('lifecycle_decisions_school_idempotency_unique').on(t.schoolId,t.idempotencyKey),uniqueIndex('lifecycle_decisions_student_destination_applied_unique').on(t.studentId,t.destinationSessionId).where(sql`${t.status} = 'applied' AND ${t.destinationSessionId} IS NOT NULL`),uniqueIndex('lifecycle_decisions_source_graduation_applied_unique').on(t.sourceEnrollmentId).where(sql`${t.status} = 'applied' AND ${t.kind} = 'graduate'`),foreignKey({columns:[t.schoolId,t.studentId],foreignColumns:[students.schoolId,students.id],name:'lifecycle_decisions_school_student_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.sourceEnrollmentId,t.studentId],foreignColumns:[enrollments.schoolId,enrollments.id,enrollments.studentId],name:'lifecycle_decisions_source_student_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.destinationSessionId],foreignColumns:[academicSessions.schoolId,academicSessions.id],name:'lifecycle_decisions_destination_session_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.destinationClassId],foreignColumns:[classes.schoolId,classes.id],name:'lifecycle_decisions_destination_class_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.proposedByMembershipId],foreignColumns:[memberships.schoolId,memberships.id],name:'lifecycle_decisions_proposer_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.finalizedByMembershipId],foreignColumns:[memberships.schoolId,memberships.id],name:'lifecycle_decisions_finalizer_fk'}).onDelete('restrict'),check('lifecycle_decisions_destination_valid',sql`(${t.kind} = 'graduate' AND ${t.destinationClassId} IS NULL AND ${t.destinationSessionId} IS NULL) OR (${t.kind} IN ('promote', 'repeat') AND ${t.destinationClassId} IS NOT NULL AND ${t.destinationSessionId} IS NOT NULL)`),check('lifecycle_decisions_finalization_valid',sql`(${t.status} = 'proposed' AND ${t.finalizedByMembershipId} IS NULL AND ${t.finalizedAt} IS NULL) OR (${t.status} IN ('applied', 'rejected') AND ${t.finalizedByMembershipId} IS NOT NULL AND ${t.finalizedAt} IS NOT NULL)`),check('lifecycle_decisions_structure_version_nonnegative',sql`${t.structureVersion} >= 0`)]);

export const studentDepartures = pgTable('student_departures',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'restrict'}),
 studentId: uuid('student_id').notNull(),
 sourceEnrollmentId: uuid('source_enrollment_id').notNull(),
 kind: studentDepartureKind('kind').notNull(),
 reasonCode: varchar('reason_code',{length:40}).notNull(),
 effectiveOn: date('effective_on').notNull(),
 destinationSchoolName: varchar('destination_school_name',{length:180}),
 guardianReviewConfirmed: boolean('guardian_review_confirmed').notNull(),
 finalizedByMembershipId: uuid('finalized_by_membership_id').notNull(),
 idempotencyKey: uuid('idempotency_key').notNull(),
 payloadFingerprint: varchar('payload_fingerprint',{length:64}).notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
},t=>[uniqueIndex('student_departures_school_id_id_unique').on(t.schoolId,t.id),uniqueIndex('student_departures_school_id_student_id_unique').on(t.schoolId,t.id,t.studentId),uniqueIndex('student_departures_school_idempotency_unique').on(t.schoolId,t.idempotencyKey),uniqueIndex('student_departures_source_unique').on(t.sourceEnrollmentId),foreignKey({columns:[t.schoolId,t.studentId],foreignColumns:[students.schoolId,students.id],name:'student_departures_school_student_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.sourceEnrollmentId,t.studentId],foreignColumns:[enrollments.schoolId,enrollments.id,enrollments.studentId],name:'student_departures_source_student_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.finalizedByMembershipId],foreignColumns:[memberships.schoolId,memberships.id],name:'student_departures_finalizer_fk'}).onDelete('restrict'),check('student_departures_guardian_review_required',sql`${t.guardianReviewConfirmed} = true`),check('student_departures_transfer_destination_required',sql`${t.kind} <> 'transfer' OR (NULLIF(BTRIM(${t.destinationSchoolName}), '') IS NOT NULL)`)]);

export const studentReadmissions = pgTable('student_readmissions',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'restrict'}),
 studentId: uuid('student_id').notNull(),
 departureId: uuid('departure_id').notNull(),
 enrollmentId: uuid('enrollment_id').notNull(),
 finalizedByMembershipId: uuid('finalized_by_membership_id').notNull(),
 idempotencyKey: uuid('idempotency_key').notNull(),
 payloadFingerprint: varchar('payload_fingerprint',{length:64}).notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
},t=>[uniqueIndex('student_readmissions_departure_unique').on(t.departureId),uniqueIndex('student_readmissions_enrollment_unique').on(t.enrollmentId),uniqueIndex('student_readmissions_school_idempotency_unique').on(t.schoolId,t.idempotencyKey),foreignKey({columns:[t.schoolId,t.studentId],foreignColumns:[students.schoolId,students.id],name:'student_readmissions_school_student_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.departureId,t.studentId],foreignColumns:[studentDepartures.schoolId,studentDepartures.id,studentDepartures.studentId],name:'student_readmissions_departure_student_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.enrollmentId,t.studentId],foreignColumns:[enrollments.schoolId,enrollments.id,enrollments.studentId],name:'student_readmissions_enrollment_student_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.finalizedByMembershipId],foreignColumns:[memberships.schoolId,memberships.id],name:'student_readmissions_finalizer_fk'}).onDelete('restrict')]);

export const teacherClassAssignments = pgTable('teacher_class_assignments',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'restrict'}),
 teacherMembershipId: uuid('teacher_membership_id').notNull(),
 classId: uuid('class_id').notNull(),
 sessionId: uuid('session_id').notNull(),
 assignedAt: timestamp('assigned_at',{withTimezone:true}).defaultNow().notNull(),
 endedAt: timestamp('ended_at',{withTimezone:true}),
},t=>[uniqueIndex('teacher_class_assignments_active_unique').on(t.teacherMembershipId,t.classId,t.sessionId).where(sql`${t.endedAt} IS NULL`),index('teacher_class_assignments_class_session_idx').on(t.schoolId,t.classId,t.sessionId),foreignKey({columns:[t.schoolId,t.teacherMembershipId],foreignColumns:[memberships.schoolId,memberships.id],name:'teacher_class_assignments_school_teacher_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.classId],foreignColumns:[classes.schoolId,classes.id],name:'teacher_class_assignments_school_class_fk'}).onDelete('restrict'),foreignKey({columns:[t.schoolId,t.sessionId],foreignColumns:[academicSessions.schoolId,academicSessions.id],name:'teacher_class_assignments_school_session_fk'}).onDelete('restrict')]);

export const auditEvents = pgTable('audit_events',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 actorUserId: uuid('actor_user_id').references(()=>schoolUsers.id,{onDelete:'set null'}),
 action: varchar('action',{length:100}).notNull(),
 entityType: varchar('entity_type',{length:80}).notNull(),
 entityId: uuid('entity_id'),
 requestId: uuid('request_id'),
 actorMembershipId: uuid('actor_membership_id'),
 actorRole: schoolRole('actor_role'),
 previousState: varchar('previous_state',{length:40}),
 nextState: varchar('next_state',{length:40}),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[index('audit_events_school_created_idx').on(t.schoolId,t.createdAt),foreignKey({columns:[t.schoolId,t.actorMembershipId],foreignColumns:[memberships.schoolId,memberships.id],name:'audit_events_school_actor_membership_fk'}).onDelete('restrict')]);

// Relations are intentionally deferred until access-control and cross-school
// foreign-key integrity rules are finalized. Do not expose tables through APIs yet.
