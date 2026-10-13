import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRestrictedUrl, validateConnectionEnvironment, verifyRestrictedConnection, classifyConnectionError } from './verify-restricted-db-connection.mjs';

const env = {
  MIGRATION_DATABASE_URL: 'postgresql://postgres:operator-secret@db.example.com:5432/postgres?sslmode=require',
  GREENFIELD_APP_DB_PASSWORD: 'x'.repeat(32),
};

test('restricted URL retains database target and replaces only role credentials', () => {
  const url = new URL(makeRestrictedUrl(env));
  assert.equal(url.username, 'greenfield_app');
  assert.equal(url.password, env.GREENFIELD_APP_DB_PASSWORD);
  assert.equal(url.hostname, 'db.example.com');
  assert.equal(url.searchParams.get('sslmode'), 'require');
});

test('missing password and migration URL fail closed', () => {
  assert.throws(() => validateConnectionEnvironment({ ...env, GREENFIELD_APP_DB_PASSWORD: '' }), /missing or too short/);
  assert.throws(() => validateConnectionEnvironment({ ...env, MIGRATION_DATABASE_URL: '' }), /required/);
});

function mockSql(identityRole = 'greenfield_app', bypass = false, memberships = []) {
  const queries = [];
  const sql = (parts) => {
    const statement = parts.join('?');
    queries.push(statement);
    if (statement.includes('current_database()')) return Promise.resolve([{
      current_user: identityRole, session_user: identityRole, database_name: 'postgres',
      can_login: true, bypass_rls: bypass, superuser: false,
    }]);
    if (statement.includes('pg_auth_members')) return Promise.resolve(memberships);
    if (statement.includes('has_schema_privilege')) return Promise.resolve([{ can_use_public: true, can_create_public: false }]);
    if (statement.includes('has_table_privilege')) return Promise.resolve([]);
    throw new Error('Unexpected query');
  };
  return { sql, queries };
}

test('verifies restricted identity using SELECT only', async () => {
  const { sql, queries } = mockSql();
  const report = await verifyRestrictedConnection(sql);
  assert.equal(report.verified, true);
  assert.equal(queries.length, 4);
  assert.ok(queries.every(q => /^\s*SELECT\b/.test(q)));
});

test('rejects privileged identity or inherited membership', async () => {
  assert.equal((await verifyRestrictedConnection(mockSql('postgres').sql)).verified, false);
  assert.equal((await verifyRestrictedConnection(mockSql('greenfield_app', true).sql)).verified, false);
  assert.equal((await verifyRestrictedConnection(mockSql('greenfield_app', false, [{ granted_role: 'pg_read_all_data' }]).sql)).verified, false);
});

test('diagnostics expose only safe categories and codes', () => {
  assert.deepEqual(classifyConnectionError({ code: '28P01', message: 'secret-password' }), {
    category: 'AUTHENTICATION_REJECTED', code: '28P01',
  });
  assert.deepEqual(classifyConnectionError({ code: 'ETIMEDOUT' }), {
    category: 'CONNECTION_TIMEOUT', code: 'ETIMEDOUT',
  });
  assert.deepEqual(classifyConnectionError({ code: 'unsafe secret text' }), {
    category: 'UNCLASSIFIED_CONNECTION_ERROR', code: 'UNAVAILABLE',
  });
});

test('classifies pooler XX000 errors without leaking server text', () => {
  const message = 'Tenant or user not found: greenfield_app.private-project-reference';
  const result = classifyConnectionError({ code: 'XX000', message });
  assert.deepEqual(result, { category: 'POOLER_TENANT_OR_USERNAME_NOT_FOUND', code: 'XX000' });
  assert.equal(JSON.stringify(result).includes('private-project-reference'), false);
  assert.equal(classifyConnectionError({ code: 'XX000', message: 'unexpected sensitive server details' }).category, 'POOLER_OR_SERVER_INTERNAL_ERROR');
});
