import test from 'node:test';
import assert from 'node:assert/strict';
import type { AssessmentConfig } from './calendar-assessments';
// @ts-expect-error Node type stripping requires explicit source extension.
import { recalculateRelationalSubject } from './assessment-relational-recalculation.ts';
const config = (): AssessmentConfig => ({ id: 'config', schoolId: 'school', levelId: 'level', subjectId: 'math', termId: 'term', version: 1, status: 'finalized',
 components: [{ id: 'exam', label: 'Exam', category: 'exam', maximumScore: 100, weight: 100, required: true }],
 grading: { mode: 'numeric', bands: [{ min: 70, max: 100, label: 'A', remark: 'Excellent' }, { min: 0, max: 70, label: 'B' }] } });
const score = (numericScore: string, componentKey = 'exam') => ({ componentKey, numericScore, observationKey: null, version: 1 });
test('recomputes exact decimal total and sorts bands without changing input', () => {
 const c = config(); const before = structuredClone(c);
 assert.deepEqual(recalculateRelationalSubject(c, 'primary', [score('86.1250')]), { ok: true, result: { mode: 'numeric', total: '86.13', grade: 'A', remark: 'Excellent' } });
 assert.deepEqual(c, before);
});
test('rounds once half-up before selecting lower-inclusive grade boundaries', () => {
 for (const [raw, total, grade] of [['69.9949', '69.99', 'B'], ['69.9950', '70.00', 'A'], ['0', '0.00', 'B'], ['100.0000', '100.00', 'A']]) {
  const result = recalculateRelationalSubject(config(), 'primary', [score(raw!)]); assert.ok(result.ok);
  assert.deepEqual(result.result, { mode: 'numeric', total, grade, remark: grade === 'A' ? 'Excellent' : null });
 }
});
test('sums repeating rational contributions before rounding rather than each component', () => {
 const c = config(); c.components = ['a', 'b'].map(id => ({ id, label: id, category: 'ca', maximumScore: 3, weight: 50, required: true }));
 const result = recalculateRelationalSubject(c, 'primary', ['a', 'b'].map(id => score('1', id)));
 assert.ok(result.ok); assert.equal(result.result.mode === 'numeric' && result.result.total, '33.33');
});
test('optional absence contributes zero without redistributing weight', () => {
 const c = config(); c.components = [{ ...c.components[0]!, weight: 60 }, { ...c.components[0]!, id: 'optional', weight: 40, required: false }];
 const result = recalculateRelationalSubject(c, 'primary', [score('100')]); assert.ok(result.ok);
 assert.equal(result.result.mode === 'numeric' && result.result.total, '60.00');
});
test('rejects missing, duplicate, unknown, malformed, excess and unversioned scores', () => {
 for (const scores of [[], [score('2'), score('3')], [score('2', 'foreign')], [score('1e2')], [score('100.0001')], [{ ...score('2'), version: 0 }], [{ ...score('2'), observationKey: 'emerging' }]]) {
  assert.deepEqual(recalculateRelationalSubject(config(), 'primary', scores), { ok: false, code: 'invalid_scores' });
 }
});
test('rejects draft, wrong stage, inexact weights and unsupported band precision', () => {
 const draft = config(); draft.status = 'draft';
 const weight = config(); weight.components = [{ ...weight.components[0]!, weight: 99.9999 }];
 const bands = config(); bands.grading = { mode: 'numeric', bands: [{ min: 0, max: 0.00001, label: 'B' }, { min: 0.00001, max: 100, label: 'A' }] };
 for (const c of [draft, weight, bands]) assert.deepEqual(recalculateRelationalSubject(c, 'primary', [score('2')]), { ok: false, code: 'invalid_config' });
 assert.deepEqual(recalculateRelationalSubject(config(), 'creche', [score('2')]), { ok: false, code: 'invalid_config' });
});
test('early-years keys retain text meaning and never become a numeric total', () => {
 const c = config(); c.grading = { mode: 'observational', levels: [{ id: 'emerging', label: 'Emerging' }, { id: 'consistent', label: 'Consistent', remark: 'Independent' }] };
 for (const stage of ['creche', 'nursery'] as const) {
  assert.deepEqual(recalculateRelationalSubject(c, stage, [{ componentKey: 'exam', numericScore: null, observationKey: 'consistent', version: 2 }]), { ok: true, result: { mode: 'observational', observations: [{ componentKey: 'exam', key: 'consistent', label: 'Consistent', remark: 'Independent' }] } });
  assert.deepEqual(recalculateRelationalSubject(c, stage, [{ componentKey: 'exam', numericScore: null, observationKey: '1', version: 2 }]), { ok: false, code: 'invalid_scores' });
 }
});
test('score row order does not alter weighted results', () => {
 const c = config(); c.components = [{ ...c.components[0]!, weight: 37.5 }, { ...c.components[0]!, id: 'ca', maximumScore: 40, weight: 62.5 }];
 const scores = [score('73.1234'), score('31.7777', 'ca')];
 assert.deepEqual(recalculateRelationalSubject(c, 'primary', scores), recalculateRelationalSubject(c, 'primary', [...scores].reverse()));
});
