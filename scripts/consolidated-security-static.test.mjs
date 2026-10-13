import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../docs/security/09_consolidated_read_only_review.sql', import.meta.url), 'utf8');
const tables = ['schools','school_users','memberships','academic_sessions','terms','classes','students','guardians','student_guardians','enrollments','admissions','audit_events'];
const expectedPolicies = ['schools','school_users','memberships','academic_sessions','terms','classes','students'];

test('all 12 tables have ENABLE and FORCE RLS', () => {
  for (const table of tables) {
    assert.ok(sql.includes('ALTER TABLE public.' + table + ' ENABLE ROW LEVEL SECURITY;'), table);
    assert.ok(sql.includes('ALTER TABLE public.' + table + ' FORCE ROW LEVEL SECURITY;'), table);
  }
});

test('only seven non-sensitive or limited-roster tables have read policies', () => {
  const found = [...sql.matchAll(/CREATE POLICY\s+\w+\s+ON public\.(\w+)\s+FOR SELECT TO authenticated/g)].map(x=>x[1]).sort();
  assert.deepEqual(found, [...expectedPolicies].sort());
});

test('no browser write policies or write grants', () => {
  const statements = sql.split(';').map(s=>s.replace(/--[^\n]*/g,'').trim()).filter(Boolean);
  for (const statement of statements) {
    assert.doesNotMatch(statement, /CREATE POLICY[\s\S]*FOR\s+(INSERT|UPDATE|DELETE|ALL)\b/i);
    assert.doesNotMatch(statement, /GRANT\s+(INSERT|UPDATE|DELETE|ALL|TRUNCATE|REFERENCES|TRIGGER)\b/i);
  }
});

test('no full student table grant or direct guardian/admissions grant', () => {
  const grants = sql.split(';').map(s=>s.replace(/--[^\n]*/g,'').trim()).filter(s=>/^GRANT\s/i.test(s)).join(';');
  assert.doesNotMatch(grants, /GRANT SELECT ON TABLE[\s\S]*public\.(students|guardians|student_guardians|enrollments|admissions|audit_events)/i);
  const roster = grants.match(/GRANT SELECT \(([^)]+)\)\s+ON public\.students TO authenticated/i);
  assert.ok(roster);
  assert.doesNotMatch(roster[1], /date_of_birth|created_at/);
});

test('student policy excludes bursar and checks active school membership', () => {
  assert.match(sql, /m\.role IN \('admin', 'teacher'\)/);
  assert.match(sql, /m\.school_id = students\.school_id\s+AND m\.status = 'active'/);
  assert.match(sql, /auth_user_id = \(SELECT auth\.uid\(\)\)/);
});

test('document is explicitly not executable and supersedes earlier drafts', () => {
  assert.match(sql, /NOT A MIGRATION\. DO NOT EXECUTE/);
  assert.match(sql, /REPLACES 07 and 08/);
});
