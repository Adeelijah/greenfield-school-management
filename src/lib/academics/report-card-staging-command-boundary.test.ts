import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit TS source extension for the offline Node runner.
import { executeStagingReportBoundary, type StagingReportRequestBinding } from './report-card-staging-command-boundary.ts';
// @ts-expect-error Explicit TS source extension for the offline Node runner.
import { stagingReportSessionQuery, stagingReportRoleQuery, createStagingReportRuntime } from './report-card-staging-runtime.ts';
import type { SqlClient, SqlDatabase } from './report-card-postgres-disposable-adapter';

const id = (n: number) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const binding = (): StagingReportRequestBinding => ({ authUserId: id(1), schoolUserId: id(2), membershipId: id(3), schoolId: id(4) });
const row = () => ({ auth_user_id: id(1), school_user_id: id(2), membership_id: id(3), school_id: id(4), role: 'admin', status: 'active', final_primary_year: 5, school_user_count: 1, active_membership_count: 1 });
function recorder() {
  const state = {
    session: [{ loginRole: 'greenfield_app', executionRole: 'greenfield_report_card_runtime' }],
    gate: [{ id: 1 }] as Record<string, unknown>[], authority: [row()] as Record<string, unknown>[],
    events: [] as string[], writes: [] as string[], begins: 0, onBegin: null as (() => void) | null,
  };
  const tx: SqlClient = { async unsafe(query, params) {
    state.events.push(query);
    if (query === stagingReportSessionQuery) return state.session;
    if (query.includes('assessment_source_write_gate')) return state.gate;
    if (query.includes('lock_report_card_actor')) { assert.deepEqual(params, [id(1)]); return state.authority; }
    if (query === 'write') { state.writes.push('write'); return []; }
    throw Error('private SQL failure');
  } };
  const runtime: ReturnType<typeof createStagingReportRuntime> = {
    scope: Object.freeze({ schema: 'public', schoolId: id(4) }), unsafe() { throw Error('No direct runtime SQL'); },
    async begin<T>(work: (connection: SqlClient) => Promise<T>): Promise<T> {
      state.begins++; state.onBegin?.(); const before = [...state.writes];
      try { const result = await work(tx); state.events.push('commit'); return result; }
      catch (error) { state.writes = before; state.events.push('rollback'); throw error; }
    },
  };
  return { state, runtime };
}

test('staging boundary rejects a foreign school or malformed principal before opening a transaction', async () => {
  for (const patch of [{ schoolId: id(99) }, { authUserId: 'forged' }, { membershipId: '' }]) {
    const { state, runtime } = recorder();
    assert.deepEqual(await executeStagingReportBoundary(runtime, { ...binding(), ...patch }, async () => ({ ok: true })), { ok: false, code: 'invalid' });
    assert.equal(state.begins, 0);
  }
});

test('staging boundary checks exact role, source and complete authority before one shared command transaction', async () => {
  const { state, runtime } = recorder();
  const outcome = await executeStagingReportBoundary(runtime, binding(), async (db, identity, authority) => {
    assert.deepEqual(await identity(), { authUserId: id(1) }); assert.equal(authority.membershipId, id(3));
    return db.begin(async tx => { await tx.unsafe('write'); return { ok: true, version: 1 }; });
  });
  assert.deepEqual(outcome, { ok: true, version: 1 }); assert.equal(state.begins, 1);
  assert.deepEqual(state.events, [stagingReportSessionQuery, 'SELECT id FROM public.assessment_source_write_gate WHERE id=1 FOR SHARE', 'SELECT * FROM public.lock_report_card_actor($1::uuid)', 'write', 'commit']);
});

test('owner/login execution and absent source gate never reach report work', async () => {
  for (const patch of [{ session: [{ loginRole: 'postgres', executionRole: 'greenfield_report_card_runtime' }] }, { session: [{ loginRole: 'greenfield_app', executionRole: 'greenfield_app' }] }, { gate: [] }]) {
    const { state, runtime } = recorder(); Object.assign(state, patch); let reached = false;
    assert.equal((await executeStagingReportBoundary(runtime, binding(), async () => { reached = true; return { ok: true }; })).ok, false);
    assert.equal(reached, false); assert.equal(state.events.at(-1), 'rollback');
  }
});

test('hidden membership, suspension and changed school/user/member bindings fail closed', async () => {
  for (const patch of [{ active_membership_count: 2 }, { status: 'suspended' }, { school_id: id(99) }, { school_user_id: id(99) }, { membership_id: id(99) }]) {
    const { state, runtime } = recorder(); state.authority = [{ ...row(), ...patch }];
    assert.deepEqual(await executeStagingReportBoundary(runtime, binding(), async () => ({ ok: true })), { ok: false, code: 'forbidden' });
    assert.deepEqual(state.writes, []);
  }
});

test('callback receives current locked role/configuration rather than request-time decisions', async () => {
  const { state, runtime } = recorder(); state.authority = [{ ...row(), role: 'teacher', final_primary_year: 6 }];
  const result = await executeStagingReportBoundary(runtime, binding(), async (_db, _identity, authority) => ({ ok: true, role: authority.role, finalYear: authority.finalPrimaryYear }));
  assert.deepEqual(result, { ok: true, role: 'teacher', finalYear: 6 });
});

test('failed callback outcome rolls back successful inner writes and preserves its bounded result', async () => {
  const { state, runtime } = recorder();
  const result = await executeStagingReportBoundary(runtime, binding(), async db => {
    await db.begin(tx => tx.unsafe('write')); return { ok: false, code: 'conflict' };
  });
  assert.deepEqual(result, { ok: false, code: 'conflict' }); assert.deepEqual(state.writes, []); assert.equal(state.events.at(-1), 'rollback');
});

test('caught command SQL errors poison the outer staging transaction', async () => {
  const { state, runtime } = recorder();
  const result = await executeStagingReportBoundary(runtime, binding(), async db => db.begin(async tx => {
    await tx.unsafe('write'); try { await tx.unsafe('failure'); } catch { /* Deliberately caught. */ } return { ok: true };
  }));
  assert.deepEqual(result, { ok: false, code: 'transaction_failed' }); assert.deepEqual(state.writes, []);
});

test('direct or nested command transaction misuse cannot be converted into a commit', async () => {
  for (const nested of [false, true]) {
    const { state, runtime } = recorder();
    const result = await executeStagingReportBoundary(runtime, binding(), async db => {
      try { if (nested) await db.begin(async () => db.begin(async () => ({ ok: true }))); else await db.unsafe('write'); } catch { /* Deliberately caught. */ }
      return { ok: true };
    });
    assert.deepEqual(result, { ok: false, code: 'transaction_failed' }); assert.equal(state.events.at(-1), 'rollback');
  }
});

test('expired staging command SQL/database leases cannot reach another pooled request', async () => {
  const { state, runtime } = recorder(); let connection: SqlClient | undefined, database: SqlDatabase | undefined;
  await executeStagingReportBoundary(runtime, binding(), async db => { database = db; await db.begin(async tx => { connection = tx; }); return { ok: true }; });
  const count = state.events.length;
  await assert.rejects(connection!.unsafe('write'), /Expired/);
  await assert.rejects(database!.begin(async () => ({ ok: true })), /Invalid/);
  assert.equal(state.events.length, count);
});

test('request binding is captured before transaction awaits and thrown errors stay private', async () => {
  const { state, runtime } = recorder(), supplied = binding(); state.onBegin = () => { supplied.authUserId = id(99); supplied.membershipId = id(99); };
  assert.deepEqual(await executeStagingReportBoundary(runtime, supplied, async () => { throw Error('private SQL detail'); }), { ok: false, code: 'transaction_failed' });
  assert.equal(state.events.at(-1), 'rollback');
  state.onBegin = null;
  assert.deepEqual(await executeStagingReportBoundary(runtime, binding(), async () => ({ ok: true })), { ok: true });
});

test('actual staging role adapter and command boundary compose into one physical transaction', async () => {
  let execution = 'greenfield_app', transactions = 0;
  const events: string[] = [];
  const link = (role: string) => ({ role, set: true, inherit: false, admin: false });
  const flags = { inherit: false, superuser: false, bypass: false, creator: false, database: false, replication: false };
  const catalog: Record<string, unknown>[] = [
    { ...flags, name: 'greenfield_app', login: true, owner: false, memberships: [link('greenfield_report_card_runtime')], members: [] },
    { ...flags, name: 'greenfield_report_card_runtime', login: false, owner: false, memberships: [], members: [link('greenfield_app')] },
    { ...flags, name: 'greenfield_report_card_authority_owner', login: false, owner: true, memberships: [], members: [] },
  ];
  const db: SqlDatabase = { unsafe() { throw Error('No direct SQL'); }, async begin<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
    transactions++;
    try { return await work({ async unsafe(query) {
      events.push(query);
      if (query === stagingReportSessionQuery) return [{ loginRole: 'greenfield_app', executionRole: execution }];
      if (query === stagingReportRoleQuery) return catalog;
      if (query === 'SET LOCAL ROLE "greenfield_report_card_runtime"') { execution = 'greenfield_report_card_runtime'; return []; }
      if (query.includes('assessment_source_write_gate')) return [{ id: 1 }];
      if (query.includes('lock_report_card_actor')) return [{ ...row(), role: 'teacher', final_primary_year: 6 }];
      if (query === 'write') return [];
      throw Error('Unexpected composition SQL');
    } }); } finally { execution = 'greenfield_app'; }
  } };
  const runtime = createStagingReportRuntime(db, { mode: 'isolated-staging-review', schema: 'public', schoolId: id(4), loginRole: 'greenfield_app', commandRole: 'greenfield_report_card_runtime' });
  const result = await executeStagingReportBoundary(runtime, binding(), async (scoped, _identity, actor) => scoped.begin(async tx => {
    await tx.unsafe('write'); return { ok: true, role: actor.role, finalYear: actor.finalPrimaryYear };
  }));
  assert.deepEqual(result, { ok: true, role: 'teacher', finalYear: 6 });
  assert.equal(transactions, 1); assert.equal(execution, 'greenfield_app');
  assert.ok(events.indexOf('SET LOCAL ROLE "greenfield_report_card_runtime"') < events.indexOf('SELECT id FROM public.assessment_source_write_gate WHERE id=1 FOR SHARE'));
  assert.ok(events.indexOf('SELECT * FROM public.lock_report_card_actor($1::uuid)') < events.indexOf('write'));
  assert.equal(events.at(-1), stagingReportSessionQuery);
});
