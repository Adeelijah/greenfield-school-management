// Offline source-contract checks. No imports of application/config/driver modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n', '\n');
const assembly = read('src/db/report-card-staging-schema.review.ts');
const draft = read('docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql');
const sql = draft.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
const exportNames = [...assembly.matchAll(/export\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)].flatMap(m => m[1].split(',').map(name => name.trim()));

test('assembly is an explicit partial review surface, never a migration or connection entrypoint', () => {
  assert.equal(exportNames.length, 35); // 27 tables and eight used enums.
  assert.equal(new Set(exportNames).size, exportNames.length);
  assert.doesNotMatch(assembly, /export\s*\*|\bprocess\.|getDatabase|postgres\(|dotenv|supabase|defineConfig/);
  for (const name of ['proposedTermsCompositeTarget', 'proposedEnrollmentCompositeTarget', 'studentLifecycleDecisions', 'studentDepartures', 'studentReadmissions', 'auditEvents', 'guardians', 'admissions']) assert.equal(exportNames.includes(name), false, name);
  const config = read('drizzle.config.ts');
  assert.match(config, /schema:\s*'\.\/src\/db\/schema\.ts'/);
  assert.doesNotMatch(config, /staging-schema|schema\.proposal|\*\.ts/);
});

test('dependency SQL only creates the three selected academic tables and one enum', () => {
  assert.deepEqual([...sql.matchAll(/CREATE TABLE\s+public\.(\w+)/g)].map(m => m[1]), ['academic_levels', 'academic_sections', 'teacher_class_assignments']);
  assert.deepEqual([...sql.matchAll(/CREATE TYPE\s+public\.(\w+)/g)].map(m => m[1]), ['academic_stage']);
  for (const table of ['academic_levels', 'academic_sections', 'teacher_class_assignments']) {
    const statement = statements.find(s => s.startsWith('CREATE TABLE public.' + table + ' ('));
    assert.ok(statement.includes('CONSTRAINT ' + table + '_school_id_schools_id_fk REFERENCES public.schools(id) ON DELETE RESTRICT'), table + ' explicit school FK name');
  }
  assert.doesNotMatch(sql, /student_lifecycle|student_departures|student_readmissions|audit_events|admission_status|guardian/);
});

test('every statement has a bounded additive shape and qualified existing relation', () => {
  for (const statement of statements) assert.match(statement, /^(?:CREATE TYPE public\.academic_stage AS ENUM|CREATE TABLE public\.(?:academic_levels|academic_sections|teacher_class_assignments)\s*\(|CREATE (?:UNIQUE )?INDEX \w+ ON public\.\w+\s*\(|ALTER TABLE public\.(?:schools|classes) ADD (?:COLUMN|CONSTRAINT)\s)/, statement);
  for (const statement of statements) assert.doesNotMatch(statement, /^(?:DROP|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|DELETE|DO|CALL)\b/i);
  assert.doesNotMatch(sql, /IF NOT EXISTS/i);
  assert.equal([...sql.matchAll(/REFERENCES\s+(?!public\.)(\w+)/g)].length, 0);
});

test('the three new FK targets preserve exact column tuples', () => {
  const expected = [
    ['terms_school_session_id_unique', 'terms', 'school_id,session_id,id'],
    ['teacher_class_assignments_school_id_id_unique', 'teacher_class_assignments', 'school_id,id'],
    ['enrollments_report_binding_unique', 'enrollments', 'school_id,id,student_id,class_id,session_id'],
  ];
  const found = [...sql.matchAll(/CREATE UNIQUE INDEX (\w+) ON public\.(\w+)\s*\(([^)]+)\)/g)].map(m => [m[1], m[2], m[3].replaceAll(/\s/g, '')]);
  for (const target of expected) assert.ok(found.some(row => JSON.stringify(row) === JSON.stringify(target)), target[0]);
});

test('new relation creation and key targets precede every new dependency', () => {
  const before = (first, next) => assert.ok(sql.indexOf(first) >= 0 && sql.indexOf(first) < sql.indexOf(next), first + ' before ' + next);
  before('CREATE TYPE public.academic_stage', 'CREATE TABLE public.academic_levels');
  before('CREATE TABLE public.academic_levels', 'CREATE TABLE public.academic_sections');
  before('CREATE UNIQUE INDEX academic_sections_school_level_id_id_unique', 'ALTER TABLE public.classes ADD CONSTRAINT classes_school_level_section_fk');
  before('CREATE UNIQUE INDEX memberships_school_id_id_unique', 'CREATE TABLE public.teacher_class_assignments');
  before('CREATE TABLE public.teacher_class_assignments', 'CREATE UNIQUE INDEX teacher_class_assignments_school_id_id_unique');
});

test('school and legacy class mapping remain nullable with no inferred backfill or destructive reconciliation', () => {
  assert.match(sql, /ADD COLUMN final_primary_year integer\s*;/);
  assert.match(sql, /ADD COLUMN level_id uuid\s*;/);
  assert.match(sql, /ADD COLUMN section_id uuid\s*;/);
  assert.match(sql, /CHECK \(\(level_id IS NULL\) = \(section_id IS NULL\)\)/);
  assert.doesNotMatch(sql, /ALTER COLUMN|SET NOT NULL|SET DEFAULT/i);
  assert.match(draft, /enclosing transaction/);
});
