// Real server entry, SDK bridge, parser and complete transaction boundary.
// SDK, driver and domain writers are offline stubs; no credentials or connections.
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const urls = new Map([
  ['@/lib/academics/report-card-command-response', new URL('src/lib/academics/report-card-command-response.ts', root).href],
  ['@/server/auth/report-card-identity', new URL('src/server/auth/report-card-identity.ts', root).href],
  ['@/lib/academics/report-card-request-command', new URL('src/lib/academics/report-card-request-command.ts', root).href],
  ['@/lib/academics/report-card-complete-fixture-boundary', new URL('src/lib/academics/report-card-complete-fixture-boundary.ts', root).href],
  ['@/lib/academics/report-card-actor-authority', new URL('src/lib/academics/report-card-actor-authority.ts', root).href],
]);
const entryURL = new URL('src/server/academics/report-card-fixture-commands.ts', root).href;
const sources = new Set([entryURL, ...urls.values()]);
const key = Symbol.for('greenfield.report-card-command.offline-test');
const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const schema = 'rc_it_0123456789abcdef';
const row = { auth_user_id: id(1), school_user_id: id(2), membership_id: id(3), school_id: id(4), role: 'admin', status: 'active', final_primary_year: 5, school_user_count: 1, active_membership_count: 1 };
const config = () => ({ mode: 'disposable-fixture', schema, schoolId: row.school_id, writerRole: schema + '_writer' });
const command = action => action === 'create'
  ? { action, operationKey: 'key', studentId: id(5), enrollmentId: id(6), classId: id(7), sessionId: id(8), termId: id(9) }
  : { action, operationKey: 'key', reportId: id(10), expectedVersion: 2, ...(['return', 'revoke'].includes(action) ? { reason: 'Correction' } : {}), ...(action === 'revoke' ? { releaseId: id(11) } : {}) };
let state;
function reset() {
  state = { events: [], writes: [], role: schema + '_writer', locked: [{ ...row }], request: [{ ...row }], calls: [] };
  const tx = { unsafe: async (sql, params) => {
    state.events.push(sql);
    if (sql === 'SELECT current_user AS role') return [{ role: state.role }];
    if (sql.includes('fixture_source_write_gate')) return [{ id: 1 }];
    if (sql.includes('lock_report_card_actor')) { assert.deepEqual(params, [row.auth_user_id]); return state.locked; }
    if (sql === 'fixture write') { state.writes.push('write'); return []; }
    throw Error('Unexpected SQL');
  } };
  state.db = { unsafe() { throw Error('No SQL outside transaction'); }, async begin(work) {
    state.events.push('begin'); const before = [...state.writes];
    try { const result = await work(tx); state.events.push('commit'); return result; }
    catch (error) { state.writes = before; state.events.push('rollback'); throw error; }
  } };
  globalThis[key] = {
    client: async () => ({ auth: { getUser: async () => {
      state.events.push('getUser'); if (state.onAuth) await state.onAuth();
      if (state.authError) throw Error('secret provider error');
      return { data: { user: state.missingAuth ? null : { id: row.auth_user_id } }, error: null };
    } }, rpc: async (...args) => { state.events.push(['rpc', ...args]); return { data: state.request, error: null }; } }),
    writer: async (family, db, actualSchema, input, verified) => {
      state.calls.push({ family, input, identity: await verified() });
      assert.equal(actualSchema, schema);
      return db.begin(async connection => {
        await connection.unsafe('fixture write');
        if (state.writerError) throw Error('secret SQL error');
        return state.outcome ?? { ok: true, kind: 'applied', version: 3, reportId: id(10), stage: { create: 'draft', submit: 'submitted', return: 'returned', reopen: 'draft', approve: 'approved', publish: 'published', revoke: 'draft' }[input.action], privateDetail: 'never return' };
      });
    },
  };
}
reset();
const writerModule = (name, family) => `export const ${name}=(...args)=>globalThis[Symbol.for('greenfield.report-card-command.offline-test')].writer('${family}',...args);`;
const mocks = new Map([
  ['server-only', 'export {};'],
  ['drizzle-orm', 'export function sql(strings,...values){return {text:strings.join("?"),values};}'],
  ['@/lib/supabase/server', `export const createSupabaseServerClient=()=>globalThis[Symbol.for('greenfield.report-card-command.offline-test')].client();`],
  ['@/db/client', 'export function getDatabase(){throw Error("Application database must not load");}'],
  ['@/lib/academics/report-card-postgres-workflow-writer', writerModule('executeFixtureReportWorkflow', 'workflow')],
  ['@/lib/academics/report-card-postgres-canonical-writer', writerModule('executeFixtureCanonicalReportCommand', 'canonical')],
  ['@/lib/academics/report-card-postgres-revoke-writer', writerModule('executeFixtureReportRevocation', 'revoke')],
]);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (sources.has(context.parentURL)) {
      if (mocks.has(specifier)) return { url: 'greenfield-command-offline:' + encodeURIComponent(specifier), shortCircuit: true };
      if (urls.has(specifier)) return { url: urls.get(specifier), shortCircuit: true };
      if (specifier === './report-card-request-command.ts') return { url: urls.get('@/lib/academics/report-card-request-command'), shortCircuit: true };
      if (specifier === './report-card-actor-authority.ts') return { url: urls.get('@/lib/academics/report-card-actor-authority'), shortCircuit: true };
      throw Error('Unexpected command dependency: ' + specifier);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('greenfield-command-offline:')) return { format: 'module', source: mocks.get(decodeURIComponent(url.slice('greenfield-command-offline:'.length))), shortCircuit: true };
    if (sources.has(url)) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')), shortCircuit: true };
    return next(url, context);
  },
});
let factory;
try { ({ createVerifiedFixtureReportCommands: factory } = await import(entryURL)); } catch (error) { hooks.deregister(); throw error; }
beforeEach(reset);
after(() => { hooks.deregister(); delete globalThis[key]; });

test('runtime rejects application schema, school or role fallback before authentication', () => {
  for (const patch of [{ mode: 'production' }, { schema: 'public' }, { schoolId: 'school' }, { writerRole: 'postgres' }, { writerRole: schema + '_reader' }]) assert.throws(() => factory(state.db, { ...config(), ...patch }), /Invalid report command runtime/);
  assert.deepEqual(state.events, []);
});

test('rejects authority injection before SDK or transaction access', async () => {
  const run = factory(state.db, config());
  for (const key of ['schoolId', 'role', 'authUserId', 'membershipId', 'verifiedIdentity']) assert.deepEqual(await run({ ...command('submit'), [key]: 'forged' }), { ok: false, code: 'invalid' });
  assert.deepEqual(state.events, []);
});

test('missing or throwing auth and hidden membership ambiguity deny before database work', async () => {
  for (const patch of [{ missingAuth: true }, { authError: true }, { request: [{ ...row, active_membership_count: 2 }] }]) {
    reset(); Object.assign(state, patch);
    assert.deepEqual(await factory(state.db, config())(command('submit')), { ok: false, code: 'forbidden' });
    assert.equal(state.events.includes('begin'), false); assert.deepEqual(state.writes, []);
  }
});

test('configured school mismatch denies before transaction and runtime config is captured', async () => {
  const mutable = config(); const run = factory(state.db, mutable); mutable.schoolId = id(90); mutable.schema = 'public';
  assert.equal((await run(command('approve'))).ok, true);
  reset(); assert.deepEqual(await factory(state.db, { ...config(), schoolId: id(90) })(command('approve')), { ok: false, code: 'forbidden' });
  assert.equal(state.events.includes('begin'), false);
});

test('all actions dispatch after actual SDK and complete authority in one outer transaction', async () => {
  for (const action of ['create', 'submit', 'return', 'reopen', 'approve', 'publish', 'revoke']) {
    reset(); const result = await factory(state.db, config())(command(action));
    assert.equal(result.ok, true); assert.equal(result.action, action);
    assert.equal(state.calls[0].family, ['approve', 'publish'].includes(action) ? 'canonical' : action === 'revoke' ? 'revoke' : 'workflow');
    assert.deepEqual(state.calls[0].identity, { authUserId: row.auth_user_id });
    assert.deepEqual(state.events.slice(0, 4), ['getUser', ['rpc', 'resolve_report_card_actor'], 'begin', 'SELECT current_user AS role']);
    assert.equal(state.events.filter(event => event === 'begin').length, 1); assert.equal(state.events.at(-1), 'commit');
    assert.equal('privateDetail' in result, false);
  }
});

test('actual role, suspension, hidden ambiguity and principal drift deny before writers', async () => {
  for (const patch of [{ role: 'postgres' }, { role: schema + '_reader' }, { locked: [{ ...row, status: 'suspended' }] }, { locked: [{ ...row, active_membership_count: 2 }] }, { locked: [{ ...row, membership_id: id(90) }] }]) {
    reset(); Object.assign(state, patch);
    assert.deepEqual(await factory(state.db, config())(command('approve')), { ok: false, code: 'forbidden' });
    assert.deepEqual(state.calls, []); assert.equal(state.events.at(-1), 'rollback');
  }
});

test('copies request before authentication await and refreshes auth for every command', async () => {
  const input = command('return'); state.onAuth = async () => { input.reportId = id(90); input.reason = 'changed'; };
  const run = factory(state.db, config());
  assert.equal((await run(input)).reportId, id(10)); assert.equal(state.calls[0].input.reason, 'Correction');
  state.onAuth = null; state.missingAuth = true;
  assert.deepEqual(await run(command('return')), { ok: false, code: 'forbidden' }); assert.equal(state.calls.length, 1);
});

test('failed domain outcome rolls back inner writes and maps conflicts without private fields', async () => {
  state.outcome = { ok: false, code: 'stale_version', message: 'secret database detail' };
  assert.deepEqual(await factory(state.db, config())(command('approve')), { ok: false, code: 'conflict' });
  assert.deepEqual(state.writes, []); assert.equal(state.events.at(-1), 'rollback');
});

test('thrown writer failure rolls back and exposes only unavailable', async () => {
  state.writerError = true;
  assert.deepEqual(await factory(state.db, config())(command('publish')), { ok: false, code: 'unavailable' });
  assert.deepEqual(state.writes, []); assert.equal(state.events.at(-1), 'rollback');
});

test('malformed successful outcome rolls back instead of committing an invalid response', async () => {
  for (const outcome of [{ ok: true, kind: 'applied', stage: 'published', version: 3 }, { ok: true, kind: 'applied', stage: 'approved', version: 3, reportId: id(90) }, { ok: true, kind: 'applied', stage: 'approved', version: NaN }]) {
    reset(); state.outcome = outcome;
    assert.deepEqual(await factory(state.db, config())(command('approve')), { ok: false, code: 'unavailable' });
    assert.deepEqual(state.writes, []); assert.equal(state.events.at(-1), 'rollback');
  }
});

test('historical replay returns scalar result through current verified authority', async () => {
  state.outcome = { ok: true, kind: 'replay', stage: 'published', version: 4, snapshotId: id(12), privateDetail: 'hidden' };
  assert.deepEqual(await factory(state.db, config())(command('publish')), { ok: true, kind: 'replay', action: 'publish', reportId: id(10), version: 4, stage: 'published' });
  assert.equal(state.events.at(-1), 'commit');
});

test('unknown domain error and missing resource use safe public error vocabulary', async () => {
  for (const [privateCode, publicCode] of [['not_found', 'forbidden'], ['23505 secret SQL', 'unavailable'], ['invalid', 'invalid']]) {
    reset(); state.outcome = { ok: false, code: privateCode };
    assert.deepEqual(await factory(state.db, config())(command('submit')), { ok: false, code: publicCode });
    assert.deepEqual(state.writes, []);
  }
});
