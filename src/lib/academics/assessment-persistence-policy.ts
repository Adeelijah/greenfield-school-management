// Offline review-stage policies only. Never authenticates or executes a write.
import type { AssessmentConfig, TeacherAssignment } from './calendar-assessments';
import type { VerifiedAcademicActor } from './assignments';
// @ts-expect-error Node type stripping requires explicit source extension.
import { validateAssessmentConfig } from './calendar-assessments.ts';

/** Exact, bounded decimal representation compatible with proposed numeric(12,4).
 * No whitespace, exponent, sign, leading-zero aliases, NaN or Infinity.
 */
const decimalUnits = (value: string): bigint | null => {
  if (!/^(0|[1-9]\d{0,7})(?:\.(\d{1,4}))?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * BigInt(10000) + BigInt(fraction.padEnd(4, '0'));
};
export function validateConfigForPersistence(config: AssessmentConfig, stage: 'creche' | 'nursery' | 'primary'): boolean {
  try {
    if (!['creche', 'nursery', 'primary'].includes(stage) || !config?.id?.trim() || !Number.isSafeInteger(config.version) || config.version < 1 || !['draft', 'finalized'].includes(config.status) || !validateAssessmentConfig(config)) return false;
    if ((stage === 'primary') !== (config.grading.mode === 'numeric')) return false;
    if (config.components.some(c => !c.id.trim() || !['ca', 'exam', 'other'].includes(c.category) || typeof c.required !== 'boolean' || decimalUnits(String(c.maximumScore)) === null || decimalUnits(String(c.weight)) === null)) return false;
    if (config.components.reduce((sum, c) => sum + decimalUnits(String(c.weight))!, BigInt(0)) !== BigInt(1000000)) return false;
    if (config.grading.mode === 'observational' && config.grading.levels.some(l => !l.id.trim() || !l.label.trim())) return false;
    return true;
  } catch { return false; }
}
export type PersistedScoreValue = { numericScore: string | null; observationKey: string | null };
/** Preserves numeric text and arbitrary observational keys. Does not coerce text
 * rubric IDs into the legacy number-based engine. Trusted joins remain required.
 */
export function validatePersistedScore(config: AssessmentConfig, stage: 'creche' | 'nursery' | 'primary', componentKey: string, value: PersistedScoreValue): boolean {
  if (!validateConfigForPersistence(config, stage) || config.status !== 'finalized') return false;
  const component = config.components.find(c => c.id === componentKey);
  if (!component || !value) return false;
  if (config.grading.mode === 'observational') return value.numericScore === null && typeof value.observationKey === 'string' && config.grading.levels.some(l => l.id === value.observationKey);
  if (value.observationKey !== null || typeof value.numericScore !== 'string') return false;
  const score = decimalUnits(value.numericScore);
  const maximum = decimalUnits(String(component.maximumScore));
  return score !== null && maximum !== null && score <= maximum;
}

export type AssessmentSourceScope = { id: string; schoolId: string; classId: string; sessionId: string; termId: string; revision: number };
export type AssessmentSourceOperation = 'score_change' | 'roster_change' | 'enrollment_change' | 'config_change' | 'teacher_review' | 'finalize';
export type AssessmentRevisionIntent = { kind: AssessmentSourceOperation; subjectId?: string; expected: readonly { scopeId: string; revision: number }[] };
export type AssessmentRevisionPlan = { ok: true; changesSource: boolean; locks: readonly { scopeId: string; schoolId: string; classId: string; sessionId: string; termId: string; beforeRevision: number; afterRevision: number }[] }
 | { ok: false; code: 'invalid' | 'forbidden' | 'school_mismatch' | 'scope_mismatch' | 'stale_revision' | 'missing_source_version' };
/** affectedScopes and assignments MUST be the complete server-resolved sets in
 * one transaction. This planner cannot detect scopes omitted by a faulty loader.
 * It supplies a candidate lock plan, never proof that locks/grants exist.
 */
export function planAssessmentSourceRevision(
  actor: VerifiedAcademicActor, intent: AssessmentRevisionIntent,
  affectedScopes: readonly AssessmentSourceScope[], assignments: readonly TeacherAssignment[],
  sourceVersions: readonly { scopeId: string; revision: number }[],
): AssessmentRevisionPlan {
  if (!actor?.id || !actor.schoolId || actor.status !== 'active' || !['admin', 'teacher'].includes(actor.role)) return { ok: false, code: 'forbidden' };
  if (!intent || !['score_change', 'roster_change', 'enrollment_change', 'config_change', 'teacher_review', 'finalize'].includes(intent.kind) || !Array.isArray(affectedScopes) || !affectedScopes.length || !Array.isArray(intent.expected) || !Array.isArray(assignments) || !Array.isArray(sourceVersions)) return { ok: false, code: 'invalid' };
  if (affectedScopes.some(s => s.schoolId !== actor.schoolId) || assignments.some(a => a.schoolId !== actor.schoolId)) return { ok: false, code: 'school_mismatch' };
  const validRevision = (revision: number) => Number.isSafeInteger(revision) && revision > 0;
  const identities = affectedScopes.map(s => JSON.stringify([s.schoolId, s.classId, s.sessionId, s.termId]));
  if (affectedScopes.some(s => !s.id?.trim() || !s.classId?.trim() || !s.sessionId?.trim() || !s.termId?.trim() || !validRevision(s.revision)) || new Set(affectedScopes.map(s => s.id)).size !== affectedScopes.length || new Set(identities).size !== identities.length || intent.expected.some(e => !e.scopeId?.trim() || !validRevision(e.revision))) return { ok: false, code: 'invalid' };
  if (intent.expected.length !== affectedScopes.length || new Set(intent.expected.map(e => e.scopeId)).size !== intent.expected.length || intent.expected.some(e => !affectedScopes.some(s => s.id === e.scopeId))) return { ok: false, code: 'scope_mismatch' };
  if (affectedScopes.some(s => intent.expected.find(e => e.scopeId === s.id)!.revision !== s.revision)) return { ok: false, code: 'stale_revision' };
  const subjectOperation = ['score_change', 'teacher_review', 'finalize'].includes(intent.kind);
  if (subjectOperation && !intent.subjectId?.trim()) return { ok: false, code: 'invalid' };
  if (actor.role === 'teacher' && (!['score_change', 'teacher_review'].includes(intent.kind) || affectedScopes.some(s => assignments.filter(a => a.membershipId === actor.id && a.classId === s.classId && a.sessionId === s.sessionId && a.status === 'active' && a.subjectIds.includes(intent.subjectId!)).length !== 1))) return { ok: false, code: 'forbidden' };
  if (intent.kind === 'teacher_review' && actor.role !== 'teacher') return { ok: false, code: 'forbidden' };
  const changesSource = !['teacher_review', 'finalize'].includes(intent.kind);
  if (!changesSource && affectedScopes.some(s => sourceVersions.filter(v => v.scopeId === s.id && v.revision === s.revision).length !== 1)) return { ok: false, code: 'missing_source_version' };
  if (changesSource && affectedScopes.some(s => s.revision === Number.MAX_SAFE_INTEGER)) return { ok: false, code: 'invalid' };
  const key = (s: AssessmentSourceScope) => JSON.stringify([s.schoolId, s.classId, s.sessionId, s.termId, s.id]);
  const sorted = [...affectedScopes].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  return { ok: true, changesSource, locks: sorted.map(s => ({ scopeId: s.id, schoolId: s.schoolId, classId: s.classId, sessionId: s.sessionId, termId: s.termId, beforeRevision: s.revision, afterRevision: s.revision + (changesSource ? 1 : 0) })) };
}
