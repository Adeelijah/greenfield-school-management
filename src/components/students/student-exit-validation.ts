export type StudentExitKind = 'transfer' | 'early_exit';

export type StudentExitReason =
  | 'parent_request'
  | 'secondary_school'
  | 'relocation'
  | 'other';

export type ExitStudent = {
  id: string;
  name: string;
  admissionNumber: string;
  className: string;
  status: 'active' | 'graduated' | 'withdrawn';
};

export type StudentExitDraft = {
  studentId: string;
  kind: StudentExitKind;
  reason: StudentExitReason;
  effectiveDate: string;
  destinationSchool: string;
  notes: string;
  guardianRequestConfirmed: boolean;
};

export type StudentExitRecord = StudentExitDraft & {
  id: string;
  studentName: string;
  className: string;
  recordedAt: string;
  state: 'preview';
};

export type ExitValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateStudentExit(
  student: ExitStudent | undefined,
  draft: StudentExitDraft,
  existingRecords: StudentExitRecord[],
  today: string
): ExitValidation {
  const errors: string[] = [];

  if (!student || student.id !== draft.studentId) {
    errors.push('Select a valid student.');
  } else if (student.status !== 'active') {
    errors.push('Only active students can be processed.');
  }

  if (existingRecords.some(record => record.studentId === draft.studentId)) {
    errors.push('This student already has a departure record.');
  }

  if (draft.kind !== 'transfer' && draft.kind !== 'early_exit') {
    errors.push('Select a valid departure type.');
  }

  if (!['parent_request', 'secondary_school', 'relocation', 'other']
    .includes(draft.reason)) {
    errors.push('Select a valid departure reason.');
  }

  if (!validCalendarDate(draft.effectiveDate)) {
    errors.push('Enter a valid effective date.');
  } else if (
    validCalendarDate(today) &&
    draft.effectiveDate > today
  ) {
    errors.push('The effective date cannot be in the future.');
  }

  if (
    draft.kind === 'transfer' &&
    !draft.destinationSchool.trim()
  ) {
    errors.push('Enter the destination school for a transfer.');
  }

  if (draft.destinationSchool.trim().length > 180) {
    errors.push('Destination school must not exceed 180 characters.');
  }

  if (draft.notes.trim().length > 1000) {
    errors.push('Notes must not exceed 1000 characters.');
  }

  if (!draft.guardianRequestConfirmed) {
    errors.push('Confirm that the guardian request was reviewed.');
  }

  return errors.length
    ? { valid: false, errors }
    : { valid: true };
}