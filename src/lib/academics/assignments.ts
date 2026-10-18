import type { academicSessions, classes, memberships } from '@/db/schema';

export type AcademicRole = 'admin' | 'teacher' | 'bursar';
type MembershipRow = typeof memberships.$inferSelect;
/** Minimal projection of Greenfield's existing membership model. */
export type SchoolMembership = Pick<MembershipRow, 'id' | 'schoolId' | 'role' | 'status'>;
export type VerifiedAcademicActor = SchoolMembership | null;

type ClassRow = typeof classes.$inferSelect;
/** Adapter projection; `active` is derived from the linked level and section. */
export type AcademicClassRef = Omit<Pick<ClassRow, 'id' | 'schoolId' | 'levelId' | 'sectionId'>, 'levelId' | 'sectionId'> & {
  levelId: string;
  sectionId: string;
  active: boolean;
};
type SessionRow = typeof academicSessions.$inferSelect;
/** Adapter projection; `active` is an application availability decision. */
export type AcademicSessionRef = Pick<SessionRow, 'id' | 'schoolId'> & { active: boolean };
export type TeacherClassAssignment = {
  id: string;
  schoolId: string;
  membershipId: string;
  classId: string;
  sessionId: string;
  status: 'active' | 'inactive';
};

export type AssignmentCommand =
  | { kind: 'assign'; schoolId: string; teacherMembershipId: string; classId: string; sessionId: string }
  | { kind: 'set_status'; schoolId: string; assignmentId: string; status: 'active' | 'inactive' };

export type AssignmentFailureCode =
  | 'missing_context' | 'inactive_membership' | 'forbidden' | 'school_mismatch'
  | 'invalid_teacher' | 'invalid_class' | 'invalid_session' | 'not_found' | 'duplicate';
export type AssignmentResult =
  | { ok: true; operation: 'create' | 'update'; assignment: Omit<TeacherClassAssignment, 'id'> & { id?: string } }
  | { ok: false; code: AssignmentFailureCode; message: string };

const fail = (code: AssignmentFailureCode, message: string): AssignmentResult => ({ ok: false, code, message });

/** Context and rows must be assembled by a trusted server adapter, never from request claims. */
export function validateTeacherClassAssignment(
  command: AssignmentCommand,
  actor: VerifiedAcademicActor,
  teacherMembership: SchoolMembership | null,
  classRef: AcademicClassRef | null,
  session: AcademicSessionRef | null,
  existing: readonly TeacherClassAssignment[],
): AssignmentResult {
  if (!actor?.id || !actor.schoolId) return fail('missing_context', 'Verified school membership is required.');
  if (actor.status !== 'active') return fail('inactive_membership', 'Active membership is required.');
  if (actor.role !== 'admin') return fail('forbidden', 'Only school admins may manage class assignments.');
  if (command.schoolId !== actor.schoolId) return fail('school_mismatch', 'Assignment school does not match verified membership.');
  if (existing.some(row => row.schoolId !== actor.schoolId)) return fail('school_mismatch', 'Assignment history contains a cross-school row.');

  if (command.kind === 'assign') {
    if (!teacherMembership || teacherMembership.role !== 'teacher' || teacherMembership.status !== 'active') {
      return fail('invalid_teacher', 'Choose an active teacher membership from this school.');
    }
    if (teacherMembership.schoolId !== actor.schoolId || teacherMembership.id !== command.teacherMembershipId) {
      return fail('school_mismatch', 'Teacher membership does not belong to this school.');
    }
    if (!classRef || !classRef.active || classRef.id !== command.classId || classRef.schoolId !== actor.schoolId) {
      return fail('invalid_class', 'Choose an active class from this school.');
    }
    if (!session || !session.active || session.id !== command.sessionId || session.schoolId !== actor.schoolId) {
      return fail('invalid_session', 'Choose an active academic session from this school.');
    }
    const duplicate = existing.some(row => row.status === 'active' && row.membershipId === teacherMembership.id && row.classId === classRef.id && row.sessionId === session.id);
    if (duplicate) return fail('duplicate', 'This teacher is already assigned to the class for this session.');
    return { ok: true, operation: 'create', assignment: { schoolId: actor.schoolId, membershipId: teacherMembership.id, classId: classRef.id, sessionId: session.id, status: 'active' } };
  }

  const assignment = existing.find(row => row.id === command.assignmentId && row.schoolId === actor.schoolId);
  if (!assignment) return fail('not_found', 'Assignment was not found in this school.');
  if (assignment.status === command.status) return { ok: true, operation: 'update', assignment };
  if (command.status === 'active') {
    if (!teacherMembership || teacherMembership.id !== assignment.membershipId || teacherMembership.schoolId !== actor.schoolId || teacherMembership.role !== 'teacher' || teacherMembership.status !== 'active') {
      return fail('invalid_teacher', 'Only an active teacher membership can be assigned.');
    }
    if (!classRef || classRef.id !== assignment.classId || classRef.schoolId !== actor.schoolId || !classRef.active) return fail('invalid_class', 'Only an active class can be assigned.');
    if (!session || session.id !== assignment.sessionId || session.schoolId !== actor.schoolId || !session.active) return fail('invalid_session', 'Only an active academic session can be assigned.');
    if (existing.some(row => row.id !== assignment.id && row.status === 'active' && row.membershipId === assignment.membershipId && row.classId === assignment.classId && row.sessionId === assignment.sessionId)) {
      return fail('duplicate', 'An active assignment already exists for this teacher, class, and session.');
    }
  }
  return { ok: true, operation: 'update', assignment: { ...assignment, status: command.status } };
}

export function canReadAssignedClass(
  actor: VerifiedAcademicActor,
  schoolId: string,
  classId: string,
  sessionId: string,
  assignments: readonly TeacherClassAssignment[],
): boolean {
  if (!actor || actor.status !== 'active' || actor.schoolId !== schoolId) return false;
  if (actor.role === 'admin') return true;
  if (actor.role !== 'teacher') return false;
  return assignments.some(row => row.schoolId === actor.schoolId && row.membershipId === actor.id && row.classId === classId && row.sessionId === sessionId && row.status === 'active');
}
