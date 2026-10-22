import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit source extension for offline Node runner.
import { parseReportCardRequestCommand as parse } from './report-card-request-command.ts';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const transition = { action: 'submit', reportId: id, operationKey: 'key-1', expectedVersion: 1 };

test('accepts all seven closed command shapes', () => {
  const create = { action: 'create', operationKey: 'create-1', studentId: id, enrollmentId: id, classId: id, sessionId: id, termId: id };
  assert.deepEqual(parse(create), create);
  for (const action of ['submit', 'return', 'reopen', 'approve', 'publish', 'revoke']) {
    const value = { ...transition, action, ...(['return', 'revoke'].includes(action) ? { reason: 'Correction' } : {}), ...(action === 'revoke' ? { releaseId: id } : {}) };
    assert.deepEqual(parse(value), value);
  }
});

test('rejects every client authority field and action-inappropriate selectors', () => {
  for (const key of ['schoolId', 'authUserId', 'membershipId', 'schoolUserId', 'role', 'assigned', 'snapshotId', 'assessmentRevision', 'reason', 'releaseId']) {
    assert.equal(parse({ ...transition, [key]: id }), null);
  }
});

test('rejects missing selectors, non-UUID identifiers and invalid versions', () => {
  for (const reportId of ['', 'foreign', id + ' ', null, 12]) assert.equal(parse({ ...transition, reportId }), null);
  for (const expectedVersion of [0, -1, 1.5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.equal(parse({ ...transition, expectedVersion }), null);
  const { reportId: omitted, ...missing } = transition;
  assert.ok(omitted); assert.equal(parse(missing), null);
});

test('copies and freezes accepted input before async work and normalizes UUID/reason only', () => {
  const raw = { ...transition, action: 'return', reportId: id.toUpperCase(), reason: '  Revise attendance  ' };
  const result = parse(raw);
  assert.deepEqual(result, { ...raw, reportId: id, reason: 'Revise attendance' });
  assert.equal(Object.isFrozen(result), true);
  raw.operationKey = 'changed'; assert.equal(result?.operationKey, 'key-1');
});

test('rejects accessors without running them, symbols, hidden fields and inherited commands', () => {
  let calls = 0;
  const accessor = { ...transition };
  Object.defineProperty(accessor, 'reportId', { enumerable: true, get() { calls++; return id; } });
  assert.equal(parse(accessor), null); assert.equal(calls, 0);
  assert.equal(parse({ ...transition, [Symbol('authority')]: true }), null);
  assert.equal(parse(Object.defineProperty({ ...transition }, 'role', { value: 'admin' })), null);
  assert.equal(parse(Object.create(transition)), null);
  assert.deepEqual(parse(Object.assign(Object.create(null), transition)), transition);
});

test('bounds operation keys and correction reasons without silently changing keys', () => {
  for (const operationKey of ['', ' ', ' key', 'key ', 'a'.repeat(129), 1]) assert.equal(parse({ ...transition, operationKey }), null);
  for (const reason of ['', ' ', 'a'.repeat(2001), null]) assert.equal(parse({ ...transition, action: 'return', reason }), null);
  assert.ok(parse({ ...transition, operationKey: 'a'.repeat(128), action: 'return', reason: 'a'.repeat(2000) }));
});

test('rejects non-objects, unknown actions and throwing object traps safely', () => {
  for (const value of [null, [], 'submit', 1, {}, { ...transition, action: 'delete' }, new Proxy({}, { getPrototypeOf() { throw Error('trap'); } })]) assert.equal(parse(value), null);
});
