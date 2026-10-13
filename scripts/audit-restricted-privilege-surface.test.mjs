import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRestrictedPrivilegeSurface } from './audit-restricted-privilege-surface.mjs';

function fakeSql(role = 'greenfield_app', options = {}) {
  const queries = [];
  const sql = (parts) => {
    const query = parts.join('?');
    queries.push(query);
    if (query.includes('current_user AS role_name')) return Promise.resolve([{ role_name: role, bypass_rls: role === 'greenfield_app' ? false : true }]);
    if (query.includes('pg_default_acl')) return Promise.resolve(options.defaults ?? []);
    if (query.includes('pg_proc')) return Promise.resolve(options.functions ?? []);
    if (query.includes('pg_namespace n')) return Promise.resolve(options.schemas ?? [{ schema_name: 'public', can_use: true, can_create: false }]);
    throw new Error('Unexpected query');
  };
  return { sql, queries };
}

test('catalog audit is read-only and starts with role identity', async () => {
  const { sql, queries } = fakeSql();
  const result = await auditRestrictedPrivilegeSurface(sql);
  assert.equal(result.role, 'greenfield_app');
  assert.equal(result.requiresReview, false);
  assert.equal(queries.length, 4);
  assert.ok(queries.every(q => /^\s*SELECT\b/.test(q)));
});

test('fails closed for unexpected privileged role before catalog inspection', async () => {
  const { sql, queries } = fakeSql('postgres');
  await assert.rejects(auditRestrictedPrivilegeSurface(sql), /expected non-bypass/);
  assert.equal(queries.length, 1);
});

test('flags default grants and executable security-definer functions for review', async () => {
  const fn = { schema_name: 'public', function_name: 'example', argument_types: '', security_definer: true, can_execute: true, public_execute: true };
  const result = await auditRestrictedPrivilegeSurface(fakeSql('greenfield_app', {
    defaults: [{ owner_role: 'postgres', schema_name: 'public', object_type: 'r', grantee_role: 'PUBLIC', privilege_type: 'SELECT', is_grantable: false }],
    functions: [fn],
  }).sql);
  assert.equal(result.requiresReview, true);
  assert.equal(result.publicSchemaFunctions.executableSecurityDefiner.length, 1);
});
