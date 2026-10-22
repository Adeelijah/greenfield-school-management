import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reportUpgradeSourcePlan, reportUpgradeProposalPlan, upgradeFixtureSchema, upgradeProposalTables } from './lib/report-card-upgrade-plan.mjs';
const schema = 'rc_it_0123456789abcdef';
const root = new URL('../', import.meta.url);
const baseline = readFileSync(new URL('drizzle/0000_broad_slayback.sql', root), 'utf8');
const dependencies = readFileSync(new URL('docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql', root), 'utf8');
const fakeProposal = () => [
  ...['assessment_config_state', 'assessment_mode', 'report_card_stage', 'report_card_action'].map(n => `CREATE TYPE "${schema}"."${n}" AS ENUM ('draft')`),
  ...upgradeProposalTables.map(n => `CREATE TABLE "${schema}"."${n}" (id uuid PRIMARY KEY)`),
  `ALTER TABLE "${schema}"."report_card_audit" ADD CONSTRAINT "cycle" FOREIGN KEY (id) REFERENCES "${schema}"."report_card_releases" (id)`,
];
test('rejects arbitrary identifiers and absent SQL before constructing a plan', () => {
  for (const name of ['public', 'rc_it_wrong', schema + ';DROP', null]) assert.throws(() => upgradeFixtureSchema(name));
  assert.throws(() => reportUpgradeSourcePlan(schema, '', dependencies));
  assert.throws(() => reportUpgradeSourcePlan(schema, baseline, ''));
});
test('real baseline definitions are adapted to one namespace with indexes before FKs', () => {
  const plan = reportUpgradeSourcePlan(schema, baseline, dependencies);
  assert.equal(plan.baselineTables.length, 12); assert.equal(plan.upgradedTables.length, 31);
  const statements = plan.baselineStatements;
  const firstFK = statements.findIndex(s => s.startsWith('ALTER TABLE'));
  const lastIndex = statements.reduce((n, s, i) => /^CREATE (UNIQUE )?INDEX/.test(s) ? i : n, -1);
  assert.ok(firstFK > lastIndex);
  assert.equal(statements.filter(s => /FOREIGN KEY/.test(s)).length, 20);
  assert.ok(statements.some(s => s.includes(`"role" "${schema}"."school_role"`)));
  assert.ok(statements.every(s => !s.includes('"public".')));
});
test('LF and CRLF drafts produce the same bounded dependency plan', () => {
  const a = reportUpgradeSourcePlan(schema, baseline, dependencies);
  const b = reportUpgradeSourcePlan(schema, baseline.replaceAll('\n', '\r\n'), dependencies.replaceAll('\n', '\r\n'));
  assert.deepEqual(a, b);
  assert.equal(a.dependencyStatements.filter(s => s.startsWith('CREATE TABLE')).length, 3);
  assert.ok(a.dependencyStatements.every(s => !/\bpublic\./.test(s)));
});
test('rejects changed baseline table surface, executable forms and malformed quoting', () => {
  for (const source of [baseline.replace('CREATE TABLE "students"', 'CREATE TABLE "unknown"'), baseline + ';DROP SCHEMA public', baseline + ";SELECT 'broken", baseline + ';DO $$ BEGIN END $$']) assert.throws(() => reportUpgradeSourcePlan(schema, source, dependencies));
  assert.throws(() => reportUpgradeSourcePlan(schema, baseline, dependencies + ';UPDATE public.schools SET name=name'));
});
test('rejects external baseline and dependency references instead of leaving a public write path', () => {
  assert.throws(() => reportUpgradeSourcePlan(schema, baseline.replace('REFERENCES "public"."schools"', 'REFERENCES "other"."schools"'), dependencies));
  assert.throws(() => reportUpgradeSourcePlan(schema, baseline, dependencies.replace('REFERENCES public.schools', 'REFERENCES other.schools')));
});
test('proposal selection omits base table/index/schema recreation and retains forward FK references', () => {
  const emitted = [`CREATE SCHEMA "${schema}"`, `CREATE TABLE "${schema}"."schools" (id uuid)`, `CREATE UNIQUE INDEX "base" ON "${schema}"."terms" (id)`, ...fakeProposal()];
  const selected = reportUpgradeProposalPlan(schema, emitted);
  assert.equal(selected.length, 21);
  assert.equal(selected.some(s => /CREATE TABLE.*"schools"/.test(s)), false);
  assert.match(selected.at(-1), /REFERENCES.*report_card_releases/);
});
test('missing or duplicated proposed tables/enums and early cycle FKs fail closed', () => {
  const all = fakeProposal();
  for (const emitted of [all.slice(1), [...all, all[4]], [all.at(-1), ...all.slice(0, -1)], []]) assert.throws(() => reportUpgradeProposalPlan(schema, emitted));
});
test('proposal namespaces cannot reach public or another generated fixture', () => {
  const all = fakeProposal();
  assert.throws(() => reportUpgradeProposalPlan(schema, [...all.slice(0, -1), all.at(-1).replace(`REFERENCES "${schema}"`, 'REFERENCES "public"')]));
  assert.throws(() => reportUpgradeProposalPlan(schema, [...all.slice(0, -1), all.at(-1).replace(`REFERENCES "${schema}"`, 'REFERENCES "rc_it_ffffffffffffffff"')]));
});
