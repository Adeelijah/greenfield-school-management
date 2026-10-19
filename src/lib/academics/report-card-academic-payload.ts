// Review-stage, server-sourced academic payload. No DB, authorization or publication.
export type NumericSubject = {
  kind: 'numeric';
  subjectId: string;
  finalized: true;
  total: number;
  grade: string;
  remark: string | null;
  components: { componentId: string; score: number; maximum: number; weight: number }[];
};
export type ObservationalSubject = {
  kind: 'observational';
  subjectId: string;
  finalized: true;
  observation: string;
  level: string;
};
export type AcademicSubject = NumericSubject | ObservationalSubject;
export interface AcademicSnapshotPayload {
  stage: 'creche' | 'nursery' | 'primary';
  subjects: AcademicSubject[];
  attendance: { present: number; possible: number } | null;
  teacherRemark: string | null;
  principalRemark: string | null;
}
export type PayloadDecision = { valid: true } | { valid: false; reason: string };
const finite = (value: number) => Number.isFinite(value);
const nonnegativeInteger = (value: number) => Number.isSafeInteger(value) && value >= 0;
export function validateAcademicSnapshotPayload(payload: AcademicSnapshotPayload, expectedSubjectIds: readonly string[]): PayloadDecision {
  if (!payload || !['creche', 'nursery', 'primary'].includes(payload.stage)) return { valid: false, reason: 'invalid stage' };
  if (!Array.isArray(payload.subjects) || !expectedSubjectIds.length || payload.subjects.length !== expectedSubjectIds.length) return { valid: false, reason: 'incomplete roster' };
  const expected = new Set(expectedSubjectIds);
  if (expected.size !== expectedSubjectIds.length || payload.subjects.some(s => !s || !expected.has(s.subjectId)) || new Set(payload.subjects.map(s => s.subjectId)).size !== expected.size) return { valid: false, reason: 'invalid subject identity' };
  if (payload.teacherRemark !== null && (typeof payload.teacherRemark !== 'string' || !payload.teacherRemark.trim())) return { valid: false, reason: 'invalid teacher remark' };
  if (payload.principalRemark !== null && (typeof payload.principalRemark !== 'string' || !payload.principalRemark.trim())) return { valid: false, reason: 'invalid principal remark' };
  if (payload.attendance !== null && (!payload.attendance || !nonnegativeInteger(payload.attendance.present) || !nonnegativeInteger(payload.attendance.possible) || payload.attendance.present > payload.attendance.possible)) return { valid: false, reason: 'invalid attendance' };
  for (const subject of payload.subjects) {
    if (subject.finalized !== true) return { valid: false, reason: 'unfinalized subject' };
    if (subject.kind === 'numeric') {
      if (payload.stage !== 'primary' || !finite(subject.total) || subject.total < 0 || subject.total > 100 || typeof subject.grade !== 'string' || !subject.grade.trim() || subject.remark !== null && (typeof subject.remark !== 'string' || !subject.remark.trim())) return { valid: false, reason: 'invalid numeric result' };
      if (!Array.isArray(subject.components) || !subject.components.length || new Set(subject.components.map(c => c.componentId)).size !== subject.components.length) return { valid: false, reason: 'invalid components' };
      if (subject.components.some(c => !c || typeof c.componentId !== 'string' || !c.componentId.trim() || !finite(c.score) || !finite(c.maximum) || !finite(c.weight) || c.maximum <= 0 || c.score < 0 || c.score > c.maximum || c.weight <= 0 || c.weight > 100)) return { valid: false, reason: 'invalid component score' };
      if (Math.abs(subject.components.reduce((sum, c) => sum + c.weight, 0) - 100) > 1e-8) return { valid: false, reason: 'invalid component weights' };
    } else if (subject.kind === 'observational') {
      if (payload.stage === 'primary' || typeof subject.observation !== 'string' || !subject.observation.trim() || typeof subject.level !== 'string' || !subject.level.trim()) return { valid: false, reason: 'invalid observation' };
    } else return { valid: false, reason: 'unknown result type' };
  }
  return { valid: true };
}
