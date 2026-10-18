import type {
  EnrollmentClassOption,
  EnrollmentSessionOption,
  StudentEnrollmentRecord,
} from './enrollment-management';

export type ClassAssignmentSelection = {
  classId: string;
  sessionId: string;
};

export type ClassAssignmentValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export function validateClassAssignment(
  selection: ClassAssignmentSelection,
  classes: EnrollmentClassOption[],
  sessions: EnrollmentSessionOption[],
  enrollments: StudentEnrollmentRecord[]
): ClassAssignmentValidationResult {
  if (!selection.sessionId) {
    return { valid: false, error: 'Select an academic session.' };
  }

  if (!sessions.some(session => session.id === selection.sessionId)) {
    return { valid: false, error: 'The selected academic session is unavailable.' };
  }

  if (!selection.classId) {
    return { valid: false, error: 'Select a class.' };
  }

  if (!classes.some(schoolClass => schoolClass.id === selection.classId)) {
    return { valid: false, error: 'The selected class is unavailable.' };
  }

  if (enrollments.some(enrollment => enrollment.sessionId === selection.sessionId)) {
    return {
      valid: false,
      error: 'This student already has an enrollment for the selected academic session.',
    };
  }

  return { valid: true };
}