import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'src/server/students/supabase-directory.ts',
  'utf8'
);

test('uses the cookie-scoped Supabase server client', () => {
  assert.match(source, /createSupabaseServerClient\(\)/);
  assert.doesNotMatch(source, /getDatabase\(\)/);
});

test('requires verified administrator or teacher access', () => {
  assert.match(
    source,
    /requireSchoolRole\(\['admin', 'teacher'\]\)/
  );
});

test('filters student records by verified school ID', () => {
  assert.match(
    source,
    /\.eq\('school_id', access\.schoolId\)/
  );
});

test('selects only directory-safe fields', () => {
  assert.match(
    source,
    /\.select\('id, admission_number, first_name, last_name, status'\)/
  );
  assert.doesNotMatch(source, /date_of_birth/);
});

test('fails closed when the query fails', () => {
  assert.match(source, /if \(error\)/);
  assert.match(
    source,
    /throw new Error\('Student directory is unavailable'\)/
  );
});

test('remains server-only', () => {
  assert.match(source, /import 'server-only'/);
});