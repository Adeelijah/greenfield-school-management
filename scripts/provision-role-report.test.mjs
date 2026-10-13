import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectProvisioningState } from './provision-restricted-db-role.mjs';

test('missing restricted role is represented by roleDetails, not role name', async () => {
  const sql = (parts) => Promise.resolve(/SELECT rolname/.test(parts.join('?')) ? [] : []);
  const state = await inspectProvisioningState(sql);
  const report = { mode: 'DRY_RUN', role: 'greenfield_app', ...state };
  assert.equal(report.role, 'greenfield_app');
  assert.equal(report.roleDetails, null);
  assert.equal(report.exists, false);
});

test('existing role metadata does not overwrite the report role name', async () => {
  const sql = (parts) => Promise.resolve(/SELECT rolname/.test(parts.join('?')) ? [{
    rolname: 'greenfield_app', rolcanlogin: true, rolsuper: false, rolbypassrls: false,
  }] : []);
  const state = await inspectProvisioningState(sql);
  const report = { mode: 'DRY_RUN', role: 'greenfield_app', ...state };
  assert.equal(report.role, 'greenfield_app');
  assert.equal(report.roleDetails.rolname, 'greenfield_app');
  assert.equal(report.exists, true);
});
