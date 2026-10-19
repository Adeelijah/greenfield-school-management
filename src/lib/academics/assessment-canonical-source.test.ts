import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { CompleteAssessmentSource, StoredAssessmentFinalization, StoredAssessmentReview, StoredAssessmentSource } from './assessment-canonical-source';
// @ts-expect-error Node type stripping requires explicit source extension.
import { materializeAssessmentSource, verifyAssessmentSourceContent } from './assessment-canonical-source.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
function fixture(): CompleteAssessmentSource {
 return {
  scope: { id: 'scope', schoolId: 'school', classId: 'class', sessionId: 'session', termId: 'term', revision: 4 }, school: { id: 'school', finalPrimaryYear: 5 },
  klass: { id: 'class', schoolId: 'school', levelId: 'level', sectionId: 'section' }, level: { id: 'level', schoolId: 'school', stage: 'primary', primaryYear: 5, isActive: true }, section: { id: 'section', schoolId: 'school', levelId: 'level', isActive: true },
  session: { id: 'session', schoolId: 'school', startsOn: '2026-09-01', endsOn: '2027-07-31', isCurrent: false }, term: { id: 'term', schoolId: 'school', sessionId: 'session', startsOn: '2026-09-01', endsOn: '2026-12-18', isCurrent: false },
  students: ['a', 'b'].map(id => ({ id, schoolId: 'school', status: 'active' })), enrollments: ['a', 'b'].map(id => ({ id: 'enroll-' + id, schoolId: 'school', studentId: id, classId: 'class', sessionId: 'session', status: 'active' })),
  roster: [{ id: 'roster', schoolId: 'school', scopeId: 'scope', subjectId: 'math', rosterVersion: 2, configVersionId: 'config', isActive: true }], catalog: [{ id: 'math', schoolId: 'school', code: 'MAT', name: 'Mathematics', version: 1, isActive: true }],
  configs: [{ sessionId: 'session', config: { id: 'config', schoolId: 'school', levelId: 'level', subjectId: 'math', termId: 'term', version: 3, status: 'finalized', components: [{ id: 'exam', label: 'Exam', category: 'exam', weight: 100, maximumScore: 100, required: true }], grading: { mode: 'numeric', bands: [{ min: 0, max: 70, label: 'B' }, { min: 70, max: 100, label: 'A' }] } } }],
  scores: ['a', 'b'].map((id, i) => ({ id: 'score-' + id, schoolId: 'school', rosterId: 'roster', configVersionId: 'config', enrollmentId: 'enroll-' + id, studentId: id, componentKey: 'exam', numericScore: i ? '69.9950' : '86.1250', observationKey: null, version: 2, updatedBy: 'teacher' })),
 };
}
function stored(input = fixture()) {
 const result = materializeAssessmentSource(input); assert.ok(result.ok);
 const { materialized } = result;
 const source: StoredAssessmentSource = { id: 'source', schoolId: 'school', scopeId: 'scope', revision: 4, sourceManifest: JSON.parse(materialized.manifest.canonicalJson), contentHash: materialized.manifest.sha256 };
 const finals: StoredAssessmentFinalization[] = materialized.subjects.map(s => ({ id: 'final-' + s.rosterId, schoolId: 'school', scopeId: 'scope', rosterId: s.rosterId, sourceVersionId: 'source', teacherReviewId: 'review-' + s.rosterId, finalizedBy: 'admin', results: JSON.parse(s.results.canonicalJson), contentHash: s.results.sha256 }));
 const reviews: StoredAssessmentReview[] = finals.map(f => ({ id: f.teacherReviewId, schoolId: f.schoolId, scopeId: f.scopeId, rosterId: f.rosterId, sourceVersionId: f.sourceVersionId, reviewerMembershipId: 'teacher' }));
 return { input, source, finals, reviews, materialized, verify: () => verifyAssessmentSourceContent(input, source, finals, reviews) };
}
test('complete scope materialization binds both students and independently recomputed results', () => {
 const f = stored(); assert.ok(f.verify().ok);
 const result = JSON.parse(f.materialized.subjects[0]!.results.canonicalJson);
 assert.deepEqual(result.students.map((s: { result: { total: string; grade: string } }) => s.result), [{ mode: 'numeric', total: '86.13', grade: 'A', remark: null }, { mode: 'numeric', total: '70.00', grade: 'A', remark: null }]);
 assert.equal(result.sourceHash, f.materialized.manifest.sha256);
 assert.equal(createHash('sha256').update(f.materialized.manifest.canonicalJson).digest('hex'), f.source.contentHash);
});
test('set ordering and object key order are stable without mutating inputs', () => {
 const f = fixture(); const before = structuredClone(f);
 const reversed = { ...f, students: [...f.students].reverse(), enrollments: [...f.enrollments].reverse(), scores: [...f.scores].reverse() };
 assert.deepEqual(materializeAssessmentSource(f), materializeAssessmentSource(reversed)); assert.deepEqual(f, before);
 // Compare key-order changes recursively without altering array order.
 const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, value]) => [k, reorder(value)])) : v;
 const g = stored(); g.source.sourceManifest = reorder(g.source.sourceManifest); g.finals[0]!.results = reorder(g.finals[0]!.results); assert.ok(g.verify().ok);
});
test('numeric database scale aliases normalize while observation strings retain meaning', () => {
 const a = fixture(); const b = fixture(); a.scores = [{ ...a.scores[0]!, numericScore: '86.12' }, a.scores[1]!]; b.scores = [{ ...b.scores[0]!, numericScore: '86.1200' }, b.scores[1]!];
 assert.deepEqual(materializeAssessmentSource(a), materializeAssessmentSource(b));
});
test('score ID, version, value, actor and config revision alter the manifest', () => {
 const base = stored().materialized.manifest.sha256;
 for (const patch of [{ id: 'replacement' }, { version: 3 }, { numericScore: '85.0000' }, { updatedBy: 'other-teacher' }]) {
  const f = fixture(); f.scores = [{ ...f.scores[0]!, ...patch }, f.scores[1]!]; const result = materializeAssessmentSource(f); assert.ok(result.ok); assert.notEqual(result.materialized.manifest.sha256, base);
 }
 const f = fixture(); f.configs[0]!.config.version++; const result = materializeAssessmentSource(f); assert.ok(result.ok); assert.notEqual(result.materialized.manifest.sha256, base);
});
test('stale or cross-school scope and changed placement cannot verify old source', () => {
 for (const mutate of [(f: CompleteAssessmentSource) => { f.scope.revision++; }, (f: CompleteAssessmentSource) => { f.term.endsOn = '2026-12-19'; }, (f: CompleteAssessmentSource) => { f.catalog = [{ ...f.catalog[0]!, name: 'New name' }]; }]) {
  const f = stored(); mutate(f.input); assert.deepEqual(f.verify(), { ok: false, code: 'source_mismatch' });
 }
 const f = fixture(); f.klass.schoolId = 'foreign'; assert.deepEqual(materializeAssessmentSource(f), { ok: false, code: 'invalid_source' });
});
test('missing scores for any student, wrong config and duplicate score identity reject', () => {
 for (const mutate of [(f: CompleteAssessmentSource) => { f.scores = f.scores.slice(0, 1); }, (f: CompleteAssessmentSource) => { f.scores = [...f.scores, f.scores[0]!]; }, (f: CompleteAssessmentSource) => { f.scores = [{ ...f.scores[0]!, configVersionId: 'foreign' }, f.scores[1]!]; }, (f: CompleteAssessmentSource) => { f.scores = [{ ...f.scores[0]!, studentId: 'b' }, f.scores[1]!]; }]) {
  const f = fixture(); mutate(f); assert.deepEqual(materializeAssessmentSource(f), { ok: false, code: 'invalid_source' });
 }
});
test('duplicate active enrollment across classes and extra or incomplete catalog/config reject', () => {
 const bad: CompleteAssessmentSource[] = [];
 const a = fixture(); a.enrollments = [...a.enrollments, { ...a.enrollments[0]!, id: 'conflicting', classId: 'other' }]; bad.push(a);
 const b = fixture(); b.catalog = []; bad.push(b);
 const c = fixture(); c.configs[0]!.sessionId = 'other'; bad.push(c);
 const d = fixture(); d.roster = [...d.roster, { ...d.roster[0]!, id: 'duplicate-subject' }]; bad.push(d);
 for (const f of bad) assert.deepEqual(materializeAssessmentSource(f), { ok: false, code: 'invalid_source' });
});
test('hash strings alone cannot authorize altered, missing or JSON-encoded source documents', () => {
 for (const patch of [{ sourceManifest: { fixture: true } }, { sourceManifest: JSON.stringify(stored().source.sourceManifest) }, { contentHash: '0'.repeat(64) }, { revision: 3 }, { scopeId: 'foreign' }]) {
  const f = stored(); Object.assign(f.source, patch); assert.deepEqual(f.verify(), { ok: false, code: 'source_mismatch' });
 }
});
test('forged results remain rejected even when attacker recomputes their own digest', () => {
 const f = stored(); const changed = JSON.parse(f.materialized.subjects[0]!.results.canonicalJson); changed.students[0].result.total = '100.00';
 f.finals[0]!.results = changed; f.finals[0]!.contentHash = createHash('sha256').update(canonicalizeSnapshotValue(changed)).digest('hex');
 assert.deepEqual(f.verify(), { ok: false, code: 'finalization_mismatch' });
});
test('finalization and exact review must cover each subject at this source with separate actors', () => {
 for (const patch of [{ sourceVersionId: 'other' }, { rosterId: 'other' }, { teacherReviewId: 'other' }, { finalizedBy: 'teacher' }]) {
  const f = stored(); Object.assign(f.finals[0]!, patch); assert.deepEqual(f.verify(), { ok: false, code: 'finalization_mismatch' });
 }
 const f = stored(); f.reviews.length = 0; assert.deepEqual(f.verify(), { ok: false, code: 'finalization_mismatch' });
 const g = stored(); g.finals.push(g.finals[0]!); assert.deepEqual(g.verify(), { ok: false, code: 'finalization_mismatch' });
});
test('early-years complete scope has textual observations without numeric totals', () => {
 const f = fixture(); f.level.stage = 'nursery'; f.level.primaryYear = null;
 f.configs[0]!.config.grading = { mode: 'observational', levels: [{ id: 'emerging', label: 'Emerging' }, { id: 'consistent', label: 'Consistent' }] };
 f.scores = f.scores.map(s => ({ ...s, numericScore: null, observationKey: 'consistent' }));
 const result = stored(f); assert.ok(result.verify().ok);
 const payload = JSON.parse(result.materialized.subjects[0]!.results.canonicalJson);
 assert.equal(payload.students[0].result.mode, 'observational'); assert.equal('total' in payload.students[0].result, false);
});
test('malformed canonical values and accessors fail without invoking getters', () => {
 const f = fixture(); let invoked = false; Object.defineProperty(f.scope, 'revision', { enumerable: true, get() { invoked = true; return 4; } });
 assert.deepEqual(materializeAssessmentSource(f), { ok: false, code: 'invalid_source' }); assert.equal(invoked, false);
 const array = fixture(); Object.defineProperty(array.scores, '0', { enumerable: true, get() { invoked = true; return {}; } });
 assert.deepEqual(materializeAssessmentSource(array), { ok: false, code: 'invalid_source' }); assert.equal(invoked, false);
 const g = stored(); g.source.sourceManifest = { unsupported: undefined }; assert.deepEqual(g.verify(), { ok: false, code: 'source_mismatch' });
 const h = fixture(); h.scope.revision = Infinity; assert.deepEqual(materializeAssessmentSource(h), { ok: false, code: 'invalid_source' });
});
test('multiple subjects can pin one default config but every finalized roster is required', () => {
 const input = fixture(); input.configs[0]!.config.subjectId = null;
 input.roster = [...input.roster, { ...input.roster[0]!, id: 'roster-science', subjectId: 'science' }];
 input.catalog = [...input.catalog, { ...input.catalog[0]!, id: 'science', code: 'SCI', name: 'Science' }];
 input.scores = [...input.scores, ...input.scores.map(s => ({ ...s, id: s.id + '-science', rosterId: 'roster-science' }))];
 const f = stored(input); assert.ok(f.verify().ok); assert.equal(f.materialized.subjects.length, 2);
 const reordered = { ...input, roster: [...input.roster].reverse(), catalog: [...input.catalog].reverse() };
 assert.deepEqual(materializeAssessmentSource(input), materializeAssessmentSource(reordered));
 f.finals.pop(); assert.deepEqual(f.verify(), { ok: false, code: 'finalization_mismatch' });
});
