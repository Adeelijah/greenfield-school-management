import type {
  PromotionDecision,
  PromotionStudent,
} from './promotion-validation';

export type ClassProgression = {
  className: string;
  nextClassName: string | null;
  isFinalClass: boolean;
};

export type PromotionEligibilityResult =
  | { valid: true }
  | { valid: false; error: string };

function sessionStartYear(label: string): number | null {
  const match = /^(\d{4})\/(\d{4})$/.exec(label.trim());

  if (!match) return null;

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (end !== start + 1) return null;

  return start;
}

export function validatePromotionEligibility(
  student: PromotionStudent,
  decision: PromotionDecision,
  destinationSession: string,
  progression: ClassProgression[]
): PromotionEligibilityResult {
  if (student.status !== 'active') {
    return {
      valid: false,
      error: 'Only active students can be promoted, repeated or graduated.',
    };
  }

  if (decision.studentId !== student.id) {
    return { valid: false, error: 'Student selection is invalid.' };
  }

  if (student.destinationEnrolled) {
    return {
      valid: false,
      error: 'Student already has an enrollment in the destination session.',
    };
  }

  const currentYear = sessionStartYear(student.currentSession);
  const destinationYear = sessionStartYear(destinationSession);

  if (currentYear === null || destinationYear === null) {
    return {
      valid: false,
      error: 'Academic session must use YYYY/YYYY format.',
    };
  }

  if (destinationYear <= currentYear) {
    return {
      valid: false,
      error: 'Destination academic session must be later than the current session.',
    };
  }

  const currentClass = progression.find(
    item => item.className === student.currentClass
  );

  if (!currentClass) {
    return {
      valid: false,
      error: 'Student current class is not configured in class progression.',
    };
  }

  if (decision.action === 'graduate') {
    if (!currentClass.isFinalClass) {
      return {
        valid: false,
        error: 'Only students in the final class can graduate.',
      };
    }

    if (decision.destinationClass) {
      return {
        valid: false,
        error: 'Graduation must not assign a destination class.',
      };
    }

    return { valid: true };
  }

  if (decision.action === 'repeat') {
    if (decision.destinationClass !== currentClass.className) {
      return {
        valid: false,
        error: 'Repeating students must remain in their current class.',
      };
    }

    return { valid: true };
  }

  if (decision.action === 'promote') {
    if (currentClass.isFinalClass || !currentClass.nextClassName) {
      return {
        valid: false,
        error: 'This class has no configured promotion destination.',
      };
    }

    if (decision.destinationClass !== currentClass.nextClassName) {
      return {
        valid: false,
        error: `Student must be promoted to ${currentClass.nextClassName}.`,
      };
    }

    return { valid: true };
  }

  return {
    valid: false,
    error: 'Unsupported promotion decision.',
  };
}