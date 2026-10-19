// Offline only: metadata/source imports, no postgres client, environment or SQL execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentFixtureDDL, fixtureTables } from './lib/assessment-disposable-schema.mjs';
import * as proposal from '../src/db/academic-assessments-schema.proposal.ts';
import { getTableConfig } from 'drizzle-orm/pg-core';
const schema = 'rc_it_0123456789abcdef';
test('fixture DDL stays fully isolated and includes all eleven proposal relations', () => {
 const result = assessmentFixtureDDL(schema);
 for (const value of Object.values(proposal).filter(v => v && typeof v === 'object')) assert.ok(fixtureTables.includes(value), 'proposal table omitted from fixture');
 assert.equal(result.proposalTableCount, 11); assert.equal(result.tableCount, 22);
 assert.equal(result.statements.filter(s => s.startsWith('CREATE TABLE')).length, fixtureTables.length);
 for (const statement of result.statements) {
  assert.ok(statement.includes('"' + schema + '".' ) || statement === 'CREATE SCHEMA "' + schema + '"');
  assert.equal(statement.includes('public.'), false);
 }
 assert.throws(() => assessmentFixtureDDL('public'));
});
test('all source checks, indexes and foreign keys are carried into fixture DDL', () => {
 const result = assessmentFixtureDDL(schema);
 const joined = result.statements.join('\n');
 for (const table of fixtureTables) {
  const c = getTableConfig(table);
  for (const column of c.columns.filter(col => col.isUnique)) assert.ok(joined.includes('CONSTRAINT "' + column.uniqueName + '" UNIQUE'), column.name);
  for (const check of c.checks) assert.ok(joined.includes('CONSTRAINT "' + check.name + '" CHECK'), check.name);
  for (const index of c.indexes) assert.ok(joined.includes('INDEX "' + index.config.name + '"'), index.config.name);
  for (const fk of c.foreignKeys) assert.ok(joined.includes('CONSTRAINT "' + fk.getName() + '" FOREIGN KEY'), fk.getName());
 }
});
test('prerequisite targets precede foreign keys and every FK target is in the fixture schema', () => {
 const { statements } = assessmentFixtureDDL(schema);
 const firstFk = statements.findIndex(s => s.includes(' ADD CONSTRAINT '));
 for (const name of ['terms_school_session_id_unique', 'teacher_class_assignments_school_id_id_unique']) assert.ok(statements.findIndex(s => s.includes('INDEX ' + name)) < firstFk);
 for (const statement of statements.filter(s => s.includes(' FOREIGN KEY '))) assert.ok(statement.includes('REFERENCES "' + schema + '".'));
});
test('optional report fixture adds five actual report relations without duplicate shadows', () => {
 const result = assessmentFixtureDDL(schema, { includeReports: true });
 assert.equal(result.tableCount, 27); assert.equal(result.reportTableCount, 5);
 assert.equal(result.statements.filter(s => s.startsWith('CREATE TABLE')).length, 27);
 assert.equal(result.statements.filter(s => s.startsWith('CREATE TABLE') && s.includes('."enrollments" (')).length, 1);
 assert.equal(result.statements.filter(s => s.startsWith('CREATE TABLE') && s.includes('."terms" (')).length, 1);
});
test('extended fixture includes report enum types and exact enrollment prerequisite before FKs', () => {
 const { statements } = assessmentFixtureDDL(schema, { includeReports: true });
 for (const name of ['report_card_stage', 'report_card_action']) assert.ok(statements.some(s => s.startsWith('CREATE TYPE') && s.includes('."' + name + '"')));
 const index = statements.findIndex(s => s.includes('INDEX enrollments_report_binding_unique'));
 assert.ok(index > 0 && index < statements.findIndex(s => s.includes(' ADD CONSTRAINT ')));
 for (const fk of ['report_cards_enrollment_binding_fk', 'report_cards_assessment_source_fk', 'report_releases_exact_snapshot_fk']) assert.ok(statements.some(s => s.includes('CONSTRAINT "' + fk + '" FOREIGN KEY')));
});
test('extended report fixture keeps every new statement isolated and rejects invalid options', () => {
 for (const statement of assessmentFixtureDDL(schema, { includeReports: true }).statements) assert.ok(statement.includes('"' + schema + '".') || statement === 'CREATE SCHEMA "' + schema + '"');
 assert.throws(() => assessmentFixtureDDL(schema, { includeReports: 'yes' }));
});
