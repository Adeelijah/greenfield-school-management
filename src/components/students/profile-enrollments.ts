import type { ClassStructure } from '../academics/class-structure';
import type { StudentAcademicHistoryPreview, StudentEnrollmentPreview } from './student-profile';

/** One mapping supplies the profile's enrollment table and assignment duplicate checks. */
export function profileEnrollments(studentId: string, current: StudentEnrollmentPreview | null, history: StudentAcademicHistoryPreview[], structure?: ClassStructure) {
  const records = [...history];
  if (current && !records.some(record => record.academicSession === current.academicSession)) records.push({ ...current, id: `${studentId}-current` });
  const classes = structure
    ? structure.levels.flatMap(level => level.sections.map(section => ({ id: `${level.id}:${section.id}`, name: level.name, section: section.name })))
    : records.map(record => ({ id: `preview-class-${record.id}`, name: record.className, section: record.section }));
  const sessions = [...new Set([...records.map(record => record.academicSession), '2027/2028'])].map(label => ({ id: label, label, isCurrent: label === current?.academicSession }));
  const enrollments = records.map(record => ({
    id: record.id, studentId, sessionId: record.academicSession, status: record.status,
    classId: record.levelId && record.sectionId ? `${record.levelId}:${record.sectionId}` : classes.find(item => item.name === record.className && item.section === record.section)?.id ?? '',
  }));
  return { classes, sessions, enrollments };
}
