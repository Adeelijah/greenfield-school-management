// @ts-expect-error Node 22 tests require explicit TypeScript extensions.
import { nextAcademicLevel, validateClassStructure, type ClassStructure } from '../academics/class-structure.ts';
import type { PromotionAction } from './promotion-validation';

export type AcademicStudent = {
  id: string;
  schoolId: string;
  levelId: string;
  sectionId: string;
  currentSession: string;
  status: 'active' | 'graduated' | 'withdrawn';
  enrolledSessions: readonly string[];
};
export type AcademicDecision = {
  studentId: string;
  action: PromotionAction;
  levelId: string;
  sectionId: string;
};
export function sessionYear(session: string): number | null {
  const match = /^(\d{4})\/(\d{4})$/.exec(session);
  return match && Number(match[2]) === Number(match[1]) + 1 ? Number(match[1]) : null;
}
export function validateAcademicDecision(structure: ClassStructure, student: AcademicStudent, decision: AcademicDecision, session: string): string | null {
  if (!validateClassStructure(structure).valid) return 'School academic structure is invalid.';
  if (student.schoolId !== structure.schoolId || decision.studentId !== student.id) return 'Student does not belong to this school selection.';
  if (student.status !== 'active') return 'Only active students can be processed.';
  const current = structure.levels.find(level => level.id === student.levelId);
  if (!current || !current.sections.some(section => section.id === student.sectionId)) return 'Current level or section is not configured.';
  const currentYear = sessionYear(student.currentSession);
  const destinationYear = sessionYear(session);
  if (currentYear === null || destinationYear === null) return 'Academic session must use consecutive YYYY/YYYY years.';
  if (destinationYear <= currentYear) return 'Destination academic session must be later than the current session.';
  if (student.enrolledSessions.includes(session)) return 'Student already has an enrollment in the destination session.';
  if (decision.action === 'graduate') {
    if (current.id !== structure.finalLevelId) return 'Only students at the configured final Primary level can graduate.';
    return decision.levelId || decision.sectionId ? 'Graduation must not assign a destination level or section.' : null;
  }
  if (decision.action !== 'promote' && decision.action !== 'repeat') return 'Select a valid academic decision.';
  const destination = decision.action === 'repeat' ? current : nextAcademicLevel(structure, current.id);
  if (!destination) return 'No next academic level is configured. Choose repeat or graduation.';
  if (decision.levelId !== destination.id) return `Destination academic level must be ${destination.name}.`;
  if (!destination.sections.some(section => section.id === decision.sectionId)) return 'Select a valid section for the destination academic level.';
  return null;
}
