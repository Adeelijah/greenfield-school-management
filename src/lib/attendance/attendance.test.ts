import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's type-stripping runner requires explicit source extensions.
import { canReadAssignedClass, type TeacherClassAssignment, type VerifiedAcademicActor } from '../academics/assignments.ts';
// @ts-expect-error Node's type-stripping runner requires explicit source extensions.
import { deriveActiveAttendanceRoster, validateAttendanceCommand, type AttendanceCommand, type AttendanceContext, type AttendanceEnrollment, type AttendanceRecord, type AttendanceStudentRecord } from './attendance.ts';

const students: AttendanceStudentRecord[] = [
  { id: 'student-a', schoolId: 'school-a', admissionNumber: 'GF-A', firstName: 'Amina', lastName: 'Bello', status: 'active' },
  { id: 'student-b', schoolId: 'school-a', admissionNumber: 'GF-B', firstName: 'Kofi', lastName: 'Mensah', status: 'active' },
  { id: 'student-c', schoolId: 'school-a', admissionNumber: 'GF-C', firstName: 'Nia', lastName: 'Okafor', status: 'active' },
  { id: 'student-d', schoolId: 'school-a', admissionNumber: 'GF-D', firstName: 'Tomi', lastName: 'Adeyemi', status: 'active' },
  { id: 'student-e', schoolId: 'school-a', admissionNumber: 'GF-E', firstName: 'Sade', lastName: 'Eze', status: 'active' },
  { id: 'student-f', schoolId: 'school-b', admissionNumber: 'GF-F', firstName: 'Noah', lastName: 'Diaz', status: 'active' },
];
const enrollments: AttendanceEnrollment[] = [
  { id: 'e-a', schoolId: 'school-a', studentId: 'student-a', classId: 'class-a', sessionId: 'session-a', status: 'active' },
  { id: 'e-b', schoolId: 'school-a', studentId: 'student-b', classId: 'class-a', sessionId: 'session-a', status: 'active' },
  { id: 'e-c', schoolId: 'school-a', studentId: 'student-c', classId: 'class-a', sessionId: 'session-a', status: 'completed' },
  { id: 'e-d', schoolId: 'school-a', studentId: 'student-d', classId: 'class-a', sessionId: 'session-a', status: 'graduated' },
  { id: 'e-e', schoolId: 'school-a', studentId: 'student-e', classId: 'class-a', sessionId: 'session-a', status: 'withdrawn' },
  { id: 'e-f', schoolId: 'school-b', studentId: 'student-f', classId: 'class-a', sessionId: 'session-a', status: 'active' },
];
const rosterResult = deriveActiveAttendanceRoster('school-a', 'class-a', 'session-a', students, enrollments);
assert.equal(rosterResult.ok, true);
const roster = rosterResult.ok ? rosterResult.roster : [];
const assignment: TeacherClassAssignment = { id: 'assign-1', schoolId: 'school-a', membershipId: 'teacher-a', classId: 'class-a', sessionId: 'session-a', status: 'active' };
const admin: VerifiedAcademicActor = { id: 'admin-a', schoolId: 'school-a', role: 'admin', status: 'active' };
const teacher: VerifiedAcademicActor = { id: 'teacher-a', schoolId: 'school-a', role: 'teacher', status: 'active' };
const command: AttendanceCommand = { schoolId: 'school-a', classId: 'class-a', sessionId: 'session-a', date: '2026-10-18', marks: [{ studentId: 'student-a', status: 'present' }, { studentId: 'student-b', status: 'late' }] };
const context = (actor: VerifiedAcademicActor, assignments: readonly TeacherClassAssignment[] = []): AttendanceContext => ({ actor, assignments });

test('roster comes from active enrollment and excludes completed, graduated, withdrawn and cross-school rows', () => {
  assert.equal(rosterResult.ok, true);
  assert.deepEqual(roster.map(row => row.studentId), ['student-a', 'student-b']);
  assert.equal(roster[0]?.displayName, 'Amina Bello');
});

test('only admin or teacher assigned to the selected class and session may validate marks', () => {
  assert.equal(validateAttendanceCommand(command, context(admin), roster).ok, true);
  assert.equal(canReadAssignedClass(teacher, 'school-a', 'class-a', 'session-a', [assignment]), true);
  assert.equal(validateAttendanceCommand(command, context(teacher, [assignment]), roster).ok, true);
  assert.equal(validateAttendanceCommand(command, context(teacher), roster).ok, false);
  assert.equal(validateAttendanceCommand({ ...command, sessionId: 'session-b' }, context(teacher, [assignment]), roster).ok, false);
  assert.equal(validateAttendanceCommand(command, context({ ...teacher, role: 'bursar' }), roster).ok, false);
  assert.equal(validateAttendanceCommand(command, context(null), roster).ok, false);
});

test('marks outside active roster, duplicate students and cross-school roster rows fail closed', () => {
  assert.equal(validateAttendanceCommand({ ...command, marks: [{ studentId: 'student-c', status: 'present' }] }, context(admin), roster).ok, false);
  assert.equal(validateAttendanceCommand({ ...command, marks: [command.marks[0]!, command.marks[0]!] }, context(admin), roster).ok, false);
  assert.equal(validateAttendanceCommand(command, context(admin), [...roster, { ...roster[0]!, schoolId: 'school-b' }]).ok, false);
});

test('duplicate student/date marks are rejected while a first mark is valid', () => {
  const existing: AttendanceRecord[] = [{ schoolId: 'school-a', studentId: 'student-a', classId: 'class-a', sessionId: 'session-a', date: command.date, status: 'present' }];
  assert.equal(validateAttendanceCommand(command, context(admin), roster, existing).ok, false);
  assert.equal(validateAttendanceCommand({ ...command, marks: [command.marks[1]!] }, context(admin), roster, existing).ok, true);
  assert.equal(validateAttendanceCommand(command, context(admin), roster, [{ ...existing[0]!, schoolId: 'school-b' }]).ok, false);
});

test('invalid date, empty marks, invalid runtime status, duplicate enrollment and missing student fail', () => {
  assert.equal(validateAttendanceCommand({ ...command, date: '2026-02-30' }, context(admin), roster).ok, false);
  assert.equal(validateAttendanceCommand({ ...command, marks: [] }, context(admin), roster).ok, false);
  assert.equal(validateAttendanceCommand({ ...command, marks: [{ studentId: 'student-a', status: 'unknown' as 'present' }] }, context(admin), roster).ok, false);
  const duplicate = deriveActiveAttendanceRoster('school-a', 'class-a', 'session-a', students, [...enrollments, { ...enrollments[0]!, id: 'e-a2' }]);
  assert.equal(duplicate.ok, false);
  const noStudent = deriveActiveAttendanceRoster('school-a', 'class-a', 'session-a', students.filter(student => student.id !== 'student-a'), enrollments);
  assert.equal(noStudent.ok, false);
});
