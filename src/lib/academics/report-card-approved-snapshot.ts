// Pure snapshot content boundary. Authentication/locks remain caller obligations.
import { createHash } from 'node:crypto';
import type { CompleteAssessmentSource, StoredAssessmentSource, StoredAssessmentFinalization, StoredAssessmentReview } from './assessment-canonical-source';
// @ts-expect-error Node type stripping requires explicit source extension.
import { verifyAssessmentSourceContent } from './assessment-canonical-source.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { recalculateRelationalSubject } from './assessment-relational-recalculation.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
export type CanonicalAssessmentDocuments = { input: CompleteAssessmentSource; source: StoredAssessmentSource; finals: readonly StoredAssessmentFinalization[]; reviews: readonly StoredAssessmentReview[] };
export type ApprovedReportBinding = { id: string; schoolId: string; enrollmentId: string; studentId: string; classId: string; sessionId: string; termId: string; assessmentScopeId: string; assessmentSourceVersionId: string; assessmentRevision: number; approvedVersion: number; submittedBy: string; approvedBy: string; approvedAt: string };
export type ApprovedSnapshot = { binding: ApprovedReportBinding; canonicalJson: string; sha256: string; sourceVersions: readonly { rosterId: string; sourceVersionId: string; revision: number; configVersionId: string; configRevision: number; finalizationId: string; teacherReviewId: string; contentHash: string }[] };
/** Validates complete assessment content again and extracts ONLY this pupil.
 * It never trusts a supplied total or invents calendar versions/term ordinals.
 * Approval identity/time must come from the verified transaction, not the client.
 */
export function buildApprovedReportSnapshot(raw: ApprovedReportBinding, docs: CanonicalAssessmentDocuments): { ok: true; snapshot: ApprovedSnapshot } | { ok: false; code: 'invalid_binding' | 'invalid_source' } {
 try {
  const binding: ApprovedReportBinding = JSON.parse(canonicalizeSnapshotValue(raw));
  if (Object.values(binding).some(v => typeof v === 'string' && !v.trim()) || !Number.isSafeInteger(binding.approvedVersion) || binding.approvedVersion < 3 || !Number.isSafeInteger(binding.assessmentRevision) || binding.assessmentRevision < 1 || binding.submittedBy === binding.approvedBy || !Number.isFinite(Date.parse(binding.approvedAt)) || new Date(binding.approvedAt).toISOString() !== binding.approvedAt) return { ok: false, code: 'invalid_binding' };
  for (const key of ['id','schoolId','enrollmentId','studentId','classId','sessionId','termId','assessmentScopeId','assessmentSourceVersionId','submittedBy','approvedBy'] as const) if (typeof binding[key] !== 'string' || !binding[key].trim()) return { ok: false, code: 'invalid_binding' };
  const checked = verifyAssessmentSourceContent(docs.input, docs.source, docs.finals, docs.reviews);
  if (!checked.ok) return { ok: false, code: 'invalid_source' };
  const { input, source } = docs; const { scope } = input;
  if (binding.schoolId !== scope.schoolId || binding.classId !== scope.classId || binding.sessionId !== scope.sessionId || binding.termId !== scope.termId || binding.assessmentScopeId !== scope.id || binding.assessmentRevision !== scope.revision || binding.assessmentSourceVersionId !== source.id || input.enrollments.filter(e => e.id === binding.enrollmentId && e.studentId === binding.studentId).length !== 1) return { ok: false, code: 'invalid_binding' };
  const rows = [...input.roster].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const sourceVersions = rows.map(r => {
   const config = input.configs.find(c => c.config.id === r.configVersionId)!.config;
   const final = docs.finals.find(f => f.rosterId === r.id)!;
   return { rosterId: r.id, sourceVersionId: source.id, revision: scope.revision, configVersionId: config.id, configRevision: config.version, finalizationId: final.id, teacherReviewId: final.teacherReviewId, contentHash: final.contentHash };
  });
  const subjects = rows.map(r => {
   const config = input.configs.find(c => c.config.id === r.configVersionId)!.config;
   const scores = input.scores.filter(s => s.rosterId === r.id && s.enrollmentId === binding.enrollmentId).sort((a,b) => a.componentKey < b.componentKey ? -1 : a.componentKey > b.componentKey ? 1 : 0);
   const result = recalculateRelationalSubject(config, input.level.stage, scores);
   if (!result.ok) throw Error('Invalid selected pupil result');
   const catalog = input.catalog.find(c => c.id === r.subjectId)!;
   const final = docs.finals.find(f => f.rosterId === r.id)!;
   const review = docs.reviews.find(v => v.id === final.teacherReviewId)!;
   return { rosterId: r.id, subjectId: r.subjectId, rosterVersion: r.rosterVersion, code: catalog.code, name: catalog.name,
    config, result: result.result, scores: scores.map(s => ({ id: s.id, componentKey: s.componentKey, numericScore: s.numericScore === null ? null : normalizeDecimal(s.numericScore), observationKey: s.observationKey, version: s.version })),
    finalizationId: final.id, teacherReviewId: review.id, finalizedBy: final.finalizedBy, reviewedBy: review.reviewerMembershipId };
  });
  const canonicalJson = canonicalizeSnapshotValue({ format: 'greenfield.report-card.approved-snapshot.v1', binding, source: { id: source.id, scopeId: scope.id, revision: scope.revision, contentHash: source.contentHash },
   placement: { school: input.school, klass: input.klass, level: input.level, section: input.section, session: input.session, term: input.term }, sourceVersions, subjects });
  return { ok: true, snapshot: { binding, canonicalJson, sha256: createHash('sha256').update(canonicalJson, 'utf8').digest('hex'), sourceVersions } };
 } catch { return { ok: false, code: 'invalid_source' }; }
}
// Exact database-scale normalization; scores already passed bounded decimal checks.
function normalizeDecimal(value: string): string { const [whole, fraction = ''] = value.split('.'); return whole + '.' + fraction.padEnd(4, '0'); }
export function matchesApprovedReportSnapshot(expected: ApprovedSnapshot, stored: { canonicalPayload: unknown; contentHash: string; sourceVersions: unknown }): boolean {
 try { return stored.contentHash === expected.sha256 && canonicalizeSnapshotValue(stored.canonicalPayload) === expected.canonicalJson && canonicalizeSnapshotValue(stored.sourceVersions) === canonicalizeSnapshotValue(expected.sourceVersions); } catch { return false; }
}
