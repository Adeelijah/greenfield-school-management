// Existing installed Drizzle metadata only; no env, configuration or connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as assembly from '../src/db/report-card-staging-schema.review.ts';
import * as base from '../src/db/schema.ts';
import * as proposal from '../src/db/report-cards-schema.proposal.ts';

const tables = Object.values(assembly).filter(value => value && typeof value === 'object');
const configs = tables.map(getTableConfig);
const byName = new Map(configs.map(config => [config.name, config]));
const draft = readFileSync(new URL('../docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql', import.meta.url), 'utf8');
const prerequisites = new Map([...draft.matchAll(/CREATE UNIQUE INDEX (\w+) ON public\.(\w+)\s*\(([^)]+)\)/g)].map(m => [m[1], { table: m[2], columns: m[3].split(',').map(s => s.trim()) }]));
const extraNames = ['terms_school_session_id_unique', 'teacher_class_assignments_school_id_id_unique', 'enrollments_report_binding_unique'];

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

test('extra prerequisite keys cover real columns and the report shadow target metadata exactly', () => {
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
});
