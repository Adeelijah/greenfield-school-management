import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assembleStagingReportReview } from './lib/report-card-staging-package-review.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const config = { mode: 'isolated-staging-review', schema: 'public', schoolId: '00000000-0000-0000-0000-000000000090', sourceCommit: 'a'.repeat(40), baseline: 'reconciled-semantic-0000' };
// Representative metadata statements for composer tests, not a complete migration.
const sources = () => ({ dependencies: read('docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql'), guards: read('docs/staging/REPORT_CARD_COORDINATED_GUARDS_REVIEW.sql'), proposalStatements: [
  'CREATE TABLE public."report_cards" (id uuid PRIMARY KEY)',
  'ALTER TABLE public."report_cards" ADD CONSTRAINT "example_student_fk" FOREIGN KEY ("id") REFERENCES public."students" ("id")',
] });

test('review composer orders dependencies, metadata, guards and final policy in one transaction', () => {
  const result = assembleStagingReportReview(config, sources());
  assert.deepEqual(result.phases.map(p => p.name), ['dependencies', 'proposal', 'guards', 'policy']);
  assert.equal([...result.sql.matchAll(/^BEGIN;$/gm)].length, 1);
  assert.equal([...result.sql.matchAll(/^COMMIT;$/gm)].length, 1);
  const revoke = result.sql.lastIndexOf('REVOKE ALL ON FUNCTION public.lock_report_card_actor(uuid)');
  assert.ok(result.sql.lastIndexOf('GRANT EXECUTE ON FUNCTION public.lock_report_card_actor(uuid)') > revoke);
  assert.ok(result.sql.lastIndexOf('WITH ADMIN FALSE') < result.sql.lastIndexOf('COMMIT;'));
  // Policy ALTER TABLE statements occur after guards. They are not proposal FKs.
  assert.ok(result.sql.lastIndexOf('ALTER TABLE public."report_card_') > result.sql.indexOf('-- Phase: policy'));
  for (const sql of [result.sql, result.sql.replaceAll('\n', '\r\n')]) {
    const fks = [...sql.matchAll(/^ALTER TABLE public\."[^"]+" ADD CONSTRAINT "[^"]+" FOREIGN KEY /gm)];
    assert.equal(fks.length, 1);
    assert.ok(fks[0].index > sql.indexOf('-- Phase: proposal'));
    assert.ok(fks[0].index < sql.indexOf('-- Phase: guards'));
    const misplaced = sql.replace('ALTER TABLE public."report_cards" ADD CONSTRAINT "example_student_fk" FOREIGN KEY ("id") REFERENCES public."students" ("id");', '');
    const late = misplaced + '\nALTER TABLE public."report_cards" ADD CONSTRAINT "example_student_fk" FOREIGN KEY ("id") REFERENCES public."students" ("id");';
    const lateFk = [...late.matchAll(/^ALTER TABLE public\."[^"]+" ADD CONSTRAINT "[^"]+" FOREIGN KEY /gm)][0];
    assert.ok(lateFk.index > late.indexOf('-- Phase: guards'));
  }
  assert.equal(result.status, 'review-only'); assert.equal(result.requiresAuthorizedIsolatedRehearsal, true);
});

test('manifest binds exact phase bytes, source revision and fixed school deterministically', () => {
  const a = assembleStagingReportReview(config, sources()), b = assembleStagingReportReview(config, sources());
  assert.deepEqual(a, b); assert.equal(a.sha256, createHash('sha256').update(a.sql).digest('hex'));
  assert.ok(Object.isFrozen(a)); assert.ok(Object.isFrozen(a.phases));
  const changed = sources(); changed.proposalStatements[0] += ' /* reviewed change */';
  assert.notEqual(assembleStagingReportReview(config, changed).sha256, a.sha256);
  assert.notEqual(assembleStagingReportReview({ ...config, schoolId: config.schoolId.replace(/90$/, '91') }, sources()).sha256, a.sha256);
});

test('line endings normalize while unknown baseline, fixture namespace and nested transactions reject', () => {
  const lf = sources(), crlf = sources();
  for (const key of ['dependencies', 'guards']) crlf[key] = crlf[key].replaceAll('\r\n', '\n').replaceAll('\n', '\r\n');
  assert.deepEqual(assembleStagingReportReview(config, lf), assembleStagingReportReview(config, crlf));
  assert.throws(() => assembleStagingReportReview({ ...config, baseline: 'unknown' }, lf));
  for (const change of [{ dependencies: 'BEGIN;\n' + lf.dependencies }, { guards: lf.guards + '\nROLLBACK;' },
    { proposalStatements: ['CREATE TABLE "rc_it_0123456789abcdef"."x" (id uuid)'] }, { guards: lf.guards.replace('COMMIT;', 'ROLLBACK;\nCOMMIT;') }]) {
    assert.throws(() => assembleStagingReportReview(config, { ...lf, ...change }));
  }
});

test('proposal emitter selects explicit staging metadata and has no fixture generator or execution dependency', () => {
  const source = read('scripts/lib/report-card-staging-proposal-review.mjs');
  assert.match(source, /report-card-staging-schema\.review\.ts/);
  assert.match(source, /tables.length !== 16/); assert.match(source, /enums.length !== 4/);
  assert.doesNotMatch(source, /assessmentFixtureDDL|assessment-disposable-schema|CREATE SCHEMA|process\.env|postgres\(|getDatabase|\.unsafe\(/);
});
