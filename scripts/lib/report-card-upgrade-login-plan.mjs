// Pure, disposable-only LOGIN setup/cleanup strings. Secrets are supplied by the
// opted-in harness and must never be logged, saved to files or returned to a client.
import { disposableLoginPlan } from './disposable-login-plan.mjs';
import { upgradeFixtureSchema } from './report-card-upgrade-plan.mjs';
const databasePattern = /^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/;
const quote = name => '"' + name + '"';
export function upgradeLoginSetupPlan(schema, databaseName, password) {
  upgradeFixtureSchema(schema);
  if (typeof databaseName !== 'string' || !databasePattern.test(databaseName) || typeof password !== 'string' || !/^[a-f0-9]{64}$/.test(password)) throw Error('Generated local disposable login configuration required');
  const plan = disposableLoginPlan(schema);
  const statements = ['CREATE ROLE ' + quote(plan.login) + " LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '" + password + "'",
    'GRANT CONNECT ON DATABASE ' + quote(databaseName) + ' TO ' + quote(plan.login)];
  for (const role of plan.roles) for (const option of ['SET TRUE', 'INHERIT FALSE', 'ADMIN FALSE']) statements.push('GRANT ' + quote(role) + ' TO ' + quote(plan.login) + ' WITH ' + option);
  return { ...plan, statements };
}
export function upgradeLoginCleanupPlan(schema, databaseName, securityCommitted) {
  const q = upgradeFixtureSchema(schema);
  if (typeof databaseName !== 'string' || !databasePattern.test(databaseName) || typeof securityCommitted !== 'boolean') throw Error('Invalid disposable cleanup evidence');
  const login = disposableLoginPlan(schema).login;
  const roles = [login, schema + '_authority_owner', schema + '_reader', schema + '_writer'];
  return {
    roles,
    statements: ['DROP SCHEMA ' + q + ' CASCADE', ...(securityCommitted ? [
      'REVOKE CONNECT ON DATABASE ' + quote(databaseName) + ' FROM ' + quote(login),
      ...roles.map(role => 'DROP ROLE ' + quote(role)),
    ] : [])],
  };
}
