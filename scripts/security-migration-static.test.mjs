// Static security gate for review artifacts. Does NOT connect to Supabase.
// Run: node --test scripts/security-migration-static.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const foundation = read('drizzle/0000_broad_slayback.sql');
const policy = read('docs/security/01_rls_policy_draft.sql');
const fk = read('docs/security/05_auth_user_fk_review.sql');

const tables = [
  'schools', 'school_users', 'memberships', 'academic_sessions',
  'terms', 'classes', 'students', 'guardians', 'student_guardians',
  'enrollments', 'admissions', 'audit_events',
];

test('foundation contains all 12 application tables', () => {
  for (const table of tables) {
    assert.match(foundation, new RegExp('CREATE TABLE "' + table + '"\\s*\\('));
  }
});

test('RLS draft enables and forces RLS on every application table', () => {
  for (const table of tables) {
    assert.ok(policy.includes('ALTER TABLE public.' + table + ' ENABLE ROW LEVEL SECURITY;'), table);
    assert.ok(policy.includes('ALTER TABLE public.' + table + ' FORCE ROW LEVEL SECURITY;'), table);
  }
});

test('no write policies in draft before privilege review', () => {
  assert.doesNotMatch(policy, /CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)\b/i);
});

test('auth FK targets existing Supabase-managed identity and restricts deletion', () => {
  assert.match(fk, /REFERENCES auth\.users\s*\(id\)/i);
  assert.match(fk, /ON DELETE RESTRICT/i);
  assert.doesNotMatch(fk, /CREATE TABLE\s+auth\.users/i);
});

test('foundation is immutable while review continues', () => {
  assert.doesNotMatch(foundation, /REFERENCES\s+"auth"\."users"/i);
});

test('RLS helper explicitly removes PUBLIC execute access', () => {
  assert.match(policy, /REVOKE ALL ON FUNCTION private\.has_active_school_membership\(uuid\) FROM PUBLIC/i);
  assert.match(policy, /REVOKE ALL ON FUNCTION private\.has_school_role\(uuid, public\.school_role\[\]\) FROM PUBLIC/i);
});
