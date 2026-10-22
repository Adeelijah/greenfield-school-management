// Review-only composition for an already upgraded/guarded generated fixture.
// Pure SQL strings; never a connection factory or production installation bundle.
import { fixtureSecurityPlan } from './assessment-disposable-security-plan.mjs';
import { fixtureRolePreflightPlan } from './assessment-disposable-role-preflight.mjs';
import { completeFixtureAuthorityDDL } from './report-card-complete-fixture-ddl.mjs';
import { reportReleaseGuardDDL } from './report-release-disposable-guards.mjs';
import { upgradeFixtureSchema } from './report-card-upgrade-plan.mjs';

export function reportUpgradeSecurityPlan(schema, schoolId, authorityReview) {
  const quoted = upgradeFixtureSchema(schema);
  const security = fixtureSecurityPlan(schema, schoolId);
  const complete = completeFixtureAuthorityDDL(schema, authorityReview);
  const existingRelease = new Set(reportReleaseGuardDDL(schema).statements);
  // Upgrade guard phase already installed these exact release guards. Preserve
  // them; recreating the function/triggers would abort the installation.
  const roleStatements = Object.values(security.roles).map(name => 'CREATE ROLE "' + name + '" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION');
  return {
    schema, schoolId, roles: { ...security.roles, authorityOwner: complete.owner },
    rlsTargets: [...security.targets],
    // These four legacy modules and internal revision claims receive no grant.
    // fixtureSecurityPlan revokes ALL TABLES, not just its selected RLS targets.
    excludedRuntimeTables: ['admissions', 'audit_events', 'guardians', 'student_guardians', 'fixture_source_write_claims'],
    requiredRelations: [...security.targets, 'fixture_source_write_claims', 'admissions', 'audit_events', 'guardians', 'student_guardians'],
    requiredExistingFunctions: ['fixture_lock_source_write', 'fixture_mark_source_scope', 'fixture_invalidate_source_rows', 'fixture_reject_source_truncate', 'fixture_invalidate_parent_rows', 'fixture_upgrade_reject_history', 'fixture_guard_release_history'],
    rolePreflight: fixtureRolePreflightPlan(schema),
    statements: [...roleStatements, ...security.statements.filter(statement => !existingRelease.has(statement)), ...complete.statements],
    // The future runner must inspect the installed guarded layout before any
    // role creation, and again verify policies/helper ACLs and role attributes.
    layoutQuery: `SELECT 'relation' AS kind,c.relname AS name FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r'
      UNION ALL SELECT 'function' AS kind,p.proname AS name FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1`,
    layoutParameters: [schema],
    lockedRoleQuery: 'SELECT current_user AS role',
    sourceReadGate: 'SELECT id FROM ' + quoted + '."fixture_source_write_gate" WHERE id=1 FOR SHARE',
  };
}

/** Layout presence gate only; it does not attest to function bodies, privileges,
 * RLS or authenticated identity. Those require actual isolated execution tests.
 */
export function inspectUpgradeSecurityLayout(plan, rows) {
  if (!plan || !Array.isArray(plan.requiredRelations) || !Array.isArray(plan.requiredExistingFunctions) || !Array.isArray(rows)) return { ok: false, code: 'invalid_layout' };
  const key = row => row?.kind + ':' + row?.name;
  const actual = new Set();
  for (const row of rows) {
    if (!row || !['relation', 'function'].includes(row.kind) || typeof row.name !== 'string' || !row.name || actual.has(key(row))) return { ok: false, code: 'invalid_layout' };
    actual.add(key(row));
  }
  if (plan.requiredRelations.some(name => !actual.has('relation:' + name)) || plan.requiredExistingFunctions.some(name => !actual.has('function:' + name))) return { ok: false, code: 'missing_prerequisite' };
  return { ok: true };
}
