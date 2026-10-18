import type { AcademicClassRef, AcademicSessionRef, SchoolMembership, TeacherClassAssignment, VerifiedAcademicActor } from './assignments';
import type { academicLevels } from '@/db/schema';
export type Subject = { id: string; schoolId: string; code: string; name: string; active: boolean };
type AcademicLevelRow = typeof academicLevels.$inferSelect;
export type AcademicLevelRef = Pick<AcademicLevelRow, 'id' | 'schoolId'> & { active: boolean };
export type SubjectLevelAssignment = { id: string; schoolId: string; subjectId: string; levelId: string; status: 'active' | 'inactive' };
export type SubjectClassAssignment = { id: string; schoolId: string; subjectId: string; classId: string; status: 'active' | 'inactive' };
export type TeacherSubjectAssignment = { id: string; schoolId: string; membershipId: string; subjectId: string; classId: string; sessionId: string; status: 'active' | 'inactive' };

export type SubjectResult<T> = { ok: true; value: T } | { ok: false; code: SubjectFailureCode; message: string };
export type SubjectFailureCode = 'missing_context' | 'inactive_membership' | 'forbidden' | 'school_mismatch' | 'invalid_subject' | 'invalid_target' | 'duplicate' | 'invalid_teacher' | 'invalid_assignment';
const fail = <T = never>(code: SubjectFailureCode, message: string): SubjectResult<T> => ({ ok: false, code, message });
const norm = (value: string) => value.trim().toLocaleLowerCase();

export function validateSubjectCatalogChange(
  input: { schoolId: string; subjectId?: string; code: string; name: string; active: boolean },
  actor: VerifiedAcademicActor,
  subjects: readonly Subject[],
): SubjectResult<Omit<Subject, 'id'> & { id?: string }> {
  if (!actor?.id) return fail('missing_context', 'Verified school membership is required.');
  if (actor.status !== 'active') return fail('inactive_membership', 'Active membership is required.');
  if (actor.role !== 'admin') return fail('forbidden', 'Only school admins may manage the subject catalog.');
  if (input.schoolId !== actor.schoolId || subjects.some(subject => subject.schoolId !== actor.schoolId)) return fail('school_mismatch', 'Subject data must belong to the verified school.');
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code || code.length > 24 || !name || name.length > 100) return fail('invalid_subject', 'Enter a subject code and name within the allowed length.');
  const current = input.subjectId ? subjects.find(subject => subject.id === input.subjectId && subject.schoolId === actor.schoolId) : undefined;
  if (input.subjectId && !current) return fail('invalid_subject', 'Subject was not found in this school.');
  if (subjects.some(subject => subject.id !== input.subjectId && (norm(subject.code) === norm(code) || norm(subject.name) === norm(name)))) {
    return fail('duplicate', 'A subject with this code or name already exists in the school.');
  }
  return { ok: true, value: { id: current?.id, schoolId: actor.schoolId, code, name, active: input.active } };
}

export function validateSubjectLevelAssignment(
  input: { schoolId: string; subjectId: string; levelId: string; status: 'active' | 'inactive' },
  actor: VerifiedAcademicActor,
  subject: Subject | null,
  level: AcademicLevelRef | null,
  assignments: readonly SubjectLevelAssignment[],
): SubjectResult<Omit<SubjectLevelAssignment, 'id'> & { id?: string }> {
  if (!actor?.id) return fail('missing_context', 'Verified school membership is required.');
  if (actor.status !== 'active') return fail('inactive_membership', 'Active membership is required.');
  if (actor.role !== 'admin') return fail('forbidden', 'Only school admins may assign subjects to levels.');
  if (input.schoolId !== actor.schoolId || assignments.some(row => row.schoolId !== actor.schoolId)) return fail('school_mismatch', 'Subject assignment must belong to the verified school.');
  if (!subject || subject.schoolId !== actor.schoolId || subject.id !== input.subjectId || !level || level.schoolId !== actor.schoolId || level.id !== input.levelId || (input.status === 'active' && (!subject.active || !level.active))) return fail('invalid_target', 'Choose a valid subject and academic level from this school.');
  const current = assignments.find(row => row.subjectId === subject.id && row.levelId === level.id);
  if (!current && input.status === 'inactive') return fail('invalid_target', 'Subject is not assigned to this academic level.');
  if (!current && assignments.some(row => row.status === 'active' && row.subjectId === subject.id && row.levelId === level.id)) return fail('duplicate', 'This subject is already assigned to the level.');
  if (current && current.status === input.status) return { ok: true, value: current };
  return { ok: true, value: { id: current?.id, schoolId: actor.schoolId, subjectId: subject.id, levelId: level.id, status: input.status } };
}

export function validateSubjectClassAssignment(
  input: { schoolId: string; subjectId: string; classId: string; status: 'active' | 'inactive' },
  actor: VerifiedAcademicActor,
  subject: Subject | null,
  classRef: AcademicClassRef | null,
  assignments: readonly SubjectClassAssignment[],
  levelAssignments: readonly SubjectLevelAssignment[],
): SubjectResult<Omit<SubjectClassAssignment, 'id'> & { id?: string }> {
  if (!actor?.id) return fail('missing_context', 'Verified school membership is required.');
  if (actor.status !== 'active') return fail('inactive_membership', 'Active membership is required.');
  if (actor.role !== 'admin') return fail('forbidden', 'Only school admins may assign subjects to classes.');
  if (input.schoolId !== actor.schoolId || assignments.some(row => row.schoolId !== actor.schoolId) || levelAssignments.some(row => row.schoolId !== actor.schoolId)) return fail('school_mismatch', 'Subject assignment must belong to the verified school.');
  if (!subject || subject.schoolId !== actor.schoolId || subject.id !== input.subjectId || !classRef || classRef.schoolId !== actor.schoolId || classRef.id !== input.classId || (input.status === 'active' && (!subject.active || !classRef.active))) return fail('invalid_target', 'Choose a valid subject and class from this school.');
  const levelCover = levelAssignments.some(row => row.schoolId === actor.schoolId && row.subjectId === subject.id && row.levelId === classRef.levelId && row.status === 'active');
  const current = assignments.find(row => row.subjectId === subject.id && row.classId === classRef.id);
  if (!current && input.status === 'inactive') return fail('invalid_target', 'Subject is not assigned to this class.');
  if (!current && !levelCover && input.status === 'active' && assignments.some(row => row.status === 'active' && row.subjectId === subject.id && row.classId === classRef.id)) return fail('duplicate', 'This subject is already assigned to the class.');
  if (!current && !levelCover && input.status === 'inactive') return fail('invalid_target', 'An explicit class assignment is required before deactivation.');
  if (current && current.status === input.status) return { ok: true, value: current };
  return { ok: true, value: { id: current?.id, schoolId: actor.schoolId, subjectId: subject.id, classId: classRef.id, status: input.status } };
}

export function validateTeacherSubjectAssignment(
  input: { schoolId: string; membershipId: string; subjectId: string; classId: string; sessionId: string; status: 'active' | 'inactive' },
  actor: VerifiedAcademicActor,
  teacher: SchoolMembership | null,
  subject: Subject | null,
  classRef: AcademicClassRef | null,
  session: AcademicSessionRef | null,
  teacherAssignments: readonly TeacherClassAssignment[],
  subjectsForClass: readonly SubjectClassAssignment[],
  subjectsForLevel: readonly SubjectLevelAssignment[],
  existing: readonly TeacherSubjectAssignment[],
): SubjectResult<Omit<TeacherSubjectAssignment, 'id'> & { id?: string }> {
  if (!actor?.id) return fail('missing_context', 'Verified school membership is required.');
  if (actor.status !== 'active') return fail('inactive_membership', 'Active membership is required.');
  if (actor.role !== 'admin') return fail('forbidden', 'Only school admins may assign teachers to subjects.');
  const rows = [...teacherAssignments, ...subjectsForClass, ...subjectsForLevel, ...existing];
  if (input.schoolId !== actor.schoolId || rows.some(row => row.schoolId !== actor.schoolId)) return fail('school_mismatch', 'Teacher or subject assignment crosses school boundaries.');
  if (!teacher || teacher.role !== 'teacher' || teacher.schoolId !== actor.schoolId || teacher.id !== input.membershipId || (input.status === 'active' && teacher.status !== 'active')) return fail('invalid_teacher', 'Choose a valid teacher membership from this school.');
  if (!subject || subject.schoolId !== actor.schoolId || subject.id !== input.subjectId || !classRef || classRef.schoolId !== actor.schoolId || classRef.id !== input.classId || !session || session.schoolId !== actor.schoolId || session.id !== input.sessionId || (input.status === 'active' && (!subject.active || !classRef.active || !session.active))) return fail('invalid_target', 'Choose valid subject, class, and session records from this school.');
  const classSubject = subjectsForClass.some(row => row.subjectId === subject.id && row.classId === classRef.id && row.status === 'active');
  const levelSubject = subjectsForLevel.some(row => row.subjectId === subject.id && row.levelId === classRef.levelId && row.status === 'active');
  const teacherClass = teacherAssignments.some(row => row.schoolId === actor.schoolId && row.membershipId === teacher.id && row.classId === classRef.id && row.sessionId === session.id && row.status === 'active');
  const current = existing.find(row => row.membershipId === teacher.id && row.subjectId === subject.id && row.classId === classRef.id && row.sessionId === session.id);
  if (!current && input.status === 'inactive') return fail('invalid_assignment', 'Teacher is not assigned to this subject, class, and session.');
  if (input.status === 'active' && (!classSubject && !levelSubject || !teacherClass)) return fail('invalid_assignment', 'Assign the subject to the class or level and the teacher to the class/session first.');
  if (current && current.status === input.status) return { ok: true, value: current };
  return { ok: true, value: { id: current?.id, schoolId: actor.schoolId, membershipId: teacher.id, subjectId: subject.id, classId: classRef.id, sessionId: session.id, status: input.status } };
}
