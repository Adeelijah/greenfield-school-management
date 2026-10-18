export type PromotionAction = 'promote' | 'repeat' | 'graduate';

export type PromotionStudent = {
  id: string;
  name: string;
  admissionNumber: string;
  currentClass: string;
  currentSession: string;
  destinationEnrolled: boolean;
  status: 'active' | 'graduated' | 'withdrawn';
};

export type PromotionDecision = {
  studentId: string;
  action: PromotionAction;
  destinationClass: string;
};

export function validatePromotion(
  student: PromotionStudent,
  decision: PromotionDecision,
  destinationSession: string
): string | null {
  if (!destinationSession.trim()) return 'Select a destination academic session.';
  if (destinationSession === student.currentSession) {
    return 'Destination session must differ from the current session.';
  }
  if (student.status !== 'active') return 'Only active students can be processed.';
  if (student.destinationEnrolled) {
    return 'Student already has an enrollment in the destination session.';
  }
  if (decision.studentId !== student.id) return 'Student selection is invalid.';
  if (decision.action === 'graduate') {
    if (decision.destinationClass) return 'Graduation must not assign a destination class.';
    return null;
  }
  if (!decision.destinationClass.trim()) return 'Select a destination class.';
  if (decision.action === 'repeat' && decision.destinationClass !== student.currentClass) {
    return 'Repeating students must remain in their current class.';
  }
  if (decision.action === 'promote' && decision.destinationClass === student.currentClass) {
    return 'Promotion requires a different destination class.';
  }
  return null;
}