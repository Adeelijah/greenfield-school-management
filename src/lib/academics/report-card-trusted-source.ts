// Review-only trusted source gate. All rows must be loaded under one verified,
// school-scoped database transaction; browser input is never authoritative.
import type { SnapshotSourceBinding } from './report-card-snapshot-readiness.ts';
export type TrustedEnrollmentRow = {
  id: string; schoolId: string; studentId: string; classId: string; sessionId: string;
  status: 'active' | 'completed' | 'withdrawn' | 'graduated';
};
export type TrustedSubjectRow = {
  schoolId: string; classId: string; sessionId: string; termId: string;
  subjectId: string; finalized: boolean; assessmentRevision: number;
  sourceVersionKey: string;
};
export type TrustedSourceRows = {
  schoolId: string; assessmentRevision: number;
  enrollments: readonly TrustedEnrollmentRow[];
  subjects: readonly TrustedSubjectRow[];
};
export type SourceGate = { ok: true } | { ok: false; reason: string };
const reject = (reason: string): SourceGate => ({ ok: false, reason });
export function verifyReportSnapshotSource(binding: SnapshotSourceBinding, rows: TrustedSourceRows): SourceGate {
  if (!binding || !rows || !rows.schoolId || rows.schoolId !== binding.schoolId ||
      !Number.isSafeInteger(rows.assessmentRevision) || rows.assessmentRevision < 0 ||
      rows.assessmentRevision !== binding.assessmentRevision ||
      !Array.isArray(rows.enrollments) || !Array.isArray(rows.subjects)) return reject('invalid trusted context');
  // A student may have historical enrollments, but cannot have multiple active
  // enrollments within the same academic session.
  if (rows.enrollments.some(e => !e || e.schoolId !== rows.schoolId || !e.id || !e.studentId || !e.classId || !e.sessionId))
    return reject('invalid enrollment row');
  const active = rows.enrollments.filter(e => e.studentId === binding.studentId && e.sessionId === binding.sessionId && e.status === 'active');
  if (active.length !== 1 || active[0]!.id !== binding.enrollmentId || active[0]!.classId !== binding.classId)
    return reject('enrollment mismatch or duplicate');
  if (!rows.subjects.length || rows.subjects.some(s => !s || s.schoolId !== rows.schoolId ||
      s.classId !== binding.classId || s.sessionId !== binding.sessionId || s.termId !== binding.termId ||
      !s.subjectId || !s.finalized || s.assessmentRevision !== rows.assessmentRevision ||
      !s.sourceVersionKey)) return reject('invalid finalized source');
  const actualSubjects = rows.subjects.map(s => s.subjectId);
  const actualVersions = rows.subjects.map(s => s.sourceVersionKey);
  const sameSet = (a: readonly string[], c: readonly string[]) => a.length === c.length && new Set(a).size === a.length &&
    new Set(c).size === c.length && a.every(x => c.includes(x));
  if (!sameSet(actualSubjects, binding.subjectIds) ||
      !sameSet(actualSubjects, binding.finalizedSubjectIds) ||
      !sameSet(actualVersions, binding.sourceVersionKeys))
    return reject('subject roster or version mismatch');
  return { ok: true };
}
