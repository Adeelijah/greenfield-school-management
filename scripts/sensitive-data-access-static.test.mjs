import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const baseline = readFileSync(new URL('../docs/security/07_read_only_rls_baseline.sql', import.meta.url), 'utf8');
const review = readFileSync(new URL('../docs/security/08_sensitive_data_access_review.sql', import.meta.url), 'utf8');

test('existing baseline still grants broad student and guardian reads and must not ship unchanged', () => {
  assert.match(baseline, /GRANT SELECT ON TABLE[\s\S]*public\.students,[\s\S]*public\.guardians,[\s\S]*TO authenticated/);
});

test('review document explicitly rejects combining permissive policies', () => {
  assert.match(review, /Never apply both versions as-is/);
  assert.match(review, /permissive RLS policies combine with OR/);
});

test('student browser column grant excludes sensitive date of birth', () => {
  const grant = review.match(/GRANT SELECT \(([^)]+)\)\s+ON public\.students TO authenticated/);
  assert.ok(grant);
  assert.doesNotMatch(grant[1], /date_of_birth|created_at/);
  for (const column of ['id','school_id','admission_number','first_name','last_name','status']) {
    assert.ok(grant[1].split(',').map(x=>x.trim()).includes(column), column);
  }
});

test('guardian, admissions and enrollment browser reads remain withheld in proposal', () => {
  assert.match(review, /REVOKE SELECT ON public\.guardians, public\.student_guardians,\s*public\.enrollments, public\.admissions FROM authenticated/);
  assert.doesNotMatch(review, /CREATE POLICY\s+\w+\s+ON public\.(guardians|student_guardians|enrollments|admissions)/);
});

test('proposal requires real JWT and privileged server path tests', () => {
  assert.match(review, /actual JWT claims and PostgREST/);
  assert.match(review, /Test all privileged server handlers independently/);
});
