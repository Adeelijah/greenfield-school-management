// Source/semantic checks only. No driver, connection, SQL execution or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { reportUpgradeSourcePlan } from './lib/report-card-upgrade-plan.mjs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const baseline = read('drizzle/0000_broad_slayback.sql');
const review = read('docs/staging/REPORT_CARD_FRESH_FOUNDATION_REVIEW.sql');
const schema = 'rc_it_0123456789abcdef';
const expected = reportUpgradeSourcePlan(schema, baseline, read('docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql'));
const withoutComments = text => text.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
const definitions = text => withoutComments(text.slice(text.indexOf('-- Phase: enums'), text.indexOf('-- Phase: protection'))).split(';').map(s => s.trim()).filter(Boolean);

test('fresh review preserves every pinned semantic baseline definition without invoking a fixture generator', () => {
  const sha = createHash('sha256').update(baseline.trim()).digest('hex');
  assert.equal(sha, 'd7a1a0d90c8b3ec5b809cc5ad9e209db26f23bcddd13fd5847760c909eefee02');
  assert.ok(review.includes('Normalized historical baseline SHA256: ' + sha));
  assert.deepEqual(definitions(review), expected.baselineStatements.map(s => s.replaceAll('"' + schema + '".', '"public".')));
});

test('fresh foundation orders four enums, twelve tables and nineteen indexes before twenty FKs', () => {
  const all = definitions(review);
  assert.equal(all.filter(s => s.startsWith('CREATE TYPE ')).length, 4);
  assert.equal(all.filter(s => s.startsWith('CREATE TABLE ')).length, 12);
  assert.equal(all.filter(s => /^CREATE (?:UNIQUE )?INDEX /.test(s)).length, 19);
  assert.equal(all.filter(s => s.startsWith('ALTER TABLE ')).length, 20);
  const firstFk = all.findIndex(s => s.startsWith('ALTER TABLE '));
  const lastIndex = all.reduce((last, s, i) => /^CREATE (?:UNIQUE )?INDEX /.test(s) ? i : last, -1);
  assert.ok(firstFk > lastIndex);
  assert.deepEqual(all.filter(s => s.startsWith('CREATE TABLE ')).map(s => /^CREATE TABLE "public"\."(\w+)"/.exec(s)[1]), expected.baselineTables);
});

test('catalog preflight precedes DDL and rejects existing relations, type collisions and wrong operator context', () => {
  const preflight = review.slice(review.indexOf('-- Phase: fresh_preflight'), review.indexOf('-- Phase: enums'));
  assert.match(preflight, /current_user IN \('anon','authenticated','service_role','greenfield_app'/);
  assert.match(preflight, /c\.relkind IN \('r','p','v','m','f','S'\)/);
  assert.match(preflight, /t\.typname=ANY\(ARRAY\['admission_status','enrollment_status','membership_status','school_role'\]\)/);
  assert.match(preflight, /rolname IN \('anon','authenticated','service_role'\)\)<>3/);
  assert.equal([...review.matchAll(/^BEGIN;$/gm)].length, 1);
  assert.equal([...review.matchAll(/^COMMIT;$/gm)].length, 1);
  assert.ok(review.indexOf('SET LOCAL search_path = pg_catalog;') < review.indexOf('-- Phase: fresh_preflight'));
  assert.doesNotMatch(withoutComments(review), /^\s*(?:CREATE (?:ROLE|TABLE IF NOT EXISTS|TYPE IF NOT EXISTS)|ALTER (?:ROLE|DEFAULT PRIVILEGES)|DROP (?:TABLE|SCHEMA|TYPE)|TRUNCATE\b|INSERT INTO\b|UPDATE (?:public\.|"public"\.)|DELETE FROM\b)/m);
});

test('every new table has forced RLS, no API grants and an operator-only setup policy before commit', () => {
  for (const name of expected.baselineTables) {
    const table = '"public"."' + name + '"';
    for (const statement of [
      'ALTER TABLE ' + table + ' ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE ' + table + ' FORCE ROW LEVEL SECURITY;',
      'REVOKE ALL ON TABLE ' + table + ' FROM PUBLIC,anon,authenticated,service_role;',
      'CREATE POLICY foundation_setup_operator ON ' + table + ' FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);',
    ]) assert.ok(review.indexOf(statement) > review.indexOf('-- Phase: protection') && review.indexOf(statement) < review.indexOf('COMMIT;'), statement);
  }
  assert.doesNotMatch(withoutComments(review), /\bGRANT\b|CREATE POLICY[^;]+TO (?:PUBLIC|anon|authenticated|service_role)/);
  assert.match(review, /pg_catalog\.has_table_privilege\(selected_role,selected_relation/);
  assert.match(review, /pg_catalog\.has_any_column_privilege\(selected_role,selected_relation/);
  assert.match(review, /EXECUTE pg_catalog\.format\('REVOKE ALL ON TABLE public\.%I FROM %I',selected_table,selected_role\)/);
  assert.match(review, /c\.relrowsecurity AND c\.relforcerowsecurity\)<>12/);
});

test('review is explicitly target-bound without claiming database attestation, journal installation or auth changes', () => {
  assert.match(review, /Intended isolated project: hweoqkbgmzycyznrbvng/);
  assert.match(review, /SQL cannot attest the Supabase project reference/);
  assert.match(review, /not authorized for execution/);
  assert.match(review, /Do not run against an existing installation, production or via Drizzle migrate/);
  assert.doesNotMatch(withoutComments(review), /auth\.users|auth\.identities|supabase_migrations|__drizzle_migrations|CREATE SCHEMA|CREATE FUNCTION|DROP POLICY/);
  assert.ok(review.indexOf('COMMIT;') < review.indexOf('SELECT count(*) AS foundation_tables'));
});

test('LF and CRLF snapshots retain identical semantic statements and protected table surface', () => {
  const crlf = review.replaceAll('\n', '\r\n');
  assert.deepEqual(definitions(crlf.replaceAll('\r\n', '\n')), definitions(review));
  assert.equal([...crlf.matchAll(/FORCE ROW LEVEL SECURITY;/g)].length, 12);
});
