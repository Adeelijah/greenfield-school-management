// Review artifact emitter only. No driver, environment, connection or runner.
// Uses the explicit staging metadata assembly, never the fixture DDL generator.
import { SQL, getTableName } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import * as assembly from '../../src/db/report-card-staging-schema.review.ts';

export const stagingProposalNames = Object.freeze(['assessment_subjects', 'assessment_config_versions', 'assessment_scopes', 'assessment_subject_roster', 'assessment_teacher_subjects', 'assessment_scores', 'assessment_source_versions', 'assessment_teacher_reviews', 'assessment_finalizations', 'assessment_audit', 'assessment_operation_receipts', 'report_cards', 'report_card_snapshots', 'report_card_audit', 'report_card_operation_receipts', 'report_card_releases']);
export function stagingReportProposalStatements() {
 const tables = Object.values(assembly).filter(v => v && typeof v === 'object' && stagingProposalNames.includes(getTableName(v)));
 if (tables.length !== 16 || new Set(tables.map(getTableName)).size !== 16) throw Error('Incomplete reviewed proposal metadata');
 const enums = Object.values(assembly).filter(v => typeof v === 'function' && typeof v.enumName === 'string' && ['assessment_config_state', 'assessment_mode', 'report_card_stage', 'report_card_action'].includes(v.enumName));
 if (enums.length !== 4) throw Error('Incomplete reviewed enum metadata');
 const q = value => '"' + value.replaceAll('"', '""') + '"';
 const literal = value => "'" + value.replaceAll("'", "''") + "'";
 const table = name => 'public.' + q(name);
 const dialect = new PgDialect();
 const expression = value => {
  const result = dialect.sqlToQuery(value);
  if (result.params.length) throw Error('Parameterized metadata expression unsupported');
  return result.sql;
 };
 const columnType = column => enums.some(e => e.enumName === column.getSQLType()) ? table(column.getSQLType()) : column.getSQLType();
 const statements = [];
 const usedEnums = new Set(tables.flatMap(t => getTableConfig(t).columns.map(c => c.getSQLType())));
 for (const e of enums.filter(e => usedEnums.has(e.enumName))) statements.push('CREATE TYPE ' + table(e.enumName) + ' AS ENUM (' + e.enumValues.map(literal).join(',') + ')');
 for (const t of tables) {
  const c = getTableConfig(t);
  if (c.primaryKeys.length) throw Error('Table-level primary keys need explicit emitter support');
  if (c.uniqueConstraints.length) throw Error('Table-level unique constraints need explicit emitter support');
  const columns = c.columns.map(column => {
   let ddl = q(column.name) + ' ' + columnType(column);
   if (column.generated || column.generatedIdentity) throw Error('Generated columns require explicit emitter support');
   if (column.notNull) ddl += ' NOT NULL';
   if (column.primary) ddl += ' PRIMARY KEY';
   if (column.isUnique) {
    if (column.uniqueType && column.uniqueType !== 'distinct') throw Error('Non-default column uniqueness unsupported');
    ddl += (column.uniqueName ? ' CONSTRAINT ' + q(column.uniqueName) : '') + ' UNIQUE';
   }
   if (column.default !== undefined) {
    const value = column.default;
    const rendered = value instanceof SQL ? expression(value) : typeof value === 'string' ? literal(value) : typeof value === 'boolean' ? String(value) : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
    if (rendered === null) throw Error('Unsupported metadata default');
    ddl += ' DEFAULT ' + rendered;
   }
   return ddl;
  });
  for (const check of c.checks) columns.push('CONSTRAINT ' + q(check.name) + ' CHECK (' + expression(check.value) + ')');
  statements.push('CREATE TABLE ' + table(c.name) + ' (' + columns.join(',') + ')');
 }
 for (const t of tables) {
  const c = getTableConfig(t);
  for (const index of c.indexes) {
   const i = index.config;
   if (i.method && i.method !== 'btree') throw Error('Non-btree review index unsupported');
   const cols = i.columns.map(column => {
    if (!column.name || column.indexConfig?.opClass) throw Error('Expression/operator index unsupported');
    const order = column.indexConfig?.order ?? 'asc';
    const nulls = column.indexConfig?.nulls ?? 'last';
    if (!['asc', 'desc'].includes(order) || !['first', 'last'].includes(nulls)) throw Error('Unsupported index order');
    return q(column.name) + ' ' + order + ' NULLS ' + nulls;
   });
   statements.push('CREATE ' + (i.unique ? 'UNIQUE ' : '') + 'INDEX ' + q(i.name) + ' ON ' + table(c.name) + ' (' + cols.join(',') + ')' + (i.where ? ' WHERE ' + expression(i.where) : ''));
  }
 }
 const known = new Set(Object.values(assembly).filter(v => v && typeof v === 'object').map(getTableName));
 for (const t of tables) for (const key of getTableConfig(t).foreignKeys) {
  const ref = key.reference(); const target = getTableName(ref.foreignTable);
  if (!known.has(target)) throw Error('External review reference: ' + target);
  const remove = key.onDelete ?? 'no action'; const update = key.onUpdate ?? 'no action';
  if (![remove, update].every(action => ['no action', 'restrict', 'cascade', 'set null', 'set default'].includes(action))) throw Error('Unsupported FK action');
  statements.push('ALTER TABLE ' + table(getTableName(t)) + ' ADD CONSTRAINT ' + q(key.getName()) + ' FOREIGN KEY (' + ref.columns.map(c => q(c.name)).join(',') + ') REFERENCES ' + table(target) + ' (' + ref.foreignColumns.map(c => q(c.name)).join(',') + ') ON DELETE ' + remove + ' ON UPDATE ' + update);
 }
 return Object.freeze(statements);
}
