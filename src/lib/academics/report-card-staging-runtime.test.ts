import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { createStagingReportRuntime, inspectStagingReportRoles, stagingReportRoleQuery, stagingReportSessionQuery, type StagingReportRuntimeConfig } from './report-card-staging-runtime.ts';
import type { SqlClient, SqlDatabase } from './report-card-postgres-disposable-adapter';

const config = (): StagingReportRuntimeConfig => ({ mode: 'isolated-staging-review', schema: 'public', schoolId: '00000000-0000-0000-0000-000000000001', loginRole: 'greenfield_app', commandRole: 'greenfield_report_card_runtime' });
const link = (role: string) => ({ role, set: true, inherit: false, admin: false });
type MembershipFixture = ReturnType<typeof link> & {
  grantor?: string; grantorSuperuser?: boolean; memberSuperuser?: boolean;
  memberCreator?: boolean; memberBypass?: boolean;
};
type RoleFixture = {
  name: string; login: boolean; inherit: boolean; superuser: boolean; bypass: boolean;
  creator: boolean; database: boolean; replication: boolean; owner: boolean;
  memberships: MembershipFixture[]; members: MembershipFixture[];
};
const roles = (): RoleFixture[] => [
  { name: 'greenfield_app', login: true, inherit: false, superuser: false, bypass: false, creator: false, database: false, replication: false, owner: false, memberships: [link('greenfield_report_card_runtime')], members: [] },
  { name: 'greenfield_report_card_runtime', login: false, inherit: false, superuser: false, bypass: false, creator: false, database: false, replication: false, owner: false, memberships: [], members: [link('greenfield_app')] },
  { name: 'greenfield_report_card_authority_owner', login: false, inherit: false, superuser: false, bypass: false, creator: false, database: false, replication: false, owner: true, memberships: [], members: [] },
];
const managedRoles = (): RoleFixture[] => roles().map(row => ({ ...row, members: [...row.members, {
  role: 'postgres', set: false, inherit: false, admin: true,
  grantor: 'bootstrap_superuser', grantorSuperuser: true,
  memberSuperuser: false, memberCreator: true, memberBypass: true,
}] }));
function recorder() {
  const state = { login: 'greenfield_app', role: 'greenfield_app', evidence: roles(), events: [] as string[], writes: [] as string[], transactions: 0, rejectSet: false };
  const tx: SqlClient = { async unsafe(query, params) {
    state.events.push(query);
    if (query === stagingReportSessionQuery) return [{ loginRole: state.login, executionRole: state.role }];
    if (query === stagingReportRoleQuery) { assert.deepEqual(params, ['greenfield_app', 'greenfield_report_card_runtime', 'greenfield_report_card_authority_owner']); return state.evidence; }
    if (query === 'SET LOCAL ROLE "greenfield_report_card_runtime"') { if (state.rejectSet) throw Error('Role denied'); state.role = 'greenfield_report_card_runtime'; return []; }
    if (query === 'write') { state.writes.push('write'); return []; }
    if (query === 'failure') throw Error('Injected SQL failure');
    if (query === 'RESET ROLE') { state.role = state.login; return []; }
    throw Error('Unexpected recorder query');
  } };
  const db: SqlDatabase = { unsafe() { throw Error('SQL outside transaction'); }, async begin<T>(work: (connection: SqlClient) => Promise<T>): Promise<T> {
    state.transactions++; const before = [...state.writes], incomingRole = state.role;
    try { const result = await work(tx); state.events.push('commit'); return result; }
    catch (error) { state.writes = before; state.events.push('rollback'); throw error; }
    finally { state.role = incomingRole; }
  } };
  return { state, db };
}

test('staging runtime requires explicit fixed mapping and never creates a default connection', () => {
  const { db, state } = recorder();
  for (const patch of [{ mode: 'production' }, { schema: 'rc_it_0123456789abcdef' }, { loginRole: 'postgres' }, { commandRole: 'greenfield_app' }, { schoolId: 'school' }]) {
    assert.throws(() => createStagingReportRuntime(db, { ...config(), ...patch } as StagingReportRuntimeConfig));
  }
  assert.deepEqual(state.events, []); assert.equal(state.transactions, 0);
});

test('role catalog rejects privileged flags and missing, duplicate or malformed evidence', () => {
  assert.equal(inspectStagingReportRoles(roles()), true);
  for (const value of [null, [], roles().slice(0, 2), [roles()[0], roles()[0], roles()[2]]]) assert.equal(inspectStagingReportRoles(value), false);
  for (let index = 0; index < 3; index++) for (const flag of ['superuser', 'bypass', 'creator', 'database', 'replication', 'inherit']) {
    const changed = roles(); Object.assign(changed[index]!, { [flag]: true }); assert.equal(inspectStagingReportRoles(changed), false);
  }
  const malformed = roles(); Object.assign(malformed[0]!, { owner: 'false' }); assert.equal(inspectStagingReportRoles(malformed), false);
});

test('both membership directions must be SET-only and no path reaches an authority owner or other role', () => {
  for (const index of [0, 1]) for (const patch of [{ set: false }, { inherit: true }, { admin: true }, { role: 'postgres' }]) {
    const changed = roles(); const key = index === 0 ? 'memberships' : 'members'; Object.assign(changed[index]![key][0]!, patch);
    assert.equal(inspectStagingReportRoles(changed), false);
  }
  for (const [index, key] of [[0, 'members'], [1, 'memberships'], [2, 'members'], [2, 'memberships']] as const) {
    const changed = roles(); changed[index]![key].push(link('other')); assert.equal(inspectStagingReportRoles(changed), false);
  }
  for (const index of [0, 1]) { const changed = roles(); changed[index]!.owner = true; assert.equal(inspectStagingReportRoles(changed), false); }
});

test('transaction verifies login/catalog before role selection and checks execution role before commit', async () => {
  const { db, state } = recorder();
  const supplied = config(), runtime = createStagingReportRuntime(db, supplied);
  supplied.schoolId = '00000000-0000-0000-0000-000000000099';
  assert.equal(Object.isFrozen(runtime.scope), true); assert.equal(runtime.scope.schoolId, config().schoolId);
  assert.equal(await runtime.begin(async tx => { await tx.unsafe('write'); return 7; }), 7);
  assert.deepEqual(state.events, [stagingReportSessionQuery, stagingReportRoleQuery, 'SET LOCAL ROLE "greenfield_report_card_runtime"', stagingReportSessionQuery, 'write', stagingReportSessionQuery, 'commit']);
  assert.equal(state.role, 'greenfield_app');
});

test('owner login, preselected execution role, unsafe role evidence or SET denial cannot reach work', async () => {
  for (const patch of [{ login: 'postgres' }, { role: 'greenfield_report_card_runtime' }, { rejectSet: true }, { evidence: [] }]) {
    const { db, state } = recorder(); Object.assign(state, patch); let reached = false;
    await assert.rejects(createStagingReportRuntime(db, config()).begin(async () => { reached = true; }));
    assert.equal(reached, false); assert.equal(state.events.at(-1), 'rollback');
  }
});

test('caught SQL error still rolls back successful-looking callback and expires captured lease', async () => {
  const { db, state } = recorder(); let captured: SqlClient | undefined;
  const runtime = createStagingReportRuntime(db, config());
  await assert.rejects(runtime.begin(async tx => {
    captured = tx; await tx.unsafe('write');
    try { await tx.unsafe('failure'); } catch { /* Deliberately caught by caller. */ }
    return { ok: true };
  }));
  assert.deepEqual(state.writes, []); assert.equal(state.events.at(-1), 'rollback');
  const count = state.events.length;
  await assert.rejects(captured!.unsafe('write'), /Expired/); assert.equal(state.events.length, count);
});

test('thrown callback or unexpected role reset rolls back writes and the next transaction starts as login', async () => {
  for (const reset of [false, true]) {
    const { db, state } = recorder(); const runtime = createStagingReportRuntime(db, config());
    await assert.rejects(runtime.begin(async tx => { await tx.unsafe('write'); if (reset) await tx.unsafe('RESET ROLE'); else throw Error('Caller failed'); }));
    assert.deepEqual(state.writes, []); assert.equal(state.role, 'greenfield_app');
    assert.equal(await runtime.begin(async () => 'retry'), 'retry');
  }
});

test('direct SQL and expired successful leases cannot reuse a pooled report transaction', async () => {
  const { db, state } = recorder(); const runtime = createStagingReportRuntime(db, config()); let captured: SqlClient | undefined;
  assert.throws(() => runtime.unsafe('write'), /requires its runtime transaction/);
  await runtime.begin(async tx => { captured = tx; await tx.unsafe('write'); });
  const count = state.events.length;
  await assert.rejects(captured!.unsafe('write'), /Expired/);
  assert.equal(state.events.length, count); assert.equal(state.transactions, 1);
});

test('managed staging requires explicit opt-in and one proven administrator edge per role', () => {
  const mode = 'supabase-postgres-createrole';
  assert.equal(inspectStagingReportRoles(managedRoles()), false);
  assert.equal(inspectStagingReportRoles(managedRoles(), mode), true);
  assert.equal(inspectStagingReportRoles(roles(), mode), false);
  for (let index = 0; index < 3; index++) {
    for (const patch of [{ role: 'other' }, { set: true }, { inherit: true }, { admin: false },
      { grantor: '' }, { grantorSuperuser: false }, { memberSuperuser: true }, { memberCreator: false }, { memberBypass: false }]) {
      const changed = managedRoles(); Object.assign(changed[index]!.members.at(-1)!, patch);
      assert.equal(inspectStagingReportRoles(changed, mode), false);
    }
    const duplicate = managedRoles(); duplicate[index]!.members.push({ ...duplicate[index]!.members.at(-1)! });
    assert.equal(inspectStagingReportRoles(duplicate, mode), false);
    const missing = managedRoles(); delete missing[index]!.members.at(-1)!.grantorSuperuser;
    assert.equal(inspectStagingReportRoles(missing, mode), false);
  }
});

test('managed administrator allowance never permits application elevation or extra ownership', () => {
  for (let index = 0; index < 3; index++) {
    const changed = managedRoles(); changed[index]!.memberships.push(link('postgres'));
    assert.equal(inspectStagingReportRoles(changed, 'supabase-postgres-createrole'), false);
    for (const flag of ['superuser', 'bypass', 'creator', 'database', 'replication', 'inherit']) {
      const privileged = managedRoles(); Object.assign(privileged[index]!, { [flag]: true });
      assert.equal(inspectStagingReportRoles(privileged, 'supabase-postgres-createrole'), false);
    }
  }
  for (const index of [0, 1]) {
    const owned = managedRoles(); owned[index]!.owner = true;
    assert.equal(inspectStagingReportRoles(owned, 'supabase-postgres-createrole'), false);
  }
});

test('runtime captures managed selection and rejects temporary SET access before reaching work', async () => {
  const { state, db } = recorder(); state.evidence = managedRoles();
  const supplied = { ...config(), roleAdministration: 'supabase-postgres-createrole' as const };
  const runtime = createStagingReportRuntime(db, supplied);
  Object.assign(supplied, { roleAdministration: 'isolated-strict' });
  assert.equal(await runtime.begin(async () => 'managed'), 'managed');
  state.evidence[2]!.members.at(-1)!.set = true;
  let reached = false;
  await assert.rejects(runtime.begin(async () => { reached = true; }));
  assert.equal(reached, false);
  assert.throws(() => createStagingReportRuntime(db, { ...config(), roleAdministration: 'arbitrary' } as unknown as StagingReportRuntimeConfig));
});
