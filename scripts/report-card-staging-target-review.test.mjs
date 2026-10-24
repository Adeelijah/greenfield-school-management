// Read configuration/SQL text only. No connection, credentials or SQL execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const target = JSON.parse(read('docs/staging/GREENFIELD_STAGING_TARGET.review.json'));
const query = read('docs/staging/REPORT_CARD_STAGING_ROLE_PREFLIGHT_REVIEW.sql');
const sql = query.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');

test('staging record retains the user-selected Primary 5 and exact separate project', () => {
  assert.equal(target.mode, 'isolated-staging-review'); assert.equal(target.schema, 'public');
  assert.equal(target.finalPrimaryYear, 5);
  assert.equal(target.projectRef, 'hweoqkbgmzycyznrbvng');
  assert.equal(target.projectUrl, 'https://' + target.projectRef + '.supabase.co');
  assert.match(target.schoolId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.equal(target.schoolName, 'Greenfield Staging');
  assert.equal(target.schoolRecordStatus, 'planned-not-created');
  assert.equal(target.applicationEnabled, false);
  assert.doesNotMatch(JSON.stringify(target), /PASSWORD|postgresql:\/\/|service_role|secret|token/i);
});

test('target retains exact role names and records the observed managed operator', () => {
  assert.equal(target.loginRole, 'greenfield_app');
  assert.equal(target.commandRole, 'greenfield_report_card_runtime');
  assert.equal(target.authorityOwnerRole, 'greenfield_report_card_authority_owner');
  assert.equal(target.roleProvisioningStatus, 'user-reported-installed-and-read-only-verified');
  assert.equal(target.installationEvidence.expectedProtectedTables, 33);
  assert.equal(target.installationEvidence.primary5SchoolConfigured, false);
  const seed = read('docs/staging/REPORT_CARD_PRIMARY5_SCHOOL_SETUP_REVIEW.sql');
  assert.ok(seed.includes(target.schoolId));
  assert.match(seed, /WHERE id=1 FOR UPDATE/);
  assert.match(seed, /pg_advisory_xact_lock/);
  assert.match(seed, /IF FOUND THEN[\s\S]+ELSE\s+INSERT INTO public\.schools/);
  assert.equal([...seed.matchAll(/INSERT INTO public\.schools/g)].length, 1);
  assert.doesNotMatch(seed, /^\s*(?:UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE)\b/gm);
  assert.doesNotMatch(seed, /auth\.users|INSERT INTO public\.(?:school_users|memberships)/);
  assert.equal(target.roleAdministration, 'supabase-postgres-createrole');
  assert.equal(target.operatorEvidence.serverVersionNum, 170011);
  assert.equal(target.operatorEvidence.superuser, false);
  assert.equal(target.operatorEvidence.allExpectedRolesAbsent, true);
  for (const role of [target.loginRole, target.commandRole, target.authorityOwnerRole]) assert.ok(query.includes("('" + role + "')"));
  assert.match(query, /LEFT JOIN pg_catalog\.pg_roles r ON r\.rolname=e\.name/);
  assert.match(query, /'present', r\.oid IS NOT NULL/);
});

test('preflight inspects operator, both membership directions and grantor without hiding absent evidence', () => {
  assert.match(query, /'operator',[\s\S]+r\.rolsuper[\s\S]+r\.rolcreaterole/);
  assert.match(query, /member_role\.rolname IN \(SELECT name FROM expected\)\s+OR granted_role\.rolname IN \(SELECT name FROM expected\)/);
  for (const field of ['m.grantor', 'm.admin_option', 'm.inherit_option', 'm.set_option', 'd.deptype=\'o\'']) assert.ok(query.includes(field));
  assert.match(query, /'auth_uid_zero_argument_uuid_functions'/);
  assert.match(query, /p\.pronargs=0/);
  assert.match(query, /p\.prorettype='pg_catalog\.uuid'::pg_catalog\.regtype/);
});

test('catalog collection is one bounded read-only transaction with no secret or application-row reads', () => {
  assert.equal([...sql.matchAll(/^BEGIN READ ONLY;$/gm)].length, 1);
  assert.equal([...sql.matchAll(/^ROLLBACK;$/gm)].length, 1);
  assert.equal([...sql.matchAll(/^WITH expected/gm)].length, 1);
  assert.match(sql, /SET LOCAL statement_timeout = '15s';/);
  assert.match(sql, /SET LOCAL lock_timeout = '3s';/);
  assert.doesNotMatch(sql, /\b(?:CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE|COPY|DO|CALL|COMMIT)\b|SET (?:LOCAL )?ROLE|rolpassword|pg_authid\s+(?:r|WHERE)|auth\.users|auth\.uid\(/i);
  const references = [...sql.matchAll(/(?:FROM|JOIN)\s+([^\s()]+)/g)].map(m => m[1]);
  assert.ok(references.every(name => name.startsWith('pg_catalog.') || name === 'expected'));
});
