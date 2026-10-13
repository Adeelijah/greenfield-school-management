import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectProvisioningState, provisionRole, validateProvisioningInput } from './provision-restricted-db-role.mjs';

function mockSql(existing = false, memberships = []) {
  const queries = [];
  const sql = (parts, ...values) => {
    const statement = parts.join('?');
    queries.push({ statement, values });
    if (/^\s*SELECT rolname/.test(statement)) return Promise.resolve(existing ? [{
      rolname: 'greenfield_app', rolcanlogin: true, rolsuper: false,
      rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false,
    }] : []);
    if (/^\s*SELECT parent\.rolname/.test(statement)) return Promise.resolve(memberships);
    if (/^\s*SELECT format\(/.test(statement)) return Promise.resolve([{ ddl: `CREATE ROLE greenfield_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'redacted'` }]);
    throw new Error('Unexpected SQL statement');
  };
  sql.unsafe = (statement) => {
    queries.push({ statement, values: [] });
    if (!/^CREATE ROLE greenfield_app LOGIN NOSUPERUSER/.test(statement)) throw new Error('Unexpected unsafe statement');
    existing = true;
    return Promise.resolve([]);
  };
  return { sql, queries };
}

test('dry-run inspection uses only SELECT', async () => {
  const { sql, queries } = mockSql();
  const state = await inspectProvisioningState(sql);
  assert.equal(state.exists, false);
  assert.equal(queries.length, 2);
  assert.ok(queries.every(q => /^\s*SELECT\b/.test(q.statement)));
});

test('refuses to overwrite an existing role', async () => {
  const { sql, queries } = mockSql(true);
  await assert.rejects(provisionRole(sql, 'x'.repeat(32)), /already exists/);
  assert.ok(queries.every(q => !/CREATE ROLE/.test(q.statement)));
});

test('rejects weak or missing operator password', () => {
  assert.throws(() => validateProvisioningInput({ MIGRATION_DATABASE_URL: 'postgres://x', GREENFIELD_APP_DB_PASSWORD: 'short' }), /24 characters/);
});

test('creates only a non-bypass login role after checks', async () => {
  const { sql, queries } = mockSql();
  const result = await provisionRole(sql, 'x'.repeat(32));
  assert.equal(result.verifiedFlags, true);
  const writes = queries.filter(q => /^\s*(CREATE|ALTER|GRANT|INSERT|UPDATE|DELETE)/.test(q.statement));
  assert.equal(writes.length, 1);
  assert.match(writes[0].statement, /CREATE ROLE greenfield_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD/);
  const formatQuery = queries.find(q => /^\s*SELECT format\(/.test(q.statement));
  assert.equal(formatQuery.values[0], 'x'.repeat(32));
});

test('rejects unexpected inherited role memberships after creation', async () => {
  const { sql } = mockSql(false, [{ granted_role: 'pg_read_all_data' }]);
  await assert.rejects(provisionRole(sql, 'x'.repeat(32)), /post-provisioning checks/);
});
