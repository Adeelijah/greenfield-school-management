// Actual server entry and writers, controlled external auth transport only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openUpgradeRequestFixture } from './report-card-upgrade-request-loader.mjs';

export async function probeUpgradeServerEntry({ db, asWriter, schema, schoolId, admin, teacher, selector, pupil, assignmentId, history }) {
  const table = name => '"' + schema + '"."' + name + '"';
  const fixture = await openUpgradeRequestFixture();
  const config = { mode: 'disposable-fixture', schema, schoolId, writerRole: schema + '_writer' };
  const events = [];
  const invoke = (actor, command, options = {}) => {
    const execute = fixture.create({ begin: work => {
      events.push('command-begin');
      return asWriter(tx => work({ unsafe: async (query, params) => {
        const result = await tx.unsafe(query, params);
        if (options.failReceipt && query.startsWith('INSERT INTO ' + table('report_card_operation_receipts'))) throw Error('Injected server-entry post-receipt failure');
        return result;
      } }));
    } }, { ...config, ...options.config });
    return fixture.withRequest({
      async getUser() {
        events.push('getUser');
        if (options.authThrow) throw Error('Private controlled provider error');
        if (options.onAuth) options.onAuth();
        return { data: { user: options.noUser ? null : { id: actor.authUserId } }, error: null };
      },
      async rpc(...args) {
        events.push('rpc'); assert.deepEqual(args, ['resolve_report_card_actor']);
        if (options.rpcError) return { data: null, error: Error('Private controlled RPC error') };
        let rows = await asWriter(tx => tx.unsafe('SELECT * FROM ' + table('lock_report_card_actor') + '($1::uuid)', [actor.authUserId]));
        if (options.transformRpc) rows = options.transformRpc(rows);
        // The RPC transaction has ended before a separate writer can commit a
        // change. Command authority must recheck the captured request binding.
        if (options.afterRpc) await options.afterRpc();
        return { data: rows, error: null };
      },
    }, () => execute(command));
  };
  const create = { action: 'create', operationKey: 'server-create', studentId: pupil.student, enrollmentId: pupil.enrollment, ...selector };
  const safe = (result, action) => {
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.action, action);
    assert.deepEqual(Object.keys(result).sort(), ['action', 'kind', 'ok', 'reportId', 'stage', 'version']);
    return result;
  };
  try {
    const before = await history();
    for (const key of ['schoolId', 'role', 'authUserId', 'membershipId', 'verifiedIdentity']) {
      events.length = 0;
      assert.deepEqual(await invoke(teacher, { ...create, [key]: randomUUID() }), { ok: false, code: 'invalid' });
      assert.deepEqual(events, []);
    }
    for (const options of [{ noUser: true }, { authThrow: true }, { rpcError: true }, { config: { schoolId: randomUUID() } }, { transformRpc: rows => rows.map(row => ({ ...row, auth_user_id: randomUUID() })) }]) {
      events.length = 0;
      assert.deepEqual(await invoke(teacher, create, options), { ok: false, code: 'forbidden' });
      assert.equal(events.includes('command-begin'), false);
    }
    assert.deepEqual(await history(), before);
    console.log('PASS: real upgraded server entry rejects forged requests, provider/RPC failure and fixed-school mismatch before command transactions');

    const step = async (actor, command) => {
      const prior = await history();
      assert.deepEqual(await invoke(actor, command, { failReceipt: true }), { ok: false, code: 'unavailable' });
      assert.deepEqual(await history(), prior, command.action + ' server rollback');
      const result = safe(await invoke(actor, command), command.action);
      assert.equal(result.kind, 'applied');
      const committed = await history();
      assert.deepEqual(await invoke(actor, command), { ...result, kind: 'replay' });
      assert.deepEqual(await history(), committed, command.action + ' server replay');
      return result;
    };
    const created = await step(teacher, create);
    const transition = (action, expectedVersion, extra = {}) => ({ action, expectedVersion, reportId: created.reportId, operationKey: 'server-' + action + '-' + expectedVersion, ...extra });
    const submitCommand = transition('submit', 1);
    await step(teacher, submitCommand);
    await step(admin, transition('return', 2, { reason: 'Controlled request correction' }));
    await step(teacher, transition('submit', 3));
    await step(admin, transition('approve', 4));
    await step(admin, transition('reopen', 5));
    await step(teacher, transition('submit', 6));
    await step(admin, transition('approve', 7));
    const publishCommand = transition('publish', 8);
    const published = await step(admin, publishCommand);
    const releaseId = (await db.unsafe('SELECT id FROM ' + table('report_card_releases') + ' WHERE report_id=$1::uuid AND revoked_at IS NULL', [created.reportId]))[0].id;
    await step(admin, transition('revoke', 9, { releaseId, reason: 'Controlled request withdrawal' }));
    assert.equal((await db.unsafe('SELECT id FROM ' + table('report_card_snapshots') + ' WHERE report_id=$1::uuid', [created.reportId])).length, 2);
    console.log('PASS: real upgraded server entry dispatches all seven actions with safe scalar responses, post-write rollback, same-key retry and historical replay');

    const authorityBefore = await history();
    assert.deepEqual(await invoke(admin, publishCommand, { afterRpc: () => db.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [admin.membershipId]) }), { ok: false, code: 'forbidden' });
    await db.unsafe('UPDATE ' + table('memberships') + " SET status='active' WHERE id=$1::uuid", [admin.membershipId]);
    const foreignSchool = randomUUID(), foreignMembership = randomUUID();
    await db.unsafe('INSERT INTO ' + table('schools') + " (id,name,slug,final_primary_year) VALUES ($1,'Controlled foreign fixture','server-entry-foreign',5)", [foreignSchool]);
    assert.deepEqual(await invoke(admin, publishCommand, { afterRpc: () => db.unsafe('INSERT INTO ' + table('memberships') + " (id,school_id,user_id,role) VALUES ($1,$2,$3,'admin')", [foreignMembership, foreignSchool, admin.schoolUserId]) }), { ok: false, code: 'forbidden' });
    const visible = await asWriter(tx => tx.unsafe('SELECT id FROM ' + table('memberships') + " WHERE user_id=$1::uuid AND status='active'", [admin.schoolUserId]));
    assert.equal(visible.length, 1);
    await db.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [foreignMembership]);
    assert.deepEqual(await invoke(admin, publishCommand, { transformRpc: rows => rows.map(row => ({ ...row, membership_id: randomUUID() })) }), { ok: false, code: 'forbidden' });
    assert.deepEqual(await history(), authorityBefore);
    assert.deepEqual(await invoke(admin, publishCommand), { ...published, kind: 'replay' });
    console.log('PASS: real upgraded server entry rechecks captured RPC authority and denies committed suspension, hidden second membership and principal drift before receipt replay');

    const replayBefore = await history();
    await db.unsafe('UPDATE ' + table('teacher_class_assignments') + ' SET ended_at=now() WHERE id=$1::uuid', [assignmentId]);
    assert.deepEqual(await invoke(teacher, submitCommand), { ok: false, code: 'forbidden' });
    await db.unsafe('UPDATE ' + table('teacher_class_assignments') + ' SET ended_at=NULL WHERE id=$1::uuid', [assignmentId]);
    await db.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [admin.membershipId]);
    events.length = 0;
    assert.deepEqual(await invoke(admin, publishCommand), { ok: false, code: 'forbidden' });
    assert.equal(events.includes('command-begin'), false);
    await db.unsafe('UPDATE ' + table('memberships') + " SET status='active' WHERE id=$1::uuid", [admin.membershipId]);
    assert.deepEqual(await invoke(admin, publishCommand), { ...published, kind: 'replay' });
    assert.deepEqual(await history(), replayBefore);
    console.log('PASS: real upgraded server entry denies historical receipts after assignment or membership loss and reactivation replays without writes');
  } finally { fixture.close(); }
}
