// Fictional data factories: each caller owns its school-scoped data; no mutable singleton.
// @ts-expect-error Node 22 tests require explicit TypeScript extensions.
import { nextAcademicLevel, type ClassStructure } from '../academics/class-structure.ts';
import type { AcademicStudent } from './academic-progression';
import type { StudentExitRecord } from './student-exit-validation';
import type { StudentLifecyclePreview } from './student-lifecycle';
import type { StudentEnrollmentPreview, StudentAcademicHistoryPreview } from './student-profile';

export function previewStructure(final: 5 | 6 = 5): ClassStructure {
  const levels = [
    { id: 'creche', name: 'Creche', stage: 'creche' as const },
    { id: 'nursery-1', name: 'Nursery 1', stage: 'nursery' as const },
    { id: 'nursery-2', name: 'Nursery 2', stage: 'nursery' as const },
    ...Array.from({ length: final }, (_, index) => ({ id: `primary-${index + 1}`, name: `Primary ${index + 1}`, stage: 'primary' as const })),
  ].map((level, order) => Object.freeze({ ...level, order, sections: Object.freeze([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }].map(section => Object.freeze(section))) }));
  return Object.freeze({ schoolId: `fictional-primary-${final}`, levels: Object.freeze(levels), finalLevelId: `primary-${final}` });
}

export type PreviewPupil = AcademicStudent & { name: string; admissionNumber: string; currentClass: string };
export function previewPupils(structure: ClassStructure): PreviewPupil[] {
  return [
    { id: 'ada', name: 'Ada Okafor', levelId: 'primary-3', sectionId: 'b', status: 'active' as const },
    { id: 'tunde', name: 'Tunde Adebayo', levelId: 'primary-3', sectionId: 'a', status: 'active' as const },
    { id: 'bola', name: 'Bola Hassan', levelId: structure.finalLevelId, sectionId: 'b', status: 'active' as const },
    { id: 'chidi', name: 'Chidi Eze', levelId: 'primary-2', sectionId: 'b', status: 'active' as const },
    { id: 'zara', name: 'Zara Ibrahim', levelId: 'primary-3', sectionId: 'a', status: 'withdrawn' as const },
    { id: 'emeka', name: 'Emeka Obi', levelId: 'primary-4', sectionId: 'b', status: 'withdrawn' as const },
  ].map((pupil, index) => ({ ...pupil, schoolId: structure.schoolId, admissionNumber: `GF/2026/00${index + 1}`, currentSession: '2026/2027', enrolledSessions: pupil.id === 'chidi' ? ['2026/2027', '2027/2028'] : ['2026/2027'], currentClass: `${structure.levels.find(level => level.id === pupil.levelId)?.name ?? 'Unconfigured level'} - Section ${pupil.sectionId.toUpperCase()}` }));
}

export function previewDepartures(structure: ClassStructure): StudentExitRecord[] {
  return previewPupils(structure).filter(pupil => pupil.status === 'withdrawn').map(pupil => ({
    id: `${structure.schoolId}-${pupil.id}-departure`, studentId: pupil.id, studentName: pupil.name, className: pupil.currentClass,
    kind: pupil.id === 'zara' ? 'transfer' : 'early_exit', reason: pupil.id === 'zara' ? 'relocation' : 'secondary_school',
    effectiveDate: '2026-09-18', destinationSchool: pupil.id === 'zara' ? 'Fictional Example School' : '', notes: 'Fictional historical example, not a newly confirmed departure.', guardianRequestConfirmed: true, recordedAt: '2026-09-18', state: 'preview',
  }));
}

export function profilePreviewFor(structure: ClassStructure, pupil: PreviewPupil) {
  if (pupil.schoolId !== structure.schoolId) throw new Error('School mismatch');
  const level = structure.levels.find(item => item.id === pupil.levelId);
  const section = level?.sections.find(item => item.id === pupil.sectionId);
  const enrollment: StudentEnrollmentPreview | undefined = level && section ? { levelId: level.id, sectionId: section.id, className: level.name, section: section.name, academicSession: pupil.currentSession, status: pupil.status } : undefined;
  const academicHistory: StudentAcademicHistoryPreview[] = enrollment ? [{ ...enrollment, id: `${pupil.id}-current` }] : [];
  if (pupil.id === 'tunde' && enrollment) academicHistory.push({ ...enrollment, id: 'tunde-repeat', academicSession: '2025/2026', status: 'completed' });
  if (pupil.id === 'chidi' && enrollment) {
    const next = nextAcademicLevel(structure, pupil.levelId);
    const destinationSection = next?.sections.find(item => item.id === pupil.sectionId) ?? next?.sections[0];
    if (next && destinationSection) academicHistory.push({ ...enrollment, id: 'chidi-destination', levelId: next.id, sectionId: destinationSection.id, section: destinationSection.name, className: next.name, academicSession: '2027/2028', status: 'planned' });
  }
  const lifecycle: StudentLifecyclePreview = {
    schoolName: `Fictional Greenfield Academy (${structure.levels.find(item => item.id === structure.finalLevelId)?.name ?? 'unconfigured'} final)`,
    currentLevel: level?.name ?? 'No academic level supplied', nextLevel: nextAcademicLevel(structure, pupil.levelId)?.name ?? null,
    finalLevel: structure.levels.find(item => item.id === structure.finalLevelId)?.name ?? 'Not configured', isFinalLevel: pupil.levelId === structure.finalLevelId,
    departures: previewDepartures(structure).filter(record => record.studentId === pupil.id),
  };
  return { enrollment, academicHistory, lifecycle, structure, guardians: [{ id: `${pupil.id}-guardian`, fullName: `Fictional guardian of ${pupil.name}`, relationship: 'Guardian', isPrimary: true }] };
}
