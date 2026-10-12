import { boolean, date, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const schoolRole = pgEnum('school_role', ['admin', 'teacher', 'bursar']);
export const membershipStatus = pgEnum('membership_status', ['active', 'suspended']);
export const enrollmentStatus = pgEnum('enrollment_status', ['active', 'graduated', 'withdrawn']);
export const admissionStatus = pgEnum('admission_status', ['draft', 'submitted', 'reviewing', 'accepted', 'declined']);

export const schools = pgTable('schools', {
 id: uuid('id').defaultRandom().primaryKey(),
 name: varchar('name',{length:180}).notNull(),
 slug: varchar('slug',{length:80}).notNull().unique(),
 email: varchar('email',{length:254}),
 phone: varchar('phone',{length:32}),
 address: text('address'),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
});

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
},t=>[uniqueIndex('memberships_school_user_unique').on(t.schoolId,t.userId),index('memberships_user_idx').on(t.userId)]);

export const academicSessions = pgTable('academic_sessions',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 label: varchar('label',{length:24}).notNull(),
 startsOn: date('starts_on').notNull(),
 endsOn: date('ends_on').notNull(),
 isCurrent: boolean('is_current').default(false).notNull()
},t=>[uniqueIndex('sessions_school_label_unique').on(t.schoolId,t.label)]);

export const terms = pgTable('terms',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 sessionId: uuid('session_id').notNull().references(()=>academicSessions.id,{onDelete:'cascade'}),
 name: varchar('name',{length:32}).notNull(),
 startsOn: date('starts_on').notNull(),
 endsOn: date('ends_on').notNull(),
 isCurrent: boolean('is_current').default(false).notNull()
},t=>[uniqueIndex('terms_session_name_unique').on(t.sessionId,t.name)]);

export const classes = pgTable('classes',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 name: varchar('name',{length:80}).notNull(),
 section: varchar('section',{length:40}).notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('classes_school_name_unique').on(t.schoolId,t.name)]);

export const students = pgTable('students',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 admissionNumber: varchar('admission_number',{length:50}).notNull(),
 firstName: varchar('first_name',{length:100}).notNull(),
 lastName: varchar('last_name',{length:100}).notNull(),
 dateOfBirth: date('date_of_birth'),
 status: enrollmentStatus('status').default('active').notNull(),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[uniqueIndex('students_school_admission_unique').on(t.schoolId,t.admissionNumber),index('students_school_name_idx').on(t.schoolId,t.lastName)]);

export const guardians = pgTable('guardians',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 fullName: varchar('full_name',{length:180}).notNull(),
 phone: varchar('phone',{length:32}),
 email: varchar('email',{length:254})
},t=>[index('guardians_school_idx').on(t.schoolId)]);

export const studentGuardians = pgTable('student_guardians',{
 studentId: uuid('student_id').notNull().references(()=>students.id,{onDelete:'cascade'}),
 guardianId: uuid('guardian_id').notNull().references(()=>guardians.id,{onDelete:'cascade'}),
 relationship: varchar('relationship',{length:50}).notNull(),
 isPrimary: boolean('is_primary').default(false).notNull()
},t=>[uniqueIndex('student_guardian_unique').on(t.studentId,t.guardianId)]);

export const enrollments = pgTable('enrollments',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 studentId: uuid('student_id').notNull().references(()=>students.id,{onDelete:'cascade'}),
 classId: uuid('class_id').notNull().references(()=>classes.id,{onDelete:'restrict'}),
 sessionId: uuid('session_id').notNull().references(()=>academicSessions.id,{onDelete:'restrict'}),
 status: enrollmentStatus('status').default('active').notNull()
},t=>[uniqueIndex('enrollments_student_session_unique').on(t.studentId,t.sessionId),index('enrollments_class_session_idx').on(t.classId,t.sessionId)]);

export const admissions = pgTable('admissions',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 applicantName: varchar('applicant_name',{length:180}).notNull(),
 requestedClassId: uuid('requested_class_id').references(()=>classes.id,{onDelete:'set null'}),
 status: admissionStatus('status').default('draft').notNull(),
 submittedAt: timestamp('submitted_at',{withTimezone:true})
},t=>[index('admissions_school_status_idx').on(t.schoolId,t.status)]);

export const auditEvents = pgTable('audit_events',{
 id: uuid('id').defaultRandom().primaryKey(),
 schoolId: uuid('school_id').notNull().references(()=>schools.id,{onDelete:'cascade'}),
 actorUserId: uuid('actor_user_id').references(()=>schoolUsers.id,{onDelete:'set null'}),
 action: varchar('action',{length:100}).notNull(),
 entityType: varchar('entity_type',{length:80}).notNull(),
 entityId: uuid('entity_id'),
 createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},t=>[index('audit_events_school_created_idx').on(t.schoolId,t.createdAt)]);

// Relations are intentionally deferred until access-control and cross-school
// foreign-key integrity rules are finalized. Do not expose tables through APIs yet.
