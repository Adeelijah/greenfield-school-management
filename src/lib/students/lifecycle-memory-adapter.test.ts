import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { previewStructure } from '../../components/students/lifecycle-fixtures.ts';
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { InMemoryLifecycleStore, type MemoryExecutionResult, type MemoryState } from './lifecycle-memory-adapter.ts';
import type { LifecycleCommand, Placement } from './lifecycle-commands.ts';

const admin = { authUserId: 'fictional-admin-auth', requestId: 'fictional-request', today: '2027-06-01' };
const teacher = { ...admin, authUserId: 'fictional-teacher-auth' };
const bursar = { ...admin, authUserId: 'fictional-bursar-auth' };

function fixture(final: 5 | 6 = 5, currentLevel = 'primary-4') {
  const a = previewStructure(final);
  const b = previewStructure(final === 5 ? 6 : 5);
  const classes = [a, b].flatMap(structure => structure.levels.flatMap(level => level.sections.map(section => ({ id: `${structure.schoolId}:${level.id}:${section.id}`, schoolId: structure.schoolId, levelId: level.id, sectionId: section.id }))));
  const sessions = [a, b].flatMap(structure => [
    { id: `${structure.schoolId}:2026`, schoolId: structure.schoolId, label: '2026/2027' },
    { id: `${structure.schoolId}:2027`, schoolId: structure.schoolId, label: '2027/2028' },
    { id: `${structure.schoolId}:2028`, schoolId: structure.schoolId, label: '2028/2029' },
  ]);
  const state: MemoryState = {
    schools: [{ id: a.schoolId, structure: a, structureVersion: 2 }, { id: b.schoolId, structure: b, structureVersion: 2 }],
    memberships: [
      { id: 'membership-admin', schoolId: a.schoolId, authUserId: admin.authUserId, role: 'admin', status: 'active' },
      { id: 'membership-teacher', schoolId: a.schoolId, authUserId: teacher.authUserId, role: 'teacher', status: 'active' },
      { id: 'membership-bursar', schoolId: a.schoolId, authUserId: bursar.authUserId, role: 'bursar', status: 'active' },
      { id: 'membership-other', schoolId: b.schoolId, authUserId: 'fictional-other-admin', role: 'admin', status: 'active' },
    ],
    teacherAssignments: [],
    students: [{ id: 'fictional-ada', schoolId: a.schoolId, status: 'active', version: 1 }, { id: 'fictional-other-pupil', schoolId: b.schoolId, status: 'active', version: 1 }],
    classes, sessions,
    enrollments: [{ id: 'source-enrollment', schoolId: a.schoolId, studentId: 'fictional-ada', classId: `${a.schoolId}:${currentLevel}:a`, sessionId: `${a.schoolId}:2026`, status: 'active' }],
    decisions: [], departures: [], readmissions: [], idempotency: [], auditEvents: [], nextId: 1,
  };
  const base = { studentId: 'fictional-ada', expectedStudentVersion: 1, expectedStructureVersion: 2 };
  const place = (levelId: string, sectionId = 'b', year = 2027): Placement => ({ classId: `${a.schoolId}:${levelId}:${sectionId}`, levelId, sectionId, sessionId: `${a.schoolId}:${year}` });
  const propose = (selection: { kind: 'promote' | 'repeat'; destination: Placement } | { kind: 'graduate' }, key = 'proposal-key'): LifecycleCommand => ({ ...base, idempotencyKey: key, kind: 'propose_decision', sourceEnrollmentId: 'source-enrollment', decision: selection });
  const finalize = (proposalId: string, key = 'final-key'): LifecycleCommand => ({ ...base, idempotencyKey: key, kind: 'finalize_decision', sourceEnrollmentId: 'source-enrollment', proposalId });
  const transfer = (key = 'transfer-key'): Extract<LifecycleCommand, { kind: 'transfer' | 'early_exit' }> => ({ ...base, idempotencyKey: key, kind: 'transfer', sourceEnrollmentId: 'source-enrollment', reason: 'relocation', effectiveDate: '2027-05-01', destinationSchool: 'Fictional Horizon School', guardianReviewConfirmed: true });
  return { store: new InMemoryLifecycleStore(state), seed: state, schoolId: a.schoolId, otherSchoolId: b.schoolId, base, place, propose, finalize, transfer };
}

function success(result: MemoryExecutionResult): Extract<MemoryExecutionResult, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error('Expected success');
  return result;
}
function failure(result: MemoryExecutionResult, code: string) {
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Expected failure');
  assert.equal(result.code, code);
}
function proposalId(store: InMemoryLifecycleStore) { return store.inspect().decisions[0].id; }

test('promotion commits completed history, independent destination section and audit atomically', async () => {
  const f = fixture(5);
  const proposed = success(await f.store.execute(f.propose({ kind: 'promote', destination: f.place('primary-5', 'b') }), admin));
  assert.equal(proposed.replay, false);
  assert.equal(f.store.inspect().auditEvents.length, 0);
  const finalized = success(await f.store.execute(f.finalize(proposalId(f.store)), admin));
  const state = f.store.inspect();
  assert.equal(state.enrollments.find(row => row.id === 'source-enrollment')?.status, 'completed');
  assert.equal(state.enrollments.find(row => row.status === 'active')?.classId, `${f.schoolId}:primary-5:b`);
  assert.equal(state.enrollments.length, 2);
  assert.equal(state.students[0].version, 2);
  assert.equal(state.decisions[0].status, 'applied');
  assert.equal(state.auditEvents.length, 1);
  assert.equal(state.auditEvents[0].operationId, finalized.operationId);
  assert.equal(state.auditEvents[0].action, 'promote');
  assert.equal(state.idempotency.length, 2);
  assert.deepEqual(success(await f.store.execute(f.finalize(proposalId(f.store)), admin)), { ok: true, replay: true, operationId: finalized.operationId });
  assert.deepEqual(f.store.inspect(), state);
});

test('Primary 6 repetition keeps the level and moves to an independently selected section', async () => {
  const f = fixture(6, 'primary-3');
  success(await f.store.execute(f.propose({ kind: 'repeat', destination: f.place('primary-3', 'b') }), admin));
  success(await f.store.execute(f.finalize(proposalId(f.store)), admin));
  const state = f.store.inspect();
  assert.equal(state.enrollments[0].status, 'completed');
  assert.equal(state.enrollments[1].classId, `${f.schoolId}:primary-3:b`);
  assert.equal(state.enrollments[1].status, 'active');
});

test('graduation requires configured final Primary level and retains final enrollment', async () => {
  const early = fixture(5, 'primary-4');
  failure(await early.store.execute(early.propose({ kind: 'graduate' }), admin), 'invalid_selection');
  const f = fixture(5, 'primary-5');
  success(await f.store.execute(f.propose({ kind: 'graduate' }), admin));
  success(await f.store.execute(f.finalize(proposalId(f.store)), admin));
  const state = f.store.inspect();
  assert.equal(state.students[0].status, 'graduated');
  assert.equal(state.enrollments[0].status, 'graduated');
  assert.equal(state.enrollments.length, 1);
  assert.equal(state.auditEvents[0].action, 'graduate');
  failure(await f.store.execute(f.transfer(), admin), 'stale_state');
});

test('transfer and authorized re-admission preserve departure and withdrawn enrollment', async () => {
  const f = fixture();
  success(await f.store.execute(f.transfer(), admin));
  let state = f.store.inspect();
  assert.equal(state.students[0].status, 'withdrawn');
  assert.equal(state.enrollments[0].status, 'withdrawn');
  assert.equal(state.departures.length, 1);
  const departureId = state.departures[0].id;
  const readmit: LifecycleCommand = { ...f.base, expectedStudentVersion: 2, idempotencyKey: 'readmit-key', kind: 'readmit', departureId, destination: f.place('primary-4', 'a'), guardianReviewConfirmed: true };
  success(await f.store.execute(readmit, admin));
  state = f.store.inspect();
  assert.equal(state.students[0].status, 'active');
  assert.equal(state.students[0].version, 3);
  assert.equal(state.enrollments[0].status, 'withdrawn');
  assert.equal(state.enrollments[1].status, 'active');
  assert.equal(state.departures[0].id, departureId);
  assert.equal(state.readmissions[0].departureId, departureId);
  assert.equal(state.readmissions[0].enrollmentId, state.enrollments[1].id);
  assert.deepEqual(state.auditEvents.map(row => row.action), ['transfer', 'readmit']);
});

test('early exit commits a departure and blocks another terminal outcome', async () => {
  const f = fixture();
  const earlyExit: LifecycleCommand = { ...f.transfer(), kind: 'early_exit', destinationSchool: '', idempotencyKey: 'exit-key' };
  success(await f.store.execute(earlyExit, admin));
  assert.equal(f.store.inspect().departures[0].kind, 'early_exit');
  failure(await f.store.execute(f.transfer(), admin), 'stale_state');
});

test('same-session duplicate enrollment and reused key with different payload are rejected', async () => {
  const f = fixture();
  success(await f.store.execute(f.transfer(), admin));
  const readmit: LifecycleCommand = { ...f.base, expectedStudentVersion: 2, idempotencyKey: 'readmit-key', kind: 'readmit', departureId: f.store.inspect().departures[0].id, destination: f.place('primary-4', 'b', 2026), guardianReviewConfirmed: true };
  failure(await f.store.execute(readmit, admin), 'duplicate');
  const changed = { ...f.transfer(), destinationSchool: 'Fictional Different School' };
  failure(await f.store.execute(changed, admin), 'idempotency_conflict');
});

test('teacher assignment is resolved from store, while teacher finalization and bursar actions fail', async () => {
  const f = fixture();
  const command = f.propose({ kind: 'promote', destination: f.place('primary-5') });
  failure(await f.store.execute(command, teacher), 'unauthorized');
  f.seed.teacherAssignments.push({ schoolId: f.schoolId, membershipId: 'membership-teacher', classId: `${f.schoolId}:primary-4:a`, sessionId: `${f.schoolId}:2026`, active: true });
  // Constructor copied the seed; later external mutation cannot grant access.
  failure(await f.store.execute(command, teacher), 'unauthorized');
  failure(await f.store.execute(command, bursar), 'unauthorized');
  success(await f.store.execute(command, admin));
  failure(await f.store.execute(f.finalize(proposalId(f.store)), teacher), 'unauthorized');
});

test('active store assignment permits teacher proposal but not finalization', async () => {
  const f = fixture();
  const seeded = f.store.inspect();
  seeded.teacherAssignments.push({ schoolId: f.otherSchoolId, membershipId: 'membership-teacher', classId: `${f.schoolId}:primary-4:a`, sessionId: `${f.schoolId}:2026`, active: true });
  const foreignAssignmentStore = new InMemoryLifecycleStore(seeded);
  failure(await foreignAssignmentStore.execute(f.propose({ kind: 'promote', destination: f.place('primary-5') }), teacher), 'unauthorized');
  seeded.teacherAssignments.pop();
  seeded.teacherAssignments.push({ schoolId: f.schoolId, membershipId: 'membership-teacher', classId: `${f.schoolId}:primary-4:a`, sessionId: `${f.schoolId}:2026`, active: true });
  const store = new InMemoryLifecycleStore(seeded);
  success(await store.execute(f.propose({ kind: 'promote', destination: f.place('primary-5') }), teacher));
  failure(await store.execute(f.finalize(proposalId(store)), teacher), 'unauthorized');
  success(await store.execute(f.finalize(proposalId(store)), admin));
});

test('cross-school students and placement references are never loaded as valid resources', async () => {
  const f = fixture();
  const foreignStudent: LifecycleCommand = { ...f.base, studentId: 'fictional-other-pupil', idempotencyKey: 'foreign-key', kind: 'enroll', destination: f.place('nursery-1') };
  failure(await f.store.execute(foreignStudent, admin), 'missing_context');
  const seed = f.store.inspect();
  seed.enrollments = [];
  const store = new InMemoryLifecycleStore(seed);
  const foreignClass: LifecycleCommand = { ...f.base, idempotencyKey: 'foreign-class-key', kind: 'enroll', destination: { classId: `${f.otherSchoolId}:nursery-1:a`, levelId: 'nursery-1', sectionId: 'a', sessionId: `${f.schoolId}:2027` } };
  failure(await store.execute(foreignClass, admin), 'invalid_selection');
  assert.equal(store.inspect().auditEvents.length, 0);
});

test('stale versions and conflicting promotion/transfer cannot both finalize', async () => {
  const f = fixture();
  success(await f.store.execute(f.propose({ kind: 'promote', destination: f.place('primary-5') }), admin));
  const [promoted, transferred] = await Promise.all([
    f.store.execute(f.finalize(proposalId(f.store)), admin),
    f.store.execute(f.transfer(), admin),
  ]);
  success(promoted);
  failure(transferred, 'stale_state');
  const state = f.store.inspect();
  assert.equal(state.students[0].version, 2);
  assert.equal(state.decisions[0].status, 'applied');
  assert.equal(state.departures.length, 0);
  assert.equal(state.auditEvents.length, 1);
  failure(await f.store.execute({ ...f.finalize(proposalId(f.store)), idempotencyKey: 'new-final-key' }, admin), 'stale_state');
});

test('audit failure rolls back all effects, version, audit and idempotency', async () => {
  const f = fixture();
  const before = f.store.inspect();
  failure(await f.store.execute(f.transfer(), admin, { atAudit: true }), 'transaction_failed');
  assert.deepEqual(f.store.inspect(), before);
  success(await f.store.execute(f.transfer(), admin));
});

test('partial effect and idempotency failure roll back the entire cloned transaction', async () => {
  for (const injection of [{ afterEffect: 0 }, { afterEffect: 2 }, { atIdempotency: true }] as const) {
    const f = fixture();
    const before = f.store.inspect();
    failure(await f.store.execute(f.transfer(), admin, injection), 'transaction_failed');
    assert.deepEqual(f.store.inspect(), before);
  }
});

test('transaction port rejects a stale plan and a plan for another locked student', async () => {
  const f = fixture();
  const result = success(await f.store.execute(f.transfer(), admin));
  assert.ok(result.plan);
  const before = f.store.inspect();
  await assert.rejects(
    f.store.withStudentTransaction(f.schoolId, 'fictional-ada', async tx => tx.applyAtomically(result.plan!)),
    /Optimistic version check failed/,
  );
  const expanded = f.store.inspect();
  expanded.students.push({ id: 'fictional-second-pupil', schoolId: f.schoolId, status: 'active', version: 1 });
  const store = new InMemoryLifecycleStore(expanded);
  await assert.rejects(
    store.withStudentTransaction(f.schoolId, 'fictional-second-pupil', async tx => tx.applyAtomically(result.plan!)),
    /Transaction plan scope changed/,
  );
  assert.deepEqual(f.store.inspect(), before);
  assert.deepEqual(store.inspect(), expanded);
});

test('transaction port rejects a forged effect for another student and rolls back', async () => {
  const f = fixture();
  const applied = success(await f.store.execute(f.transfer(), admin));
  assert.ok(applied.plan);
  const seed = structuredClone(f.seed);
  seed.students.push({ id: 'fictional-second-pupil', schoolId: f.schoolId, status: 'active', version: 1 });
  const store = new InMemoryLifecycleStore(seed);
  const forged = structuredClone(applied.plan!);
  forged.effects = forged.effects.map(effect => effect.kind === 'set_student_status' ? { ...effect, studentId: 'fictional-second-pupil' } : effect);
  await assert.rejects(
    store.withStudentTransaction(f.schoolId, 'fictional-ada', async tx => tx.applyAtomically(forged)),
    /Effect targets another student/,
  );
  assert.deepEqual(store.inspect(), seed);
});
