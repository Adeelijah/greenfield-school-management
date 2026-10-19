// Pure mapping of selected columns from current Drizzle declarations.
// No SQL/auth SDK. Inputs must be complete, trusted transaction-scoped reads.
import type { schools, schoolUsers, memberships, students, enrollments, classes, academicLevels, academicSections, academicSessions, terms, teacherClassAssignments } from '../../db/schema';
import type { AuthBoundMembership } from './report-card-authoritative-read';
import type { TeacherClassAssignment, AcademicClassRef } from './assignments';
import type { TrustedEnrollmentRow } from './report-card-trusted-source';
import type { ReportCardRequest } from './report-cards';

type School = Pick<typeof schools.$inferSelect, 'id' | 'finalPrimaryYear'>;
type SchoolUser = Pick<typeof schoolUsers.$inferSelect, 'id' | 'authUserId'>;
type Membership = Pick<typeof memberships.$inferSelect, 'id' | 'schoolId' | 'userId' | 'role' | 'status'>;
type Student = Pick<typeof students.$inferSelect, 'id' | 'schoolId' | 'status'>;
type Enrollment = Pick<typeof enrollments.$inferSelect, 'id' | 'schoolId' | 'studentId' | 'classId' | 'sessionId' | 'status'>;
type Class = Pick<typeof classes.$inferSelect, 'id' | 'schoolId' | 'levelId' | 'sectionId'>;
type Level = Pick<typeof academicLevels.$inferSelect, 'id' | 'schoolId' | 'stage' | 'primaryYear' | 'isActive'>;
type Section = Pick<typeof academicSections.$inferSelect, 'id' | 'schoolId' | 'levelId' | 'isActive'>;
type Session = Pick<typeof academicSessions.$inferSelect, 'id' | 'schoolId' | 'startsOn' | 'endsOn' | 'isCurrent'>;
type Term = Pick<typeof terms.$inferSelect, 'id' | 'schoolId' | 'sessionId' | 'startsOn' | 'endsOn' | 'isCurrent'>;
type Assignment = Pick<typeof teacherClassAssignments.$inferSelect, 'id' | 'schoolId' | 'teacherMembershipId' | 'classId' | 'sessionId' | 'endedAt'>;
export type PersistedIdentityRows = { users: readonly SchoolUser[]; memberships: readonly Membership[]; schools: readonly School[] };
export type PersistedPlacementRows = { students: readonly Student[]; enrollments: readonly Enrollment[]; classes: readonly Class[]; levels: readonly Level[]; sections: readonly Section[]; sessions: readonly Session[]; terms: readonly Term[]; assignments: readonly Assignment[] };
type Failure = { ok: false; code: 'unauthenticated' | 'forbidden' | 'invalid_reference' | 'invalid_enrollment' | 'unmapped_class' | 'invalid_calendar' };
export type MappedReportIdentity = { membership: AuthBoundMembership; school: School };

/** authUserId MUST come from verified server authentication, never a request
 * body. Matches the app's exactly-one-active-school policy; recheck in the
 * transaction. This pure mapper cannot establish authentication or trust.
 */
export function mapPersistedReportIdentity(authUserId: string | null, rows: PersistedIdentityRows): ({ ok: true; identity: MappedReportIdentity } | Failure) {
  if (!authUserId?.trim()) return { ok: false, code: 'unauthenticated' };
  if (rows.users.length !== 1 || rows.users[0]!.authUserId !== authUserId || !rows.users[0]!.id || rows.memberships.some(m => m.userId !== rows.users[0]!.id)) return { ok: false, code: 'forbidden' };
  const active = rows.memberships.filter(m => m.status === 'active');
  if (active.length !== 1) return { ok: false, code: 'forbidden' };
  const membership = active[0]!;
  const school = rows.schools.filter(s => s.id === membership.schoolId);
  if (!membership.id || !['admin', 'teacher'].includes(membership.role) || school.length !== 1) return { ok: false, code: 'forbidden' };
  return { ok: true, identity: { membership: { id: membership.id, schoolId: membership.schoolId, role: membership.role, status: 'active', authUserId }, school: { ...school[0]! } } };
}
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Current active-student report mapping only. Does not invent session status,
 * term ordinal, assessment version, or grades absent from the database model.
 */
export function mapPersistedReportPlacement(identity: MappedReportIdentity, report: ReportCardRequest, enrollmentId: string, rows: PersistedPlacementRows): ({ ok: true; placement: { enrollmentId: string; enrollments: TrustedEnrollmentRow[]; klass: AcademicClassRef; assignments: TeacherClassAssignment[]; level: Level; session: Session; term: Term } } | Failure) {
  const membership = identity.membership;
  if (!membership || membership.status !== 'active' || !['teacher', 'admin'].includes(membership.role) || identity.school.id !== membership.schoolId || report.schoolId !== membership.schoolId) return { ok: false, code: 'forbidden' };
  const schoolId = membership.schoolId;
  const collections = [rows.students, rows.enrollments, rows.classes, rows.levels, rows.sections, rows.sessions, rows.terms, rows.assignments];
  if (collections.some(collection => collection.some(row => row.schoolId !== schoolId))) return { ok: false, code: 'invalid_reference' };
  const student = rows.students.filter(s => s.id === report.studentId && s.status === 'active');
  if (student.length !== 1) return { ok: false, code: 'invalid_reference' };
  const active = rows.enrollments.filter(e => e.studentId === report.studentId && e.sessionId === report.sessionId && e.status === 'active');
  if (active.length !== 1 || !enrollmentId || active[0]!.id !== enrollmentId || active[0]!.classId !== report.classId) return { ok: false, code: 'invalid_enrollment' };
  const klass = rows.classes.filter(c => c.id === report.classId);
  if (klass.length !== 1 || !klass[0]!.levelId || !klass[0]!.sectionId) return { ok: false, code: 'unmapped_class' };
  const level = rows.levels.filter(l => l.id === klass[0]!.levelId && l.isActive);
  const section = rows.sections.filter(s => s.id === klass[0]!.sectionId && s.levelId === klass[0]!.levelId && s.isActive);
  if (level.length !== 1 || section.length !== 1 || ![5, 6].includes(identity.school.finalPrimaryYear ?? 0)) return { ok: false, code: 'unmapped_class' };
  const selectedLevel = level[0]!;
  if (!['creche', 'nursery', 'primary'].includes(selectedLevel.stage) || (selectedLevel.stage === 'primary' ? !Number.isInteger(selectedLevel.primaryYear) || selectedLevel.primaryYear! < 1 || selectedLevel.primaryYear! > identity.school.finalPrimaryYear! : selectedLevel.primaryYear !== null)) return { ok: false, code: 'unmapped_class' };
  const session = rows.sessions.filter(s => s.id === report.sessionId);
  const term = rows.terms.filter(t => t.id === report.termId && t.sessionId === report.sessionId);
  if (session.length !== 1 || term.length !== 1 || ![session[0]!.startsOn, session[0]!.endsOn, term[0]!.startsOn, term[0]!.endsOn].every(date) || session[0]!.startsOn > session[0]!.endsOn || term[0]!.startsOn > term[0]!.endsOn || term[0]!.startsOn < session[0]!.startsOn || term[0]!.endsOn > session[0]!.endsOn) return { ok: false, code: 'invalid_calendar' };
  const assignments = rows.assignments.map(a => ({ id: a.id, schoolId: a.schoolId, membershipId: a.teacherMembershipId, classId: a.classId, sessionId: a.sessionId, status: a.endedAt === null ? 'active' as const : 'inactive' as const }));
  if (membership.role === 'teacher' && assignments.filter(a => a.membershipId === membership.id && a.classId === report.classId && a.sessionId === report.sessionId && a.status === 'active').length !== 1) return { ok: false, code: 'forbidden' };
  return { ok: true, placement: { enrollmentId, enrollments: rows.enrollments.map(e => ({ ...e })), klass: { ...klass[0]!, levelId: klass[0]!.levelId!, sectionId: klass[0]!.sectionId!, active: true }, assignments, level: { ...selectedLevel }, session: { ...session[0]! }, term: { ...term[0]! } } };
}
