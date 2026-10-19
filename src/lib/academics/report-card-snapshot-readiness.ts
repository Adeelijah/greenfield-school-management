// Pure review-stage contract: validates the shape and source identity of a
// proposed immutable snapshot. Does not authenticate, hash, or persist data.
export interface SnapshotSourceBinding {
  schoolId: string;
  reportId: string;
  studentId: string;
  enrollmentId: string;
  classId: string;
  sessionId: string;
  termId: string;
  assessmentRevision: number;
  subjectIds: string[];
  finalizedSubjectIds: string[];
  sourceVersionKeys: string[];
}
export type SnapshotReadiness = { ready: true } | { ready: false; reason: string };
export function inspectSnapshotSource(binding: SnapshotSourceBinding): SnapshotReadiness {
  const required=[binding.schoolId,binding.reportId,binding.studentId,binding.enrollmentId,binding.classId,binding.sessionId,binding.termId];
  if(required.some(x=>typeof x!=='string'||!x.trim())) return {ready:false,reason:'missing identity'};
  if(!Number.isSafeInteger(binding.assessmentRevision)||binding.assessmentRevision<0) return {ready:false,reason:'invalid revision'};
  if(!binding.subjectIds.length||binding.subjectIds.some(x=>!x.trim())||new Set(binding.subjectIds).size!==binding.subjectIds.length) return {ready:false,reason:'invalid subject roster'};
  if(binding.finalizedSubjectIds.length!==binding.subjectIds.length||new Set(binding.finalizedSubjectIds).size!==binding.finalizedSubjectIds.length||binding.finalizedSubjectIds.some(x=>!binding.subjectIds.includes(x))) return {ready:false,reason:'incomplete finalized roster'};
  if(!binding.sourceVersionKeys.length||binding.sourceVersionKeys.some(x=>!x.trim())||new Set(binding.sourceVersionKeys).size!==binding.sourceVersionKeys.length) return {ready:false,reason:'invalid source versions'};
  return {ready:true};
}
