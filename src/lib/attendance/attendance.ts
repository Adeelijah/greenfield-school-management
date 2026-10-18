// @ts-expect-error Node's offline type-stripping runner requires this extension.
import { canReadAssignedClass, type TeacherClassAssignment, type VerifiedAcademicActor } from '../academics/assignments.ts';
import type { enrollments, students } from '@/db/schema';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
type StudentRow = typeof students.$inferSelect;
type EnrollmentRow = typeof enrollments.$inferSelect;
/** Read projection of the existing student record; identity remains membership-based. */
export type AttendanceStudentRecord = Pick<StudentRow, 'id' | 'schoolId' | 'admissionNumber' | 'firstName' | 'lastName' | 'status'>;
/** Step 495 proposes `completed`; it remains an application union until schema approval. */
export type AttendanceEnrollment = Pick<EnrollmentRow, 'id' | 'schoolId' | 'studentId' | 'classId' | 'sessionId'> & {
  status: EnrollmentRow['status'] | 'completed';
};
export type AttendanceRosterStudent = {
  studentId: string;
  schoolId: string;
  classId: string;
  sessionId: string;
  admissionNumber: string;
  displayName: string;
};
export type AttendanceRecord = {
  schoolId: string;
  studentId: string;
  classId: string;
  sessionId: string;
  date: string;
  status: AttendanceStatus;
};
export type AttendanceContext = {
  actor: VerifiedAcademicActor;
  assignments: readonly TeacherClassAssignment[];
};
export type AttendanceMark = { studentId: string; status: AttendanceStatus };
export type AttendanceCommand = {
  schoolId: string;
  classId: string;
  sessionId: string;
  date: string;
  marks: readonly AttendanceMark[];
};
export type AttendanceFailureCode =
  | 'missing_context' | 'inactive_membership' | 'school_scope_mismatch' | 'forbidden'
  | 'invalid_date' | 'empty_register' | 'duplicate_student' | 'duplicate_date_mark'
  | 'student_not_in_roster' | 'invalid_roster';
export type AttendanceResult =
  | { ok: true; marks: readonly AttendanceMark[] }
  | { ok: false; code: AttendanceFailureCode; message: string };
export type AttendanceRosterResult =
  | { ok: true; roster: readonly AttendanceRosterStudent[] }
  | { ok: false; code: 'invalid_roster'; message: string };

const fail = (code: AttendanceFailureCode, message: string): AttendanceResult => ({ ok: false, code, message });

/** Builds the current class list from authoritative enrollment and student rows. */
export function deriveActiveAttendanceRoster(
  schoolId: string,
  classId: string,
  sessionId: string,
  students: readonly AttendanceStudentRecord[],
  enrollments: readonly AttendanceEnrollment[],
): AttendanceRosterResult {
  const sessionEnrollments = enrollments.filter(row => row.schoolId === schoolId && row.sessionId === sessionId && row.status === 'active');
  const activeStudentIds = new Set<string>();
  for (const enrollment of sessionEnrollments) {
    if (activeStudentIds.has(enrollment.studentId)) {
      return { ok: false, code: 'invalid_roster', message: 'A student has more than one active enrollment in this session.' };
    }
    activeStudentIds.add(enrollment.studentId);
  }

  const roster: AttendanceRosterStudent[] = [];
  for (const enrollment of sessionEnrollments) {
    if (enrollment.classId !== classId) continue;
    const student = students.find(item => item.id === enrollment.studentId && item.schoolId === schoolId);
    if (!student) return { ok: false, code: 'invalid_roster', message: 'An active enrollment has no matching student in this school.' };
    if (student.status !== 'active') continue;
    roster.push({
      studentId: student.id,
      schoolId,
      classId,
      sessionId,
      admissionNumber: student.admissionNumber,
      displayName: `${student.firstName} ${student.lastName}`.trim(),
    });
  }
  return { ok: true, roster };
}

/** Actor and records must come from trusted server-side membership/assignment queries. */
export function validateAttendanceCommand(
  command: AttendanceCommand,
  context: AttendanceContext,
  activeRoster: readonly AttendanceRosterStudent[],
  existingRecords: readonly AttendanceRecord[] = [],
): AttendanceResult {
  const actor = context.actor;
  if (!actor?.id || !actor.schoolId) return fail('missing_context', 'Verified school membership is required.');
  if (actor.status !== 'active') return fail('inactive_membership', 'Active membership is required.');
  if (actor.role !== 'admin' && actor.role !== 'teacher') return fail('forbidden', 'This school role cannot record attendance.');
  if (actor.schoolId !== command.schoolId) return fail('school_scope_mismatch', 'Attendance school does not match verified membership.');
  if (actor.role === 'teacher' && !canReadAssignedClass(actor, command.schoolId, command.classId, command.sessionId, context.assignments)) {
    return fail('forbidden', 'Teachers may record attendance only for an assigned class and session.');
  }
  if (!isCalendarDate(command.date)) return fail('invalid_date', 'Enter a valid attendance date.');
  if (!command.schoolId || !command.classId || !command.sessionId) return fail('student_not_in_roster', 'School, class, and session are required.');
  if (!command.marks.length) return fail('empty_register', 'Mark at least one student.');
  if (activeRoster.some(row => row.schoolId !== actor.schoolId || row.classId !== command.classId || row.sessionId !== command.sessionId)) {
    return fail('school_scope_mismatch', 'Roster rows must match the selected school, class, and session.');
  }
  if (existingRecords.some(row => row.schoolId !== actor.schoolId)) return fail('school_scope_mismatch', 'Attendance history contains a cross-school row.');

  const seen = new Set<string>();
  for (const mark of command.marks) {
    if (!mark.studentId || !isAttendanceStatus(mark.status)) return fail('student_not_in_roster', 'Each mark must include a student and a valid attendance status.');
    if (seen.has(mark.studentId)) return fail('duplicate_student', 'A student may appear only once in a register.');
    seen.add(mark.studentId);
    if (!activeRoster.some(student => student.studentId === mark.studentId)) {
      return fail('student_not_in_roster', 'Every mark must belong to an active enrollment in the selected class and session.');
    }
    if (existingRecords.some(row => row.studentId === mark.studentId && row.date === command.date)) {
      return fail('duplicate_date_mark', 'This student already has an attendance mark for the selected date.');
    }
  }
  return { ok: true, marks: command.marks.map(mark => ({ ...mark })) };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isAttendanceStatus(value: string): value is AttendanceStatus {
  return value === 'present' || value === 'absent' || value === 'late' || value === 'excused';
}
