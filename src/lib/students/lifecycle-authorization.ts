/** Policy for future server operations; callers must resolve membership from verified auth. */
export type LifecycleRole = 'admin' | 'teacher' | 'bursar';
export type LifecycleOperation =
  | 'read_structure'
  | 'edit_structure'
  | 'read_roster'
  | 'read_profile'
  | 'read_guardians'
  | 'register_student'
  | 'manage_guardians'
  | 'manage_enrollment'
  | 'propose_progression'
  | 'decide_progression'
  | 'record_exit'
  | 'readmit_student'
  | 'read_audit';

export type LifecycleAccess = {
  schoolId: string;
  role: LifecycleRole;
  membershipStatus: 'active' | 'suspended';
};

const allowedRoles: Record<LifecycleOperation, readonly LifecycleRole[]> = {
  read_structure: ['admin', 'teacher'],
  edit_structure: ['admin'],
  read_roster: ['admin', 'teacher'],
  read_profile: ['admin'],
  read_guardians: ['admin'],
  register_student: ['admin'],
  manage_guardians: ['admin'],
  manage_enrollment: ['admin'],
  propose_progression: ['admin', 'teacher'],
  decide_progression: ['admin'],
  record_exit: ['admin'],
  readmit_student: ['admin'],
  read_audit: ['admin'],
};

/** Deny unknown roles, operations, schools and inactive memberships at runtime. */
export function canPerformLifecycleOperation(
  access: LifecycleAccess | null,
  resourceSchoolId: string,
  operation: LifecycleOperation,
  assignedStudentVerified = false,
): boolean {
  return Boolean(
    access &&
    access.membershipStatus === 'active' &&
    access.schoolId.trim() &&
    resourceSchoolId.trim() &&
    access.schoolId === resourceSchoolId &&
    allowedRoles[operation]?.includes(access.role) &&
    (access.role !== 'teacher' || !['read_roster', 'propose_progression'].includes(operation) || assignedStudentVerified),
  );
}
