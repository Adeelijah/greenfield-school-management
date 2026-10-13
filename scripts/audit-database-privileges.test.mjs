import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectDatabasePrivileges, tenantTables } from './audit-database-privileges.mjs';

test('audits the complete 12-table tenant schema', () => {
  assert.equal(tenantTables.length, 12);
  assert.ok(tenantTables.includes('students'));
  assert.ok(tenantTables.includes('guardians'));
});

test('audit runs five read-only catalog queries', async () => {
  const queries = [];
  const sql = (strings, ...values) => {
    const query = strings.join('?');
    queries.push({ query, values });
    return Promise.resolve([]);
  };
  const report = await inspectDatabasePrivileges(sql);
  assert.equal(report.mode, 'READ_ONLY_PRIVILEGE_AUDIT');
  assert.equal(queries.length, 5);
  for (const { query } of queries) {
    assert.match(query, /^SELECT\b/i);
    assert.doesNotMatch(query, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE)\s+(TABLE|ROLE|ON|FROM|INTO)\b/i);
  }
});

test('reports inherited roles and effective privileges without assuming safety', async () => {
  const sql = () => Promise.resolve([]);
  const report = await inspectDatabasePrivileges(sql);
  assert.ok('memberships' in report);
  assert.ok('effectiveTablePrivileges' in report);
  assert.ok('effectiveSchemaPrivileges' in report);
  assert.match(report.note, /additional review/);
});
