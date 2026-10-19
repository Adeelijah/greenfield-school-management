// Pure review-stage calculation policy. Does not authenticate, read or publish.
import type { AssessmentConfig } from './calendar-assessments';
import type { RelationalSubjectSource } from './assessment-postgres-fixture-source-reader';
// @ts-expect-error Node type stripping requires explicit source extension.
import { validateConfigForPersistence, validatePersistedScore } from './assessment-persistence-policy.ts';

type Stage = 'creche' | 'nursery' | 'primary';
export type RecalculatedResult =
 | { mode: 'numeric'; total: string; grade: string; remark: string | null }
 | { mode: 'observational'; observations: readonly { componentKey: string; key: string; label: string; remark: string | null }[] };
export type RecalculationOutcome = { ok: true; result: RecalculatedResult }
 | { ok: false; code: 'invalid_config' | 'invalid_scores' };
const zero = BigInt(0);
const units = (value: string): bigint => {
 if (!/^(0|[1-9]\d{0,7})(?:\.\d{1,4})?$/.test(value)) throw Error('Invalid decimal');
 const [whole, fraction = ''] = value.split('.');
 return BigInt(whole!) * BigInt(10000) + BigInt(fraction.padEnd(4, '0'));
};
const gcd = (a: bigint, b: bigint): bigint => {
 while (b !== zero) { const remainder = a % b; a = b; b = remainder; }
 return a;
};
/** Uses validated relational scores, never stored totals/grades. Missing optional
 * components contribute zero with their configured weight retained. Exact rational
 * contributions are summed before one half-up rounding to two decimal places.
 * Grade bands use that rounded total, lower inclusive / upper exclusive, with
 * 100 included in the last band. This policy is versioned in documentation;
 * it does not replace the legacy number-based engine or prove source provenance.
 */
export function recalculateRelationalSubject(
 config: AssessmentConfig, stage: Stage, scores: RelationalSubjectSource['scores'],
): RecalculationOutcome {
 try {
  if (!validateConfigForPersistence(config, stage) || config.status !== 'finalized') return { ok: false, code: 'invalid_config' };
  if (config.grading.mode === 'numeric' && config.grading.bands.some(b => {
   try { units(String(b.min)); units(String(b.max)); return false; } catch { return true; }
  })) return { ok: false, code: 'invalid_config' };
  if (!Array.isArray(scores) || new Set(scores.map(s => s.componentKey)).size !== scores.length
   || scores.some(s => !Number.isSafeInteger(s.version) || s.version < 1 || !validatePersistedScore(config, stage, s.componentKey, s))
   || config.components.some(c => c.required && !scores.some(s => s.componentKey === c.id))) return { ok: false, code: 'invalid_scores' };
  if (config.grading.mode === 'observational') {
   const levels = config.grading.levels;
   return { ok: true, result: { mode: 'observational', observations: config.components.flatMap(c => {
    const score = scores.find(s => s.componentKey === c.id);
    if (!score) return [];
    const level = levels.find(l => l.id === score.observationKey)!;
    return [{ componentKey: c.id, key: level.id, label: level.label, remark: level.remark ?? null }];
   }) } };
  }
  let numerator = zero; let denominator = BigInt(1);
  for (const component of config.components) {
   const score = scores.find(s => s.componentKey === component.id);
   if (!score) continue;
   // score/max * weight; each input is scaled to 10,000 units.
   const n = units(score.numericScore!) * units(String(component.weight));
   const d = units(String(component.maximumScore)) * BigInt(10000);
   numerator = numerator * d + n * denominator;
   denominator *= d;
   const divisor = gcd(numerator, denominator);
   numerator /= divisor; denominator /= divisor;
  }
  const cents = (numerator * BigInt(200) + denominator) / (denominator * BigInt(2));
  const total = String(cents / BigInt(100)) + '.' + String(cents % BigInt(100)).padStart(2, '0');
  const bands = [...config.grading.bands].sort((a, b) => a.min - b.min);
  const scaled = cents * BigInt(100);
  const band = bands.find((b, i) => scaled >= units(String(b.min)) && (scaled < units(String(b.max)) || i === bands.length - 1 && scaled === units(String(b.max))));
  if (!band) return { ok: false, code: 'invalid_config' };
  return { ok: true, result: { mode: 'numeric', total, grade: band.label, remark: band.remark ?? null } };
 } catch { return { ok: false, code: 'invalid_scores' }; }
}
