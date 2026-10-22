// REVIEW ONLY: explicit metadata assembly, not a Drizzle Kit migration entrypoint.
// Existing relation objects are reused; two proposal shadow targets are excluded.
// Extra composite targets live in the separate reviewed dependency SQL.
// Never point drizzle.config.ts or a schema glob at this partial assembly.
// @ts-expect-error Node offline metadata tests require explicit source extension.
export { schools, schoolUsers, memberships, academicSessions, terms, academicLevels, academicSections, classes, students, enrollments, teacherClassAssignments, schoolRole, membershipStatus, enrollmentStatus, academicStage } from './schema.ts';
// @ts-expect-error Node offline metadata tests require explicit source extension.
export { proposedAssessmentSubjects, proposedAssessmentConfigs, proposedAssessmentScopes, proposedAssessmentRoster, proposedAssessmentTeachers, proposedAssessmentScores, proposedAssessmentSources, proposedAssessmentReviews, proposedAssessmentFinalizations, proposedAssessmentAudit, proposedAssessmentReceipts, proposedAssessmentConfigState, proposedAssessmentMode } from './academic-assessments-schema.proposal.ts';
// @ts-expect-error Node offline metadata tests require explicit source extension.
export { proposedReportCards, proposedReportSnapshots, proposedReportAudit, proposedReportReceipts, proposedReportReleases, proposedReportStage, proposedReportAction } from './report-cards-schema.proposal.ts';
