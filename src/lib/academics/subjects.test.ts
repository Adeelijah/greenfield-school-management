import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's type-stripping runner requires explicit source extensions.
import { validateSubjectCatalogChange, validateSubjectClassAssignment, validateSubjectLevelAssignment, validateTeacherSubjectAssignment, type Subject, type SubjectClassAssignment, type SubjectLevelAssignment, type TeacherSubjectAssignment } from './subjects.ts';
import type { TeacherClassAssignment, VerifiedAcademicActor } from './assignments.ts';

const admin: VerifiedAcademicActor = { id: 'membership-admin', schoolId: 'school-a', role: 'admin', status: 'active' };
const teacher = { id: 'membership-teacher', schoolId: 'school-a', role: 'teacher' as const, status: 'active' as const };
const subject: Subject = { id: 'subject-math', schoolId: 'school-a', code: 'MATH', name: 'Mathematics', active: true };
const level = { id: 'level-primary-5', schoolId: 'school-a', active: true };
const classRef = { id: 'class-cedar', schoolId: 'school-a', levelId: level.id, sectionId: 'section-cedar', active: true };
const session = { id: 'session-2026', schoolId: 'school-a', active: true };
const classSubject: SubjectClassAssignment = { id: 'sc-1', schoolId: 'school-a', subjectId: subject.id, classId: classRef.id, status: 'active' };
const levelSubject: SubjectLevelAssignment = { id: 'sl-1', schoolId: 'school-a', subjectId: subject.id, levelId: level.id, status: 'active' };
const teacherClass: TeacherClassAssignment = { id: 'tc-1', schoolId: 'school-a', membershipId: teacher.id, classId: classRef.id, sessionId: session.id, status: 'active' };
const teacherSubject: TeacherSubjectAssignment = { id: 'ts-1', schoolId: 'school-a', membershipId: teacher.id, subjectId: subject.id, classId: classRef.id, sessionId: session.id, status: 'active' };

test('subject catalog is school-scoped, normalized and rejects duplicate code or name', () => {
  const added = validateSubjectCatalogChange({ schoolId: 'school-a', code: ' eng ', name: ' English ', active: true }, admin, [subject]);
  assert.equal(added.ok, true);
  if (added.ok) assert.deepEqual(added.value, { schoolId: 'school-a', code: 'ENG', name: 'English', active: true, id: undefined });
  assert.equal(validateSubjectCatalogChange({ schoolId: 'school-a', code: 'math', name: 'Another', active: true }, admin, [subject]).ok, false);
  assert.equal(validateSubjectCatalogChange({ schoolId: 'school-b', code: 'ENG', name: 'English', active: true }, admin, [subject]).ok, false);
  assert.equal(validateSubjectCatalogChange({ schoolId: 'school-a', subjectId: subject.id, code: 'MATH', name: 'Maths', active: false }, admin, [subject]).ok, true);
});

test('subject assignments target independent levels or classes and prevent cross-school records', () => {
  assert.equal(validateSubjectLevelAssignment({ schoolId: 'school-a', subjectId: subject.id, levelId: level.id, status: 'active' }, admin, subject, level, []).ok, true);
  assert.equal(validateSubjectLevelAssignment({ schoolId: 'school-a', subjectId: subject.id, levelId: level.id, status: 'active' }, admin, subject, level, [levelSubject]).ok, true);
  assert.equal(validateSubjectClassAssignment({ schoolId: 'school-a', subjectId: subject.id, classId: classRef.id, status: 'active' }, admin, subject, classRef, [], [levelSubject]).ok, true);
  assert.equal(validateSubjectClassAssignment({ schoolId: 'school-b', subjectId: subject.id, classId: classRef.id, status: 'active' }, admin, subject, classRef, [], []).ok, false);
  assert.equal(validateSubjectLevelAssignment({ schoolId: 'school-a', subjectId: subject.id, levelId: level.id, status: 'active' }, { ...admin, role: 'teacher' }, subject, level, []).ok, false);
});

test('teacher-subject assignment requires active class/subject links and active teacher class/session assignment', () => {
  const input = { schoolId: 'school-a', membershipId: teacher.id, subjectId: subject.id, classId: classRef.id, sessionId: session.id, status: 'active' as const };
  const result = validateTeacherSubjectAssignment(input, admin, teacher, subject, classRef, session, [teacherClass], [classSubject], [], []);
  assert.equal(result.ok, true);
  assert.equal(validateTeacherSubjectAssignment(input, admin, teacher, subject, classRef, session, [], [classSubject], [], []).ok, false);
  assert.equal(validateTeacherSubjectAssignment(input, admin, teacher, subject, classRef, session, [teacherClass], [], [], []).ok, false);
  assert.equal(validateTeacherSubjectAssignment({ ...input, schoolId: 'school-b' }, admin, teacher, subject, classRef, session, [teacherClass], [classSubject], [], []).ok, false);
  assert.equal(validateTeacherSubjectAssignment(input, { ...admin, role: 'teacher' }, teacher, subject, classRef, session, [teacherClass], [classSubject], [], []).ok, false);
  assert.equal(validateTeacherSubjectAssignment(input, admin, teacher, subject, classRef, session, [teacherClass], [classSubject], [], [teacherSubject]).ok, true);
});

test('inactive level link does not imply a class link; class assignment stays distinct from section', () => {
  const levelCovered = [{ ...levelSubject, status: 'inactive' as const }];
  const result = validateSubjectClassAssignment({ schoolId: 'school-a', subjectId: subject.id, classId: classRef.id, status: 'active' }, admin, subject, classRef, [], levelCovered);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.classId, classRef.id);
  assert.notEqual(classRef.levelId, classRef.sectionId);
});
