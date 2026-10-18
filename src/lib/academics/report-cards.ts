// @ts-expect-error Node's type-stripping runner requires the explicit source extension.
import { prepareResults, type AssessmentSnapshot, type PreparedResult } from './calendar-assessments.ts';

/** Pure, offline report-card projection. Not an authorization or publication endpoint. */
export type ReportCardRequest = { schoolId: string; studentId: string; classId: string; sessionId: string; termId: string };
export type ReportCardSubject = { subjectId: string; result: PreparedResult; complete: boolean; finalized: boolean };
export type ReportCardDraft = ReportCardRequest & {
  subjects: readonly ReportCardSubject[];
  status: 'incomplete' | 'ready_for_review';
  /** No verified approval or publication record exists in this offline foundation. */
  publishable: false;
};
export type ReportCardOutcome =
  | { ok: true; card: ReportCardDraft }
  | { ok: false; reason: 'school_mismatch' | 'invalid_reference' | 'ineligible_student' | 'no_subjects' };

export function prepareReportCard(snapshot: AssessmentSnapshot, request: ReportCardRequest): ReportCardOutcome {
  if (!snapshot || !request || snapshot.schoolId !== request.schoolId) return { ok: false, reason: 'school_mismatch' };
  const klass = snapshot.classes.find(c => c.id === request.classId && c.schoolId === request.schoolId && c.active);
  const session = snapshot.sessions.find(s => s.id === request.sessionId && s.schoolId === request.schoolId);
  const term = snapshot.terms.find(t => t.id === request.termId && t.sessionId === request.sessionId && t.schoolId === request.schoolId);
  if (!klass || !session || !term) return { ok: false, reason: 'invalid_reference' };
  const enrolled = snapshot.enrollments.some(e => e.schoolId === request.schoolId && e.studentId === request.studentId && e.classId === request.classId && e.sessionId === request.sessionId && e.status === 'active');
  if (!enrolled) return { ok: false, reason: 'ineligible_student' };
  const subjectIds = [...new Set(snapshot.subjects.filter(s => s.schoolId === request.schoolId && s.active && s.levelId === klass.levelId && s.classIds.includes(request.classId)).map(s => s.id))];
  if (!subjectIds.length) return { ok: false, reason: 'no_subjects' };
  const subjects: ReportCardSubject[] = subjectIds.map(subjectId => {
    const key = `${request.classId}:${request.sessionId}:${request.termId}:${subjectId}`;
    const finalized = snapshot.finalizedKeys.includes(key);
    const result = prepareResults(snapshot, request.classId, request.sessionId, request.termId, subjectId, finalized ? 'finalized' : 'draft').find(r => r.studentId === request.studentId);
    const fallback: PreparedResult = { studentId: request.studentId, subjectId, sessionId: request.sessionId, termId: request.termId, state: 'draft', total: null, grade: null, remark: null, missingComponents: ['configuration_or_scores_missing'], componentScores: [] };
    const resolved = result ?? fallback;
    return { subjectId, result: resolved, finalized, complete: resolved.missingComponents.length === 0 && resolved.grade !== null };
  });
  return { ok: true, card: { ...request, subjects, status: subjects.every(s => s.complete && s.finalized) ? 'ready_for_review' : 'incomplete', publishable: false } };
}
