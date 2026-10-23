import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { managedStagingRoleReview, managedStagingAuthBindingProbe } from './lib/report-card-managed-role-review.mjs';
import { assembleStagingReportReview } from './lib/report-card-staging-package-review.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const target = JSON.parse(read('docs/staging/GREENFIELD_STAGING_TARGET.review.json'));
const config = { ...target, sourceCommit: 'a'.repeat(40), baseline: 'reconciled-semantic-0000' };
const guards = read('docs/staging/REPORT_CARD_COORDINATED_GUARDS_REVIEW.sql');

test('managed bootstrap is fixed to the observed operator, target, PostgreSQL version and absent role inventory', () => {
  const plan = managedStagingRoleReview(config, guards);
  for (const patch of [{ projectRef: 'other' }, { schoolId: '00000000-0000-0000-0000-000000000001' },
    { finalPrimaryYear: 6 }, { roleAdministration: 'other' }, { schema: 'private' }]) {
    assert.throws(() => managedStagingRoleReview({ ...config, ...patch }, guards));
  }
  assert.match(plan.bootstrap, /current_user<>'postgres' OR session_user<>'postgres'/);
  assert.match(plan.bootstrap, /NOT rolsuper AND rolcreaterole AND rolbypassrls/);
  assert.match(plan.bootstrap, /fresh Greenfield roles required/);
  assert.match(plan.bootstrap, /CREATE ROLE greenfield_app LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD NULL;/);
  assert.equal(plan.applicationPasswordEnabled, false);
});

test('temporary owner transfer grants are bounded and only the operator-owned grant is removed', () => {
  const plan = managedStagingRoleReview(config, guards);
  const grants = [...plan.guards.matchAll(/^GRANT greenfield_report_card_authority_owner TO postgres WITH (ADMIN FALSE|INHERIT FALSE|SET TRUE) GRANTED BY postgres;$/gm)];
  assert.equal(grants.length, 3);
  const transfers = [...plan.ownership.matchAll(/OWNER TO greenfield_report_card_authority_owner;/g)];
  assert.equal(transfers.length, 5);
  assert.doesNotMatch(plan.guards, /OWNER TO greenfield_report_card_authority_owner;/);
  assert.ok(transfers.at(-1).index < plan.ownership.indexOf('REVOKE CREATE ON SCHEMA public'));
  assert.match(plan.ownership, /REVOKE greenfield_report_card_authority_owner FROM postgres GRANTED BY postgres;/);
  assert.doesNotMatch(plan.bootstrap + plan.guards + plan.verify, /GRANT postgres TO|ALTER ROLE postgres|REVOKE greenfield_report_card_authority_owner FROM postgres;/);
  assert.throws(() => managedStagingRoleReview(config, guards.replace('OWNER TO greenfield_report_card_authority_owner;', 'OWNER TO postgres;')));
  assert.deepEqual(managedStagingRoleReview(config, guards.replaceAll('\n', '\r\n')), plan);
});

test('postcondition permits exactly bootstrap-owned administrator edges and one application SET-only edge', () => {
  const { verify } = managedStagingRoleReview(config, guards);
  assert.match(verify, /unexpected incoming memberships/);
  assert.match(verify, /m\.admin_option AND NOT m\.set_option AND NOT m\.inherit_option AND g\.rolsuper/);
  assert.match(verify, /application role graph is not SET-only/);
  assert.match(verify, /has_schema_privilege\('greenfield_report_card_authority_owner','public','CREATE'\)/);
  const plan = managedStagingRoleReview(config, guards);
  assert.match(plan.guards, /BEGIN ATOMIC\n SELECT auth\.uid\(\);\nEND;/);
  assert.match(plan.guards, /verified_auth_id uuid := public\.report_card_request_auth_uid\(\);/);
  assert.doesNotMatch(plan.guards, /GRANT USAGE ON SCHEMA public, auth|GRANT EXECUTE ON FUNCTION auth\.uid/);
  assert.match(verify, /p\.prosqlbody IS NOT NULL/);
  assert.match(verify, /d\.refobjid='auth.uid\(\)'::pg_catalog\.regprocedure/);
  assert.match(verify, /authority owner unexpectedly has provider schema access/);
  const probe = managedStagingAuthBindingProbe();
  assert.match(probe, /^SET LOCAL ROLE greenfield_report_card_authority_owner;/);
  assert.match(probe, /EXCEPTION WHEN insufficient_privilege THEN denied := true/);
  assert.match(probe, /fictional JSON request/);
  assert.match(probe, /missing identity did not fail closed/);
  assert.match(probe, /SET LOCAL ROLE postgres;$/);
  assert.doesNotMatch(probe, /\b(?:GRANT|CREATE|ALTER|INSERT|UPDATE|DELETE|COMMIT)\b/);
});

test('managed composition hashes bootstrap and final verification inside the same transaction', () => {
  const sources = { dependencies: read('docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql'), guards,
    proposalStatements: ['CREATE TABLE public."report_cards" (id uuid PRIMARY KEY)'] };
  const result = assembleStagingReportReview(config, sources);
  assert.deepEqual(result.phases.map(p => p.name), ['managed-bootstrap', 'dependencies', 'proposal', 'guards', 'policy', 'managed-access', 'managed-ownership', 'managed-verification']);
  assert.equal([...result.sql.matchAll(/^BEGIN;$/gm)].length, 1);
  assert.equal([...result.sql.matchAll(/^COMMIT;$/gm)].length, 1);
  assert.ok(result.sql.indexOf('CREATE ROLE greenfield_app') < result.sql.indexOf('-- Phase: dependencies'));
  const ownerPhase = result.sql.indexOf('-- Phase: managed-ownership');
  for (const statement of result.sql.matchAll(/^(?:GRANT|REVOKE) [^\n]*ON FUNCTION [^\n]+/gm)) assert.ok(statement.index < ownerPhase);
  assert.ok(result.sql.lastIndexOf('CREATE TRIGGER ') < ownerPhase);
  assert.ok(result.sql.indexOf('REVOKE greenfield_report_card_authority_owner FROM postgres GRANTED BY postgres') > ownerPhase);
  assert.ok(result.sql.indexOf('-- Phase: managed-verification') < result.sql.lastIndexOf('COMMIT;'));
  assert.equal(result.sha256, createHash('sha256').update(result.sql).digest('hex'));
  assert.throws(() => assembleStagingReportReview({ ...config, roleAdministration: 'unknown' }, sources));
  const access = managedStagingRoleReview(config, guards).access;
  assert.equal([...access.matchAll(/^REVOKE ALL ON TABLE /gm)].length, 21);
  assert.equal([...access.matchAll(/^REVOKE ALL ON FUNCTION /gm)].length, 13);
  assert.match(access, /REVOKE ALL ON FUNCTION public\.report_card_request_auth_uid\(\) FROM PUBLIC,anon,authenticated,service_role,greenfield_app,greenfield_report_card_runtime;/);
  assert.doesNotMatch(access, /REVOKE ALL ON TABLE public\.(?:schools|memberships|admissions|guardians)\b|ALTER DEFAULT PRIVILEGES/);
  assert.match(access, /FROM PUBLIC,anon,authenticated,service_role/);
  assert.match(access, /has_any_column_privilege/);
  assert.match(access, /role_name='authenticated' AND object_name='public.resolve_report_card_actor\(\)'/);
});

test('fixed offline exporter writes exclusive review files without a database or application enablement', () => {
  const source = read('scripts/report-card-staging-review-export.mjs');
  assert.match(source, /buildStagingReportInstallationReview/);
  assert.match(source, /mkdirSync\(directory\)/);
  assert.match(source, /changedSource\.trim\(\)/);
  assert.equal([...source.matchAll(/flag: 'wx'/g)].length, 2);
  assert.match(source, /schoolRowIncluded: false/);
  assert.match(source, /databaseExecutionPerformed: false/);
  assert.doesNotMatch(source, /process\.env|postgres\(|\.unsafe\(|getDatabase|DATABASE_URL/);
});
