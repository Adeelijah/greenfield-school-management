// Offline: actual entry, bridge, parser, boundary and writers; recorder SQL only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openUpgradeRequestFixture } from './lib/report-card-upgrade-request-loader.mjs';

const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const schema = 'rc_it_0123456789abcdef';
const row = n => ({ auth_user_id: id(n), school_user_id: id(n + 10), membership_id: id(n + 20), school_id: id(90), role: 'teacher', status: 'active', final_primary_year: 5, school_user_count: 1, active_membership_count: 1 });
const command = () => ({ action: 'create', operationKey: 'request-fixture', studentId: id(40), enrollmentId: id(41), classId: id(42), sessionId: id(43), termId: id(44) });
const config = { mode: 'disposable-fixture', schema, schoolId: id(90), writerRole: schema + '_writer' };
const transport = (n, events) => ({
  async getUser() { await new Promise(setImmediate); events.push('auth:' + n); return { data: { user: { id: id(n) } }, error: null }; },
  async rpc(...args) { assert.deepEqual(args, ['resolve_report_card_actor']); events.push('rpc:' + n); return { data: [row(n)], error: null }; },
});

test('real entry rejects injected authority before controlled SDK or SQL', async () => {
  const fixture = await openUpgradeRequestFixture();
  try {
    const execute = fixture.create({ begin() { throw Error('SQL must not run'); } }, config);
    await fixture.withRequest({ getUser() { throw Error('SDK must not run'); }, rpc() { throw Error('RPC must not run'); } }, async () => {
      for (const key of ['schoolId', 'role', 'authUserId', 'membershipId', 'verifiedIdentity']) assert.deepEqual(await execute({ ...command(), [key]: id(99) }), { ok: false, code: 'invalid' });
    });
  } finally { fixture.close(); }
});

test('missing controlled transport and provider/RPC errors fail before command SQL', async () => {
  const fixture = await openUpgradeRequestFixture();
  try {
    let begins = 0;
    const execute = fixture.create({ begin() { begins++; throw Error('SQL must not run'); } }, config);
    assert.deepEqual(await execute(command()), { ok: false, code: 'forbidden' });
    for (const supplied of [
      { async getUser() { throw Error('private provider failure'); }, async rpc() { throw Error('Unexpected RPC'); } },
      { async getUser() { return { data: { user: null }, error: null }; }, async rpc() { throw Error('Unexpected RPC'); } },
      { async getUser() { return { data: { user: { id: id(1) } }, error: null }; }, async rpc() { return { data: null, error: Error('private RPC failure') }; } },
    ]) assert.deepEqual(await fixture.withRequest(supplied, () => execute(command())), { ok: false, code: 'forbidden' });
    assert.equal(begins, 0);
  } finally { fixture.close(); }
});

test('overlapping controlled requests retain distinct auth and RPC context', async () => {
  const fixture = await openUpgradeRequestFixture();
  try {
    const events = [], actors = [];
    const db = { async begin(work) { return work({ async unsafe(query, params) {
      if (query === 'SELECT current_user AS role') return [{ role: config.writerRole }];
      if (query.includes('fixture_source_write_gate')) return [{ id: 1 }];
      if (query.includes('lock_report_card_actor')) { actors.push(params[0]); return []; }
      throw Error('Unexpected recorder query');
    } }); } };
    const execute = fixture.create(db, config);
    const results = await Promise.all([1, 2].map(n => fixture.withRequest(transport(n, events), () => execute(command()))));
    assert.deepEqual(results, [{ ok: false, code: 'forbidden' }, { ok: false, code: 'forbidden' }]);
    assert.deepEqual(actors.sort(), [id(1), id(2)]);
    assert.deepEqual(events.sort(), ['auth:1', 'auth:2', 'rpc:1', 'rpc:2']);
  } finally { fixture.close(); }
});

test('loader retains the actual workflow writer and outer rollback after its SQL failure', async () => {
  const fixture = await openUpgradeRequestFixture();
  try {
    const events = [];
    const db = { async begin(work) {
      try {
        const result = await work({ async unsafe(query) {
          events.push(query);
          if (query === 'SELECT current_user AS role') return [{ role: config.writerRole }];
          if (query.includes('fixture_source_write_gate')) return [{ id: 1 }];
          if (query.includes('lock_report_card_actor')) return [row(1)];
          // Only the real domain writer issues this exclusive actor query.
          assert.match(query, /school_users.*FOR UPDATE/);
          throw Error('Injected recorder SQL failure');
        } });
        events.push('commit'); return result;
      } catch (error) { events.push('rollback'); throw error; }
    } };
    const execute = fixture.create(db, config);
    assert.deepEqual(await fixture.withRequest(transport(1, []), () => execute(command())), { ok: false, code: 'unavailable' });
    assert.ok(events.some(query => /school_users.*FOR UPDATE/.test(query)));
    assert.equal(events.at(-1), 'rollback'); assert.equal(events.includes('commit'), false);
  } finally { fixture.close(); }
});

test('request principal drift is denied by the actual complete boundary before writer queries', async () => {
  const fixture = await openUpgradeRequestFixture();
  try {
    let writerQueries = 0;
    const execute = fixture.create({ async begin(work) { return work({ async unsafe(query) {
      if (query === 'SELECT current_user AS role') return [{ role: config.writerRole }];
      if (query.includes('fixture_source_write_gate')) return [{ id: 1 }];
      if (query.includes('lock_report_card_actor')) return [{ ...row(1), membership_id: id(99) }];
      writerQueries++; throw Error('Writer must not run');
    } }); } }, config);
    assert.deepEqual(await fixture.withRequest(transport(1, []), () => execute(command())), { ok: false, code: 'forbidden' });
    assert.equal(writerQueries, 0);
  } finally { fixture.close(); }
});

test('loader refuses early teardown, drains requests and removes its global transport', async () => {
  const before = Reflect.ownKeys(globalThis).filter(key => typeof key === 'symbol' && Symbol.keyFor(key)?.startsWith('greenfield.upgrade-request.'));
  const fixture = await openUpgradeRequestFixture();
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const pending = fixture.withRequest(transport(1, []), () => hold);
  try { assert.throws(() => fixture.close(), /Drain controlled requests/); }
  finally { release(); await pending; fixture.close(); }
  fixture.close();
  await assert.rejects(fixture.withRequest(transport(1, []), () => null), /Invalid controlled request/);
  assert.deepEqual(Reflect.ownKeys(globalThis).filter(key => typeof key === 'symbol' && Symbol.keyFor(key)?.startsWith('greenfield.upgrade-request.')), before);
});
