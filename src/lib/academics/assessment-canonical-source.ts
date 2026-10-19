// Pure review-stage provenance policy. Complete inputs must come from locked,
// server-owned scope discovery, not a request body or selected-student reader.
import { createHash } from 'node:crypto';
import type { AssessmentConfig } from './calendar-assessments';
import type { PersistedPlacementRows } from './report-card-persisted-model-map';
import type { AssessmentSourceScope } from './assessment-persistence-policy';
// @ts-expect-error Node type stripping requires explicit source extension.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { recalculateRelationalSubject } from './assessment-relational-recalculation.ts';

type Score = { id: string; schoolId: string; rosterId: string; configVersionId: string; enrollmentId: string; studentId: string; componentKey: string; numericScore: string | null; observationKey: string | null; version: number; updatedBy: string };
type Roster = { id: string; schoolId: string; scopeId: string; subjectId: string; rosterVersion: number; configVersionId: string; isActive: boolean };
type Catalog = { id: string; schoolId: string; code: string; name: string; version: number; isActive: boolean };
export type CompleteAssessmentSource = {
 scope: AssessmentSourceScope;
 school: { id: string; finalPrimaryYear: number | null };
 klass: PersistedPlacementRows['classes'][number];
 level: PersistedPlacementRows['levels'][number];
 section: PersistedPlacementRows['sections'][number];
 session: PersistedPlacementRows['sessions'][number];
 term: PersistedPlacementRows['terms'][number];
 // Entire active class roster, plus all active session enrollments for those
 // students (including conflicting classes, which must be rejected).
 students: PersistedPlacementRows['students'];
 enrollments: PersistedPlacementRows['enrollments'];
 roster: readonly Roster[];
 catalog: readonly Catalog[];
 configs: readonly { sessionId: string; config: AssessmentConfig }[];
 scores: readonly Score[];
};
export type CanonicalDocument = { canonicalJson: string; sha256: string };
export type MaterializedAssessment = { manifest: CanonicalDocument; subjects: readonly { rosterId: string; results: CanonicalDocument }[] };
export type MaterializationOutcome = { ok: true; materialized: MaterializedAssessment } | { ok: false; code: 'invalid_source' };
const document = (value: unknown): CanonicalDocument => {
 const canonicalJson = canonicalizeSnapshotValue(value);
 return { canonicalJson, sha256: createHash('sha256').update(canonicalJson, 'utf8').digest('hex') };
};
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const positive = (v: number) => Number.isSafeInteger(v) && v > 0;
const unique = (rows: readonly { id: string }[]) => rows.every(r => text(r.id)) && new Set(rows.map(r => r.id)).size === rows.length;
const byId = <T extends { id: string }>(rows: readonly T[]) => [...rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const date = (v: string) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const decimal = (v: string) => { const [whole, fraction = ''] = v.split('.'); return whole + '.' + fraction.padEnd(4, '0'); };
/** v1 binds exact scope, placement, enrollment, catalog, roster, configuration
 * documents and score identities/versions/values. Source/review/finalization IDs
 * are excluded from the source digest to avoid a circular dependency. Results
 * separately bind source digest, exact arithmetic policy and the complete roster.
 * Completeness of DB discovery CANNOT be established by this pure function.
 */
export function materializeAssessmentSource(raw: CompleteAssessmentSource): MaterializationOutcome {
 try {
  // Reject accessors, sparse arrays, dates and exotic values before reading fields.
  const input: CompleteAssessmentSource = JSON.parse(canonicalizeSnapshotValue(raw));
  const { scope, school, klass, level, section, session, term, students, enrollments, roster, catalog, configs, scores } = input;
  const fail = { ok: false, code: 'invalid_source' } as const;
  if (![scope.id, scope.schoolId, scope.classId, scope.sessionId, scope.termId, school.id].every(text) || !positive(scope.revision) || school.id !== scope.schoolId || ![5, 6].includes(school.finalPrimaryYear ?? 0)) return fail;
  const scoped = [klass, level, section, session, term, ...students, ...enrollments, ...roster, ...catalog, ...scores, ...configs.map(c => c.config)];
  if (scoped.some(r => !text(r.id) || r.schoolId !== school.id)) return fail;
  if (klass.id !== scope.classId || !text(klass.levelId) || !text(klass.sectionId) || klass.levelId !== level.id || klass.sectionId !== section.id || section.levelId !== level.id || level.isActive !== true || section.isActive !== true) return fail;
  if (!['creche', 'nursery', 'primary'].includes(level.stage) || (level.stage === 'primary' ? !positive(level.primaryYear!) || level.primaryYear! > school.finalPrimaryYear! : level.primaryYear !== null)) return fail;
  if (session.id !== scope.sessionId || term.id !== scope.termId || term.sessionId !== session.id || typeof session.isCurrent !== 'boolean' || typeof term.isCurrent !== 'boolean' || ![session.startsOn, session.endsOn, term.startsOn, term.endsOn].every(date) || session.startsOn > session.endsOn || term.startsOn > term.endsOn || term.startsOn < session.startsOn || term.endsOn > session.endsOn) return fail;
  if (!students.length || !roster.length || ![students, enrollments, roster, catalog, scores].every(rows => unique(rows)) || !unique(configs.map(c => c.config))) return fail;
  if (students.some(s => s.status !== 'active') || enrollments.length !== students.length || enrollments.some(e => e.status !== 'active' || e.classId !== klass.id || e.sessionId !== session.id || !students.some(s => s.id === e.studentId)) || new Set(enrollments.map(e => e.studentId)).size !== students.length) return fail;
  if (new Set(roster.map(r => r.subjectId)).size !== roster.length || roster.some(r => r.scopeId !== scope.id || r.isActive !== true || !positive(r.rosterVersion) || !text(r.subjectId) || !text(r.configVersionId))) return fail;
  if (catalog.length !== roster.length || catalog.some(c => c.isActive !== true || !positive(c.version) || !text(c.code) || !text(c.name) || !roster.some(r => r.subjectId === c.id))) return fail;
  if (configs.some(c => !roster.some(r => r.configVersionId === c.config.id)) || new Set(roster.map(r => r.configVersionId)).size !== configs.length) return fail;
  if (scores.some(s => !text(s.updatedBy) || !roster.some(r => r.id === s.rosterId && r.configVersionId === s.configVersionId) || !enrollments.some(e => e.id === s.enrollmentId && e.studentId === s.studentId))) return fail;
  const subjectResults = [];
  for (const row of byId(roster)) {
   const pinned = configs.find(c => c.config.id === row.configVersionId);
   if (!pinned || pinned.sessionId !== session.id || pinned.config.termId !== term.id || pinned.config.levelId !== level.id || pinned.config.subjectId !== null && pinned.config.subjectId !== row.subjectId) return fail;
   const results = [];
   for (const enrollment of byId(enrollments)) {
    const selected = scores.filter(s => s.rosterId === row.id && s.enrollmentId === enrollment.id);
    const calculated = recalculateRelationalSubject(pinned.config, level.stage, selected);
    if (!calculated.ok) return fail;
    results.push({ enrollmentId: enrollment.id, studentId: enrollment.studentId, result: calculated.result });
   }
   subjectResults.push({ rosterId: row.id, subjectId: row.subjectId, configVersionId: row.configVersionId, students: results });
  }
  const manifest = document({ format: 'greenfield.assessment.source.v1', scope, school, klass, level, section, session, term,
   students: byId(students), enrollments: byId(enrollments), roster: byId(roster), catalog: byId(catalog),
   configs: [...configs].sort((a, b) => a.config.id < b.config.id ? -1 : a.config.id > b.config.id ? 1 : 0),
   scores: byId(scores).map(s => ({ ...s, numericScore: s.numericScore === null ? null : decimal(s.numericScore) })),
  });
  return { ok: true, materialized: { manifest, subjects: subjectResults.map(r => ({ rosterId: r.rosterId,
   results: document({ format: 'greenfield.assessment.results.v1', calculationPolicy: 'exact-rational-half-up-2dp.v1', scope, sourceHash: manifest.sha256, ...r }),
  })) } };
 } catch { return { ok: false, code: 'invalid_source' }; }
}
export type StoredAssessmentSource = { id: string; schoolId: string; scopeId: string; revision: number; sourceManifest: unknown; contentHash: string };
export type StoredAssessmentFinalization = { id: string; schoolId: string; scopeId: string; rosterId: string; sourceVersionId: string; teacherReviewId: string; finalizedBy: string; results: unknown; contentHash: string };
export type StoredAssessmentReview = { id: string; schoolId: string; scopeId: string; rosterId: string; sourceVersionId: string; reviewerMembershipId: string };
/** Content verification only. Caller must separately authenticate and lock current
 * admin/reviewer permissions. A matching SHA-256 is not a signature or authority.
 */
export function verifyAssessmentSourceContent(input: CompleteAssessmentSource, source: StoredAssessmentSource,
 finals: readonly StoredAssessmentFinalization[], reviews: readonly StoredAssessmentReview[],
): { ok: true; materialized: MaterializedAssessment } | { ok: false; code: 'invalid_source' | 'source_mismatch' | 'finalization_mismatch' } {
 const built = materializeAssessmentSource(input);
 if (!built.ok) return built;
 try {
  // No implicit JSON coercion or getter invocation in persisted documents/rows.
  canonicalizeSnapshotValue({ source, finals, reviews });
  const { materialized } = built;
  const scope = input.scope;
  if (!text(source.id) || source.schoolId !== scope.schoolId || source.scopeId !== scope.id || source.revision !== scope.revision || source.contentHash !== materialized.manifest.sha256 || canonicalizeSnapshotValue(source.sourceManifest) !== materialized.manifest.canonicalJson) return { ok: false, code: 'source_mismatch' };
  if (!unique(finals) || !unique(reviews) || finals.length !== materialized.subjects.length || reviews.length !== finals.length || new Set(finals.map(f => f.rosterId)).size !== finals.length) return { ok: false, code: 'finalization_mismatch' };
  for (const expected of materialized.subjects) {
   const stored = finals.find(f => f.rosterId === expected.rosterId);
   const review = reviews.find(r => r.id === stored?.teacherReviewId);
   if (!stored || !review || !text(stored.finalizedBy) || !text(review.reviewerMembershipId) || stored.finalizedBy === review.reviewerMembershipId || [stored, review].some(r => r.schoolId !== scope.schoolId || r.scopeId !== scope.id || r.rosterId !== expected.rosterId || r.sourceVersionId !== source.id) || stored.contentHash !== expected.results.sha256 || canonicalizeSnapshotValue(stored.results) !== expected.results.canonicalJson) return { ok: false, code: 'finalization_mismatch' };
  }
  return built;
 } catch { return { ok: false, code: 'source_mismatch' }; }
}
