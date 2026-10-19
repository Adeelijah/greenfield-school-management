// Offline metadata -> in-memory fixture DDL. Never a migration generator/file.
import { SQL, getTableName } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import * as base from '../../src/db/schema.ts';
import * as proposal from '../../src/db/academic-assessments-schema.proposal.ts';
import * as reports from '../../src/db/report-cards-schema.proposal.ts';
export const reportFixtureTables = [reports.proposedReportCards, reports.proposedReportSnapshots, reports.proposedReportAudit, reports.proposedReportReceipts, reports.proposedReportReleases];
export const fixtureTables = [base.schools, base.schoolUsers, base.memberships, base.academicSessions, base.terms, base.academicLevels, base.academicSections, base.classes, base.students, base.enrollments, base.teacherClassAssignments,
 proposal.proposedAssessmentSubjects, proposal.proposedAssessmentConfigs, proposal.proposedAssessmentScopes, proposal.proposedAssessmentRoster, proposal.proposedAssessmentTeachers, proposal.proposedAssessmentScores, proposal.proposedAssessmentSources, proposal.proposedAssessmentReviews, proposal.proposedAssessmentFinalizations, proposal.proposedAssessmentAudit, proposal.proposedAssessmentReceipts];
const enums = [...Object.values(base), ...Object.values(proposal), ...Object.values(reports)].filter(v => typeof v === 'function' && typeof v.enumName === 'string' && Array.isArray(v.enumValues));
export const fixtureIdentifier = value => '"' + value.replaceAll('"', '""') + '"';
const literal = value => "'" + value.replaceAll("'", "''") + "'";
export function assessmentFixtureDDL(schema, { includeReports = false } = {}) {
 if (typeof includeReports !== 'boolean') throw Error('Invalid report fixture option');
 const tables = includeReports ? [...fixtureTables, ...reportFixtureTables] : fixtureTables;
 if (!/^rc_it_[a-f0-9]{16}$/.test(schema)) throw Error('Only generated disposable fixture schemas allowed.');
 const q = fixtureIdentifier;
 const table = name => q(schema) + '.' + q(name);
 const dialect = new PgDialect();
 const expression = value => {
  const result = dialect.sqlToQuery(value);
  if (result.params.length) throw Error('Parameterized metadata expression unsupported');
  return result.sql;
 };
 const columnType = column => enums.some(e => e.enumName === column.getSQLType()) ? table(column.getSQLType()) : column.getSQLType();
 const statements = ['CREATE SCHEMA ' + q(schema)];
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
   if (i.method && i.method !== 'btree') throw Error('Non-btree fixture index unsupported');
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
 // Explicit review prerequisites are added ONLY to isolated fixture tables.
 statements.push('CREATE UNIQUE INDEX terms_school_session_id_unique ON ' + table('terms') + ' (school_id,session_id,id)');
 statements.push('CREATE UNIQUE INDEX teacher_class_assignments_school_id_id_unique ON ' + table('teacher_class_assignments') + ' (school_id,id)');
 if (includeReports) statements.push('CREATE UNIQUE INDEX enrollments_report_binding_unique ON ' + table('enrollments') + ' (school_id,id,student_id,class_id,session_id)');
 const known = new Set(tables.map(getTableName));
 for (const t of tables) for (const key of getTableConfig(t).foreignKeys) {
  const ref = key.reference(); const target = getTableName(ref.foreignTable);
  if (!known.has(target)) throw Error('External fixture reference: ' + target);
  const remove = key.onDelete ?? 'no action'; const update = key.onUpdate ?? 'no action';
  if (![remove, update].every(action => ['no action', 'restrict', 'cascade', 'set null', 'set default'].includes(action))) throw Error('Unsupported FK action');
  statements.push('ALTER TABLE ' + table(getTableName(t)) + ' ADD CONSTRAINT ' + q(key.getName()) + ' FOREIGN KEY (' + ref.columns.map(c => q(c.name)).join(',') + ') REFERENCES ' + table(target) + ' (' + ref.foreignColumns.map(c => q(c.name)).join(',') + ') ON DELETE ' + remove + ' ON UPDATE ' + update);
 }
 return { statements, table, columnType, proposalTableCount: 11, reportTableCount: includeReports ? 5 : 0, tableCount: tables.length };
}
