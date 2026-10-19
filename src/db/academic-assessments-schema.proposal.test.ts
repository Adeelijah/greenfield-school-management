import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getTableConfig } from 'drizzle-orm/pg-core';
// @ts-expect-error Node type stripping requires explicit source extension.
import * as p from './academic-assessments-schema.proposal.ts';
const tables = [p.proposedAssessmentSubjects, p.proposedAssessmentConfigs, p.proposedAssessmentScopes, p.proposedAssessmentRoster, p.proposedAssessmentTeachers, p.proposedAssessmentScores, p.proposedAssessmentSources, p.proposedAssessmentReviews, p.proposedAssessmentFinalizations, p.proposedAssessmentAudit, p.proposedAssessmentReceipts];
const cfg = (t: Parameters<typeof getTableConfig>[0]) => getTableConfig(t);
const index = (t: Parameters<typeof getTableConfig>[0], name: string) => { const found = cfg(t).indexes.find(i => i.config.name === name); assert.ok(found, name); return found.config; };
const fk = (t: Parameters<typeof getTableConfig>[0], name: string) => { const found = cfg(t).foreignKeys.find(f => f.getName() === name); assert.ok(found, name); return found.reference(); };
const names = (columns: { name: string }[]) => columns.map(c => c.name);

test('all proposed relations carry school IDs and all composite foreign keys include school', () => {
 assert.equal(tables.length, 11);
 for (const table of tables) {
  const c = cfg(table); assert.ok(c.columns.some(col => col.name === 'school_id' && col.notNull));
  for (const foreignKey of c.foreignKeys) {
   const ref = foreignKey.reference(); assert.equal(ref.columns[0]!.name, 'school_id');
   assert.ok(foreignKey.getName().length <= 63); assert.equal(foreignKey.onDelete, 'restrict');
  }
 }
});
test('scope and config bind school/session/term together and guard revisions', () => {
 for (const table of [p.proposedAssessmentScopes, p.proposedAssessmentConfigs]) {
  const name = table === p.proposedAssessmentScopes ? 'as_scope_term_fk' : 'as_config_term_fk';
  const ref = fk(table, name); assert.deepEqual(names(ref.columns), ['school_id', 'session_id', 'term_id']);
  assert.deepEqual(names(ref.foreignColumns), ['school_id', 'session_id', 'id']);
 }
 assert.deepEqual(index(p.proposedAssessmentScopes, 'as_scope_identity_uq').columns.map(c => 'name' in c ? c.name : null), ['school_id', 'class_id', 'session_id', 'term_id']);
 assert.ok(cfg(p.proposedAssessmentScopes).checks.some(c => c.name === 'as_scope_revision_positive'));
});
test('default and subject-specific config versions use separate partial uniqueness', () => {
 assert.ok(index(p.proposedAssessmentConfigs, 'as_config_default_revision_uq').where);
 assert.ok(index(p.proposedAssessmentConfigs, 'as_config_subject_revision_uq').where);
 assert.ok(index(p.proposedAssessmentConfigs, 'as_config_key_revision_uq').unique);
});
test('roster history is retained with only one active subject row and pinned config', () => {
 assert.ok(index(p.proposedAssessmentRoster, 'as_roster_active_subject_uq').where);
 assert.ok(index(p.proposedAssessmentRoster, 'as_roster_subject_version_uq').unique);
 assert.deepEqual(names(fk(p.proposedAssessmentScores, 'as_score_roster_config_fk').columns), ['school_id', 'roster_id', 'config_version_id']);
 assert.deepEqual(names(fk(p.proposedAssessmentTeachers, 'as_teacher_class_assignment_fk').columns), ['school_id', 'class_assignment_id']);
});
test('scores bind enrollment identity to student and unique component/config scope', () => {
 const ref = fk(p.proposedAssessmentScores, 'as_score_enrollment_student_fk');
 assert.deepEqual(names(ref.columns), ['school_id', 'enrollment_id', 'student_id']);
 assert.deepEqual(names(ref.foreignColumns), ['school_id', 'id', 'student_id']);
 assert.ok(index(p.proposedAssessmentScores, 'as_score_component_uq').unique);
 assert.ok(cfg(p.proposedAssessmentScores).checks.some(c => c.name === 'as_score_value_valid'));
});
test('finalization pins exact teacher review, source version and subject scope', () => {
 const ref = fk(p.proposedAssessmentFinalizations, 'as_finalization_exact_review_fk');
 assert.deepEqual(names(ref.columns), ['school_id', 'teacher_review_id', 'scope_id', 'roster_id', 'source_version_id']);
 assert.deepEqual(names(ref.foreignColumns), ['school_id', 'id', 'scope_id', 'roster_id', 'source_version_id']);
 assert.ok(index(p.proposedAssessmentFinalizations, 'as_finalization_source_subject_uq').unique);
 assert.ok(index(p.proposedAssessmentSources, 'as_source_scope_revision_uq').unique);
 for (const name of ['as_review_source_scope_fk', 'as_review_roster_scope_fk']) assert.ok(fk(p.proposedAssessmentReviews, name));
});
test('receipts are school/actor/key unique and audit retains revision lineage', () => {
 assert.deepEqual(index(p.proposedAssessmentReceipts, 'as_receipt_actor_operation_uq').columns.map(c => 'name' in c ? c.name : null), ['school_id', 'actor_membership_id', 'operation_key']);
 assert.ok(cfg(p.proposedAssessmentAudit).checks.some(c => c.name === 'as_audit_revision_step'));
 assert.ok(fk(p.proposedAssessmentAudit, 'as_audit_actor_fk'));
});
test('proposal stays outside production exports and the explicit migration entrypoint', async () => {
 // @ts-expect-error Node type stripping requires explicit source extension.
 const production = await import('./schema.ts');
 assert.equal(Object.hasOwn(production, 'proposedAssessmentScopes'), false);
 const config = await readFile(new URL('../../drizzle.config.ts', import.meta.url), 'utf8');
 assert.match(config, /schema:\s*['"]\.\/src\/db\/schema\.ts['"]/);
 assert.equal(config.includes('academic-assessments-schema.proposal'), false);
});
