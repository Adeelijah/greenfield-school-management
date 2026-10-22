// Pure, bounded namespace adaptation for trusted repository fixture sources only.
// Not a general SQL parser, migration generator or application adapter.
export const upgradeProposalTables = Object.freeze(['assessment_subjects', 'assessment_config_versions', 'assessment_scopes', 'assessment_subject_roster', 'assessment_teacher_subjects', 'assessment_scores', 'assessment_source_versions', 'assessment_teacher_reviews', 'assessment_finalizations', 'assessment_audit', 'assessment_operation_receipts', 'report_cards', 'report_card_snapshots', 'report_card_audit', 'report_card_operation_receipts', 'report_card_releases']);
const baselineTables = ['academic_sessions', 'admissions', 'audit_events', 'classes', 'enrollments', 'guardians', 'memberships', 'school_users', 'schools', 'student_guardians', 'students', 'terms'];
const baselineEnums = ['admission_status', 'enrollment_status', 'membership_status', 'school_role'];
const extraEnums = ['assessment_config_state', 'assessment_mode', 'report_card_stage', 'report_card_action'];
const dependencyTables = ['academic_levels', 'academic_sections', 'teacher_class_assignments'];
export function upgradeFixtureSchema(schema) {
  if (typeof schema !== 'string' || !/^rc_it_[a-f0-9]{16}$/.test(schema)) throw Error('Only exact generated fixture schemas allowed');
  return '"' + schema + '"';
}
function split(source) {
  if (typeof source !== 'string' || !source.trim()) throw Error('Missing reviewed SQL source');
  // These two fixed repository drafts have no function bodies or semicolons in
  // literals. Refuse unsupported forms rather than splitting arbitrary SQL.
  const text = source.replaceAll('\r\n', '\n').replaceAll('--> statement-breakpoint', '').split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
  if (/\$|\/\*|--|\\/m.test(text)) throw Error('Unsupported reviewed SQL form');
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === ';') throw Error('Semicolon in quoted SQL unsupported');
      if (char === quote) { if (text[i + 1] === quote) i++; else quote = null; }
    } else if (char === "'" || char === '"') quote = char;
  }
  if (quote) throw Error('Unclosed reviewed SQL quote');
  return text.split(';').map(s => s.trim()).filter(Boolean);
}
function closed(actual, expected, label) {
  if (actual.length !== expected.length || new Set(actual).size !== actual.length || expected.some(name => !actual.includes(name))) throw Error('Unexpected ' + label);
}
export function reportUpgradeSourcePlan(schema, baseline, dependencies) {
  const q = upgradeFixtureSchema(schema);
  const original = split(baseline);
  const kinds = { types: [], tables: [], indexes: [], foreignKeys: [] };
  for (const statement of original) {
    if (/^CREATE TYPE "public"\."\w+" AS ENUM/.test(statement)) kinds.types.push(statement);
    else if (/^CREATE TABLE "\w+"\s*\(/.test(statement)) kinds.tables.push(statement);
    else if (/^CREATE (?:UNIQUE )?INDEX "\w+" ON "\w+" USING btree/.test(statement)) kinds.indexes.push(statement);
    else if (/^ALTER TABLE "\w+" ADD CONSTRAINT "\w+" FOREIGN KEY/.test(statement)) kinds.foreignKeys.push(statement);
    else throw Error('Unsupported baseline statement');
  }
  closed(kinds.tables.map(s => /^CREATE TABLE "(\w+)"/.exec(s)[1]), baselineTables, 'baseline tables');
  closed(kinds.types.map(s => /^CREATE TYPE "public"\."(\w+)"/.exec(s)[1]), baselineEnums, 'baseline enums');
  const adapt = statement => {
    let result = statement.replaceAll('"public".', q + '.');
    result = result.replace(/^(CREATE TABLE|ALTER TABLE) "(\w+)"/, '$1 ' + q + '."$2"');
    result = result.replace(/ ON "(\w+)" USING btree/, ' ON ' + q + '."$1" USING btree');
    for (const name of baselineEnums) result = result.replaceAll(new RegExp('(^|[\\s(,])"' + name + '"(?=[\\s,)])', 'g'), '$1' + q + '."' + name + '"');
    if (/"public"\./.test(result) || [...result.matchAll(/REFERENCES "([^"]+)"\./g)].some(m => m[1] !== schema)) throw Error('Unmapped baseline namespace');
    return result;
  };
  const delta = split(dependencies);
  closed(delta.filter(s => /^CREATE TABLE /.test(s)).map(s => /^CREATE TABLE public\.(\w+)/.exec(s)?.[1]), dependencyTables, 'dependency tables');
  for (const statement of delta) {
    if (!/^(?:CREATE TYPE public\.academic_stage AS ENUM|CREATE TABLE public\.(?:academic_levels|academic_sections|teacher_class_assignments)\s*\(|CREATE (?:UNIQUE )?INDEX \w+ ON public\.\w+\s*\(|ALTER TABLE public\.(?:schools|classes) ADD (?:COLUMN|CONSTRAINT)\s)/.test(statement)) throw Error('Unsupported dependency statement');
    if ([...statement.matchAll(/REFERENCES\s+([^\s(]+)/g)].some(m => !/^public\.\w+$/.test(m[1]))) throw Error('Foreign dependency reference');
  }
  return {
    // Historical file has FKs before some required indexes. Reorder definitions
    // ONLY for the isolated semantic baseline; never edit/claim raw journal replay.
    baselineStatements: [...kinds.types, ...kinds.tables, ...kinds.indexes, ...kinds.foreignKeys].map(adapt),
    dependencyStatements: delta.map(s => s.replaceAll('public.', q + '.')),
    baselineTables: [...baselineTables], baselineEnums: [...baselineEnums],
    upgradedTables: [...baselineTables, ...dependencyTables, ...upgradeProposalTables],
  };
}

/** Select only 16 new tables from the already reviewed in-memory fixture emitter.
 * Keep its two-pass table/index/FK order, including the report audit/release cycle.
 */
export function reportUpgradeProposalPlan(schema, emitted) {
  const q = upgradeFixtureSchema(schema);
  if (!Array.isArray(emitted) || emitted.some(s => typeof s !== 'string')) throw Error('Missing fixture metadata statements');
  const target = '"' + schema + '"\\."';
  const selected = [];
  for (const statement of emitted) {
    const type = new RegExp('^CREATE TYPE ' + target + '(\\w+)"').exec(statement);
    const table = new RegExp('^CREATE TABLE ' + target + '(\\w+)"').exec(statement);
    const index = new RegExp('^CREATE (?:UNIQUE )?INDEX "\\w+" ON ' + target + '(\\w+)"').exec(statement);
    const fk = new RegExp('^ALTER TABLE ' + target + '(\\w+)" ADD CONSTRAINT "\\w+" FOREIGN KEY').exec(statement);
    if (type && extraEnums.includes(type[1]) || [table, index, fk].some(m => m && upgradeProposalTables.includes(m[1]))) selected.push(statement);
  }
  closed(selected.filter(s => s.startsWith('CREATE TABLE ')).map(s => /^CREATE TABLE "\w+"\."(\w+)"/.exec(s)[1]), upgradeProposalTables, 'proposal tables');
  closed(selected.filter(s => s.startsWith('CREATE TYPE ')).map(s => /^CREATE TYPE "\w+"\."(\w+)"/.exec(s)[1]), extraEnums, 'proposal enums');
  for (const statement of selected) {
    if (/"public"\.|\bpublic\./.test(statement)) throw Error('External proposal namespace');
    const refs = [...statement.matchAll(/(?:CREATE TABLE|ALTER TABLE|REFERENCES| ON) "([^"]+)"\."/g)];
    if (refs.some(m => m[1] !== schema) || !statement.includes(q + '.')) throw Error('Foreign proposal namespace');
  }
  const lastTable = selected.reduce((last, s, i) => s.startsWith('CREATE TABLE ') ? i : last, -1);
  if (selected.some((s, i) => s.startsWith('ALTER TABLE ') && i <= lastTable)) throw Error('Foreign key before all proposal tables');
  return selected;
}
