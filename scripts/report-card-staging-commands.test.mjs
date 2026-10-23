// Actual server entry, SDK bridge, runtime, boundary and domain adapters.
// Only authentication transport and SQL transport are recorders; no connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openUpgradeRequestFixture } from './lib/report-card-upgrade-request-loader.mjs';

const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const row = { auth_user_id: id(1), school_user_id: id(2), membership_id: id(3), school_id: id(4), role: 'admin', status: 'active', final_primary_year: 5, school_user_count: 1, active_membership_count: 1 };
const config = { mode: 'isolated-staging-review', schema: 'public', schoolId: id(4), loginRole: 'greenfield_app', commandRole: 'greenfield_report_card_runtime' };
const command = action => action === 'create' ? { action, operationKey: 'create', studentId: id(5), enrollmentId: id(6), classId: id(7), sessionId: id(8), termId: id(9) }
  : { action, operationKey: action, reportId: id(10), expectedVersion: 2, ...(['return', 'revoke'].includes(action) ? { reason: 'Review' } : {}), ...(action === 'revoke' ? { releaseId: id(11) } : {}) };
const link = role => ({ role, set: true, inherit: false, admin: false });
function recorder() {
  const events = [];
  const roles = ['greenfield_app', 'greenfield_report_card_runtime', 'greenfield_report_card_authority_owner'].map(name => ({ name, login: name === 'greenfield_app', inherit: false, superuser: false, bypass: false, creator: false, database: false, replication: false, owner: name.endsWith('owner'), memberships: name === 'greenfield_app' ? [link('greenfield_report_card_runtime')] : [], members: name === 'greenfield_report_card_runtime' ? [link('greenfield_app')] : [] }));
  const state = { authority: [{ ...row }], login: 'greenfield_app' };
  const db = { unsafe() { throw Error('SQL outside transaction'); }, async begin(work) {
    events.push('begin'); let role = 'greenfield_app';
    try {
      const result = await work({ async unsafe(sql, params) {
        events.push(sql); assert.doesNotMatch(sql, /rc_it_|fixture_source_write_gate/);
        if (sql.startsWith('SELECT session_user')) return [{ loginRole: state.login, executionRole: role }];
        if (sql.includes('pg_catalog.pg_roles r WHERE')) return roles;
        if (sql.startsWith('SET LOCAL ROLE')) { role = 'greenfield_report_card_runtime'; return []; }
        if (sql.includes('assessment_source_write_gate')) return [{ id: 1 }];
        if (sql.includes('lock_report_card_actor')) { assert.deepEqual(params, [id(1)]); return state.authority; }
        if (sql.includes('"school_users"')) return [{ id: id(2), authUserId: id(1) }];
        if (sql.includes('"schools"')) return [{ id: id(4), finalPrimaryYear: 5 }];
        if (sql.includes('"memberships"') && sql.includes('WHERE user_id=')) return [{ id: id(3), schoolId: id(4), userId: id(2), role: state.authority[0].role, status: 'active' }];
        if (sql.startsWith('SELECT pg_catalog.pg_advisory_xact_lock')) return [];
        if (/"(?:report_cards|report_card_operation_receipts|assessment_scopes)"/.test(sql)) return [];
        throw Error('Unexpected recorder SQL: ' + sql);
      } });
      events.push('commit'); return result;
    } catch (error) { events.push('rollback'); throw error; }
  } };
  return { db, events, state };
}
const transport = { async getUser() { return { data: { user: { id: id(1) } }, error: null }; }, async rpc(...args) {
  assert.deepEqual(args, ['resolve_report_card_actor']); return { data: [{ ...row }], error: null };
} };

test('staging server rejects forged body authority and school mismatch before any transaction', async () => {
  const loader = await openUpgradeRequestFixture();
  try {
    const f = recorder(), execute = loader.createStaging(f.db, config);
    for (const key of ['schoolId', 'role', 'schema', 'verifiedIdentity']) assert.deepEqual(await execute({ ...command('approve'), [key]: id(99) }), { ok: false, code: 'invalid' });
    await loader.withRequest({ ...transport, async rpc() { return { data: [{ ...row, school_id: id(99) }], error: null }; } }, async () => {
      assert.deepEqual(await execute(command('approve')), { ok: false, code: 'forbidden' });
    });
    assert.equal(f.events.length, 0);
  } finally { loader.close(); }
});

test('all seven actual staging dispatch paths share one exact-role transaction and roll back missing resources', async () => {
  const loader = await openUpgradeRequestFixture();
  try {
    for (const action of ['create', 'submit', 'return', 'reopen', 'approve', 'publish', 'revoke']) {
      const f = recorder(), execute = loader.createStaging(f.db, config);
      if (action === 'submit') f.state.authority[0].role = 'teacher';
      const request = { ...transport, async rpc() { return { data: [{ ...f.state.authority[0] }], error: null }; } };
      const result = await loader.withRequest(request, () => execute(command(action)));
      assert.equal(result.ok, false, action); assert.deepEqual(Object.keys(result).sort(), ['code', 'ok']);
      assert.equal(f.events.filter(e => e === 'begin').length, 1, action);
      assert.equal(f.events.at(-1), 'rollback', action);
      assert.ok(f.events.some(e => e.includes(action === 'create' ? '"assessment_scopes"' : '"report_cards"')), action);
      const gate = f.events.findIndex(e => e.includes('assessment_source_write_gate'));
      assert.ok(gate < f.events.findIndex(e => e.includes('lock_report_card_actor')), action);
    }
  } finally { loader.close(); }
});

test('staging entry rechecks complete authority and exact login before domain receipt access', async () => {
  const loader = await openUpgradeRequestFixture();
  try {
    for (const mutation of ['ambiguous', 'drift', 'owner']) {
      const f = recorder();
      if (mutation === 'ambiguous') f.state.authority[0].active_membership_count = 2;
      if (mutation === 'drift') f.state.authority[0].membership_id = id(99);
      if (mutation === 'owner') f.state.login = 'postgres';
      const result = await loader.withRequest(transport, () => loader.createStaging(f.db, config)(command('approve')));
      assert.equal(result.ok, false); assert.equal(f.events.at(-1), 'rollback');
      assert.equal(f.events.some(e => e.includes('"report_cards"') || e.includes('"report_card_operation_receipts"')), false);
    }
  } finally { loader.close(); }
});

test('staging entry captures bootstrap configuration and fails provider errors without fallback', async () => {
  const loader = await openUpgradeRequestFixture();
  try {
    const f = recorder(), supplied = { ...config }, execute = loader.createStaging(f.db, supplied);
    supplied.schoolId = id(99); supplied.schema = 'other';
    const result = await loader.withRequest(transport, () => execute(command('approve')));
    assert.equal(result.ok, false); assert.ok(f.events.includes('begin'));
    const count = f.events.length;
    assert.deepEqual(await loader.withRequest({ ...transport, async getUser() { throw Error('Private auth error'); } }, () => execute(command('approve'))), { ok: false, code: 'forbidden' });
    assert.equal(f.events.length, count);
  } finally { loader.close(); }
});
