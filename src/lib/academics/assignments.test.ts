import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's type-stripping runner requires explicit source extensions.
import { canReadAssignedClass, validateTeacherClassAssignment, type TeacherClassAssignment, type VerifiedAcademicActor } from './assignments.ts';

const admin: VerifiedAcademicActor = { id: 'membership-admin', schoolId: 'school-a', role: 'admin', status: 'active' };
const teacher = { id: 'membership-teacher', schoolId: 'school-a', role: 'teacher' as const, status: 'active' as const };
const classRef = { id: 'class-cedar', schoolId: 'school-a', levelId: 'level-primary-5', sectionId: 'section-cedar', active: true };
const session = { id: 'session-2026', schoolId: 'school-a', active: true };
const assignment: TeacherClassAssignment = { id: 'assignment-1', schoolId: 'school-a', membershipId: teacher.id, classId: classRef.id, sessionId: session.id, status: 'active' };

test('admin can assign an active teacher to a class for a session', () => {
  const result = validateTeacherClassAssignment({ kind: 'assign', schoolId: 'school-a', teacherMembershipId: teacher.id, classId: classRef.id, sessionId: session.id }, admin, teacher, classRef, session, []);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.assignment, { schoolId: 'school-a', membershipId: teacher.id, classId: classRef.id, sessionId: session.id, status: 'active' });
});

test('duplicate assignment, wrong school, inactive teacher, class and session are rejected', () => {
  const command = { kind: 'assign' as const, schoolId: 'school-a', teacherMembershipId: teacher.id, classId: classRef.id, sessionId: session.id };
  assert.equal(validateTeacherClassAssignment(command, admin, teacher, classRef, session, [assignment]).ok, false);
  assert.equal(validateTeacherClassAssignment({ ...command, schoolId: 'school-b' }, admin, teacher, classRef, session, []).ok, false);
  assert.equal(validateTeacherClassAssignment(command, admin, { ...teacher, status: 'suspended' }, classRef, session, []).ok, false);
  assert.equal(validateTeacherClassAssignment(command, admin, teacher, { ...classRef, schoolId: 'school-b' }, session, []).ok, false);
  assert.equal(validateTeacherClassAssignment(command, admin, teacher, classRef, { ...session, active: false }, []).ok, false);
});

test('only an active admin manages assignments and only assigned teacher reads class/session', () => {
  const command = { kind: 'assign' as const, schoolId: 'school-a', teacherMembershipId: teacher.id, classId: classRef.id, sessionId: session.id };
  assert.equal(validateTeacherClassAssignment(command, null, teacher, classRef, session, []).ok, false);
  assert.equal(validateTeacherClassAssignment(command, { ...admin, role: 'teacher' }, teacher, classRef, session, []).ok, false);
  assert.equal(canReadAssignedClass(teacher, 'school-a', classRef.id, session.id, [assignment]), true);
  assert.equal(canReadAssignedClass(teacher, 'school-a', classRef.id, 'session-other', [assignment]), false);
  assert.equal(canReadAssignedClass(teacher, 'school-b', classRef.id, session.id, [assignment]), false);
  assert.equal(canReadAssignedClass({ ...teacher, role: 'bursar' }, 'school-a', classRef.id, session.id, [assignment]), false);
  assert.equal(canReadAssignedClass(admin, 'school-a', classRef.id, session.id, []), true);
});

test('admin can deactivate and safely reactivate assignments', () => {
  const deactivate = validateTeacherClassAssignment({ kind: 'set_status', schoolId: 'school-a', assignmentId: assignment.id, status: 'inactive' }, admin, null, null, null, [assignment]);
  assert.equal(deactivate.ok, true);
  if (deactivate.ok) assert.equal(deactivate.assignment.status, 'inactive');
  const reactivate = validateTeacherClassAssignment({ kind: 'set_status', schoolId: 'school-a', assignmentId: assignment.id, status: 'active' }, admin, teacher, classRef, session, [{ ...assignment, status: 'inactive' }, { ...assignment, id: 'assignment-2', status: 'active' }]);
  assert.equal(reactivate.ok, false);
  const reactivateWithoutContext = validateTeacherClassAssignment({ kind: 'set_status', schoolId: 'school-a', assignmentId: assignment.id, status: 'active' }, admin, null, null, null, [{ ...assignment, status: 'inactive' }]);
  assert.equal(reactivateWithoutContext.ok, false);
});
