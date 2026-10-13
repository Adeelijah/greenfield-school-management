import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authorization = readFileSync(new URL('../src/server/auth/authorization.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/lib/supabase/server.ts', import.meta.url), 'utf8');

test('authorization uses cookie-scoped Supabase client, not privileged direct database', () => {
  assert.match(authorization, /createSupabaseServerClient/);
  assert.doesNotMatch(authorization, /getDatabase|DATABASE_URL|MIGRATION_DATABASE_URL|drizzle-orm/);
  assert.match(client, /createServerClient/);
});

test('authorization verifies user before reading any membership', () => {
  const auth = authorization.indexOf('supabase.auth.getUser()');
  const lookup = authorization.indexOf(".from('school_users')");
  assert.ok(auth >= 0 && lookup > auth);
  assert.match(authorization, /authError \|\| !auth\.user/);
});

test('authorization rejects zero or ambiguous active memberships', () => {
  assert.match(authorization, /\.eq\('status', 'active'\)/);
  assert.match(authorization, /\.limit\(2\)/);
  assert.match(authorization, /memberships\.length !== 1/);
});

test('authorization checks linked school and allowed role', () => {
  assert.match(authorization, /\['admin', 'teacher', 'bursar'\]/);
  assert.match(authorization, /school\.id !== membership\.school_id/);
});

test('authorization fails closed on errors', () => {
  assert.match(authorization, /if \(userError \|\| !schoolUser\) return null/);
  assert.match(authorization, /if \(schoolError \|\| !school/);
  assert.match(authorization, /catch \(error\)/);
});
