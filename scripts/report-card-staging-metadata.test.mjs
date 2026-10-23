// Existing installed Drizzle metadata only; no env, configuration or connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as assembly from '../src/db/report-card-staging-schema.review.ts';
import * as base from '../src/db/schema.ts';
import * as proposal from '../src/db/report-cards-schema.proposal.ts';
import { assessmentFixtureDDL } from './lib/assessment-disposable-schema.mjs';
import { reportUpgradeProposalPlan, upgradeProposalTables } from './lib/report-card-upgrade-plan.mjs';
import { stagingReportProposalStatements } from './lib/report-card-staging-proposal-review.mjs';
import { buildStagingReportInstallationReview } from './lib/report-card-staging-installation-review.mjs';

const tables = Object.values(assembly).filter(value => value && typeof value === 'object');
const configs = tables.map(getTableConfig);
const byName = new Map(configs.map(config => [config.name, config]));
const draft = readFileSync(new URL('../docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql', import.meta.url), 'utf8');
const prerequisites = new Map([...draft.matchAll(/CREATE UNIQUE INDEX (\w+) ON public\.(\w+)\s*\(([^)]+)\)/g)].map(m => [m[1], { table: m[2], columns: m[3].split(',').map(s => s.trim()) }]));
const extraNames = ['terms_school_session_id_unique', 'teacher_class_assignments_school_id_id_unique', 'enrollments_report_binding_unique'];

test('independent public proposal emitter preserves every selected metadata statement', () => {
  const schema = 'rc_it_0123456789abcdef';
  const expected = reportUpgradeProposalPlan(schema, assessmentFixtureDDL(schema, { includeReports: true }).statements)
    .map(s => s.replaceAll('"' + schema + '".', 'public.')).sort();
  const actual = stagingReportProposalStatements();
  assert.deepEqual([...actual].sort(), expected);
  assert.ok(Object.isFrozen(actual));
  assert.equal(actual.filter(s => s.startsWith('CREATE TABLE ')).length, 16);
  assert.equal(actual.filter(s => s.startsWith('CREATE TYPE ')).length, 4);
});

test('actual review composition creates only the selected additive relations before guards and policy', () => {
  const result = buildStagingReportInstallationReview({ mode: 'isolated-staging-review', schema: 'public', schoolId: '00000000-0000-0000-0000-000000000090', sourceCommit: 'a'.repeat(40), baseline: 'reconciled-semantic-0000' });
  const created = [...result.sql.matchAll(/CREATE TABLE (?:public|"public")\."?(\w+)"?/g)].map(m => m[1]);
  assert.equal(created.length, 21); assert.equal(new Set(created).size, 21);
  assert.ok(created.includes('assessment_source_write_gate')); assert.ok(created.includes('assessment_source_write_claims'));
  for (const name of ['schools', 'school_users', 'memberships', 'students', 'enrollments', 'admissions', 'guardians']) assert.equal(created.includes(name), false);
  const lastProposalFk = result.sql.lastIndexOf('ALTER TABLE public."report_card_');
  assert.ok(lastProposalFk < result.sql.indexOf('-- Phase: guards'));
  assert.ok(result.sql.indexOf('-- Phase: guards') < result.sql.indexOf('-- Phase: policy'));
});

test('actual assembly exposes 27 distinct real tables and eight used enum definitions', () => {
  assert.equal(tables.length, 27); assert.equal(byName.size, 27);
  const enums = Object.values(assembly).filter(value => typeof value === 'function' && typeof value.enumName === 'string');
  assert.equal(enums.length, 8);
  const enumNames = new Set(enums.map(value => value.enumName));
  for (const config of configs) for (const column of config.columns) {
    if (column.enumValues) assert.ok(enumNames.has(column.getSQLType()), config.name + '.' + column.name);
  }
});

test('term and enrollment exports reuse existing relations and omit both proposal shadows', () => {
  assert.equal(assembly.terms, base.terms); assert.equal(assembly.enrollments, base.enrollments);
  assert.notEqual(assembly.terms, proposal.proposedTermsCompositeTarget);
  assert.notEqual(assembly.enrollments, proposal.proposedEnrollmentCompositeTarget);
  assert.equal(Object.hasOwn(assembly, 'proposedTermsCompositeTarget'), false);
  assert.equal(Object.hasOwn(assembly, 'proposedEnrollmentCompositeTarget'), false);
});

test('every actual FK closes over selected tables and has an exact nonpartial unique target or reviewed prerequisite', () => {
  for (const config of configs) for (const fk of config.foreignKeys) {
    const ref = fk.reference(); const targetName = getTableConfig(ref.foreignTable).name;
    const target = byName.get(targetName); assert.ok(target, fk.getName() + ' external target');
    const columns = ref.foreignColumns.map(c => c.name);
    const keys = [
      ...target.columns.filter(c => c.primary || c.isUnique).map(c => [c.name]),
      ...target.primaryKeys.map(k => k.columns.map(c => c.name)),
      ...target.uniqueConstraints.map(k => k.columns.map(c => c.name)),
      ...target.indexes.filter(i => i.config.unique && !i.config.where).map(i => i.config.columns.map(c => c.name)),
      ...extraNames.map(name => prerequisites.get(name)).filter(p => p && p.table === targetName).map(p => p.columns),
    ];
    assert.ok(keys.some(key => JSON.stringify(key) === JSON.stringify(columns)), fk.getName() + ' missing exact unique target ' + columns);
  }
});

test('dependency keys and school FK names match actual and shadow metadata exactly', () => {
  for (const name of extraNames) {
    const target = prerequisites.get(name); assert.ok(target, name);
    const config = byName.get(target.table); assert.ok(config);
    for (const column of target.columns) assert.ok(config.columns.some(c => c.name === column), name + '.' + column);
  }
  for (const shadow of [proposal.proposedTermsCompositeTarget, proposal.proposedEnrollmentCompositeTarget]) {
    for (const index of getTableConfig(shadow).indexes) {
      const target = prerequisites.get(index.config.name); assert.ok(target);
      assert.deepEqual(index.config.columns.map(c => c.name), target.columns);
    }
  }
  for (const table of [base.academicLevels, base.academicSections, base.teacherClassAssignments]) {
    const config = getTableConfig(table);
    const fk = config.foreignKeys.find(key => key.reference().foreignTable === base.schools);
    assert.ok(fk, config.name);
    const statement = draft.split(';').find(s => s.includes('CREATE TABLE public.' + config.name + ' ('));
    assert.ok(statement.includes('CONSTRAINT ' + fk.getName() + ' REFERENCES public.schools(id) ON DELETE RESTRICT'), fk.getName());
  }
});

test('actual proposal upgrade selects only 16 new tables and four enums before cyclic FKs', () => {
  const schema = 'rc_it_0123456789abcdef';
  const selected = reportUpgradeProposalPlan(schema, assessmentFixtureDDL(schema, { includeReports: true }).statements);
  const names = selected.filter(s => s.startsWith('CREATE TABLE ')).map(s => /^CREATE TABLE "\w+"\."(\w+)"/.exec(s)[1]);
  assert.deepEqual([...names].sort(), [...upgradeProposalTables].sort());
  assert.equal(selected.filter(s => s.startsWith('CREATE TYPE ')).length, 4);
  const lastTable = selected.reduce((n, s, i) => s.startsWith('CREATE TABLE ') ? i : n, -1);
  assert.ok(selected.findIndex(s => s.startsWith('ALTER TABLE ')) > lastTable);
  assert.equal(selected.some(s => /CREATE SCHEMA|CREATE TABLE.*"terms"|CREATE TABLE.*"enrollments"/.test(s)), false);
});

test('actual proposal upgrade retains every metadata index and FK without adding base constraints', () => {
  const schema = 'rc_it_0123456789abcdef';
  const selected = reportUpgradeProposalPlan(schema, assessmentFixtureDDL(schema, { includeReports: true }).statements);
  for (const config of configs.filter(c => upgradeProposalTables.includes(c.name))) {
    const table = '"' + schema + '"."' + config.name + '"';
    const indexes = selected.filter(s => /^CREATE (UNIQUE )?INDEX /.test(s) && s.includes(' ON ' + table + ' '));
    const fks = selected.filter(s => s.startsWith('ALTER TABLE ' + table + ' ADD CONSTRAINT '));
    assert.equal(indexes.length, config.indexes.length, config.name + ' indexes');
    assert.equal(fks.length, config.foreignKeys.length, config.name + ' FKs');
  }
});
