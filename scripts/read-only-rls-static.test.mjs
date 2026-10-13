import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../docs/security/07_read_only_rls_baseline.sql', import.meta.url), 'utf8');
const tables = ['schools','school_users','memberships','academic_sessions','terms','classes','students','guardians','student_guardians','enrollments','admissions','audit_events'];

test('all 12 tables enable and force RLS', () => {
  for (const table of tables) {
    assert.ok(sql.includes('ALTER TABLE public.' + table + ' ENABLE ROW LEVEL SECURITY;'), table);
    assert.ok(sql.includes('ALTER TABLE public.' + table + ' FORCE ROW LEVEL SECURITY;'), table);
  }
});

test('exactly one SELECT policy per application table', () => {
  const matches = [...sql.matchAll(/CREATE POLICY\s+\w+\s+ON public\.(\w+)\s+FOR SELECT TO authenticated/g)];
  assert.deepEqual(matches.map(m => m[1]).sort(), [...tables].sort());
});

test('no write policies or write grants', () => {
  const statements = sql.split(';').map(s => s.replace(/--[^\n]*/g, '').trim()).filter(Boolean);
  for (const statement of statements) {
    assert.doesNotMatch(statement, /CREATE POLICY[\s\S]*FOR\s+(INSERT|UPDATE|DELETE|ALL)\b/i);
    assert.doesNotMatch(statement, /GRANT\s+(INSERT|UPDATE|DELETE|ALL|TRUNCATE|REFERENCES|TRIGGER)\b/i);
  }
});

test('authenticated self-only membership path and admin-only audit', () => {
  assert.match(sql, /auth_user_id\s*=\s*\(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /m\.role\s*=\s*'admin'/);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated/);
});
