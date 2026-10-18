import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { previewStructure } from '../../components/students/lifecycle-fixtures.ts';
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { decideLifecycleCommand, lifecycleFingerprint, type LifecycleCommand, type LifecycleSnapshot, type VerifiedLifecycleContext, type Placement } from './lifecycle-commands.ts';

function fixture(final: 5 | 6 = 5, levelId = 'primary-4') {
  const structure = previewStructure(final);
  const schoolId = structure.schoolId;
  const classes = structure.levels.flatMap(level => level.sections.map(section => ({ id: `${level.id}:${section.id}`, schoolId, levelId: level.id, sectionId: section.id })));
  const sessions = [
    { id: 'session-26', schoolId, label: '2026/2027' },
    { id: 'session-27', schoolId, label: '2027/2028' },
    { id: 'session-28', schoolId, label: '2028/2029' },
  ];
  const snapshot: LifecycleSnapshot = {
    schoolId, structure, structureVersion: 2,
    student: { id: 'fictional-ada', schoolId, status: 'active', version: 1 },
    classes, sessions,
    enrollments: [{ id: 'enroll-26', schoolId, studentId: 'fictional-ada', classId: `${levelId}:a`, sessionId: 'session-26', status: 'active' }],
    decisions: [], departures: [], readmissions: [], idempotency: [],
  };
  const context: VerifiedLifecycleContext = { verifiedAuthUserId: 'fictional-auth', membershipId: 'fictional-admin-membership', access: { schoolId, role: 'admin', membershipStatus: 'active' }, requestId: 'fictional-request', today: '2027-06-01', teacherAssignments: [] };
  const base = { studentId: 'fictional-ada', idempotencyKey: 'key-1', expectedStudentVersion: 1, expectedStructureVersion: 2 };
  const placement = (targetLevelId: string, sectionId = 'b', sessionId = 'session-27'): Placement => ({ classId: `${targetLevelId}:${sectionId}`, levelId: targetLevelId, sectionId, sessionId });
  return { snapshot, context, base, placement };
}

function expectPlan(result: ReturnType<typeof decideLifecycleCommand>) {
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.replay, false);
  if (!result.ok || result.replay) throw new Error('Expected a new operation plan');
  return result.plan;
}
function expectFailure(result: ReturnType<typeof decideLifecycleCommand>, code: string) {
  assert.deepEqual(result.ok ? 'unexpected success' : result.code, code);
}

for (const final of [5, 6] as const) {
  test(`Primary ${final}: promotion, independent section and audit contract`, () => {
    const f = fixture(final, `primary-${final - 1}`);
    const command: LifecycleCommand = { ...f.base, kind: 'propose_decision', sourceEnrollmentId: 'enroll-26', decision: { kind: 'promote', destination: f.placement(`primary-${final}`, 'b') } };
    const proposed = expectPlan(decideLifecycleCommand(command, f.snapshot, f.context));
    assert.deepEqual(proposed.effects.map(effect => effect.kind), ['insert_proposal']);
    assert.equal(proposed.audit, null);
    f.snapshot.decisions = [{ id: 'proposal-1', schoolId: f.snapshot.schoolId, studentId: f.base.studentId, sourceEnrollmentId: 'enroll-26', selection: command.decision, status: 'proposed', structureVersion: 2, studentVersion: 1 }];
    const finalized = expectPlan(decideLifecycleCommand({ ...f.base, kind: 'finalize_decision', sourceEnrollmentId: 'enroll-26', proposalId: 'proposal-1' }, f.snapshot, f.context));
    assert.deepEqual(finalized.effects.map(effect => effect.kind), ['apply_decision', 'close_source_enrollment', 'insert_enrollment', 'bump_student_version']);
    assert.deepEqual(finalized.preconditions.lockOrder, ['school_structure', 'student', 'source_enrollment']);
    assert.equal(finalized.audit?.action, 'promote');
    assert.equal(finalized.audit?.schoolId, f.snapshot.schoolId);
    assert.equal(finalized.audit?.requestId, f.context.requestId);
  });

  test(`Primary ${final}: repetition stays at current level but can change section`, () => {
    const f = fixture(final, 'primary-3');
    const plan = expectPlan(decideLifecycleCommand({ ...f.base, kind: 'propose_decision', sourceEnrollmentId: 'enroll-26', decision: { kind: 'repeat', destination: f.placement('primary-3', 'b') } }, f.snapshot, f.context));
    assert.equal(plan.effects[0].kind, 'insert_proposal');
    expectFailure(decideLifecycleCommand({ ...f.base, kind: 'propose_decision', sourceEnrollmentId: 'enroll-26', decision: { kind: 'repeat', destination: f.placement('primary-4') } }, f.snapshot, f.context), 'invalid_selection');
  });

  test(`Primary ${final}: graduation only at configured final level`, () => {
    const f = fixture(final, `primary-${final}`);
    const selection = { kind: 'graduate' } as const;
    expectPlan(decideLifecycleCommand({ ...f.base, kind: 'propose_decision', sourceEnrollmentId: 'enroll-26', decision: selection }, f.snapshot, f.context));
    f.snapshot.decisions = [{ id: 'proposal-1', schoolId: f.snapshot.schoolId, studentId: f.base.studentId, sourceEnrollmentId: 'enroll-26', selection, status: 'proposed', structureVersion: 2, studentVersion: 1 }];
    const plan = expectPlan(decideLifecycleCommand({ ...f.base, kind: 'finalize_decision', sourceEnrollmentId: 'enroll-26', proposalId: 'proposal-1' }, f.snapshot, f.context));
    assert.equal(plan.audit?.nextState, 'graduated');
    assert.deepEqual(plan.effects.map(effect => effect.kind), ['apply_decision', 'set_enrollment_status', 'set_student_status', 'bump_student_version']);
    const early = fixture(final, `primary-${final - 1}`);
    expectFailure(decideLifecycleCommand({ ...early.base, kind: 'propose_decision', sourceEnrollmentId: 'enroll-26', decision: selection }, early.snapshot, early.context), 'invalid_selection');
  });
}

test('initial enrollment and class assignment require no prior history', () => {
  const f = fixture();
  f.snapshot.enrollments = [];
  const command: LifecycleCommand = { ...f.base, kind: 'enroll', destination: f.placement('nursery-1') };
  const plan = expectPlan(decideLifecycleCommand(command, f.snapshot, f.context));
  assert.equal(plan.audit?.action, 'enroll');
  assert.equal(plan.effects[0].kind, 'insert_enrollment');
  f.snapshot.enrollments = [{ id: 'enroll-26', schoolId: f.snapshot.schoolId, studentId: f.base.studentId, classId: 'primary-4:a', sessionId: 'session-26', status: 'active' }];
  expectFailure(decideLifecycleCommand(command, f.snapshot, f.context), 'invalid_status');
  f.snapshot.enrollments = [];
  expectFailure(decideLifecycleCommand({ ...command, destination: { ...command.destination, sectionId: 'missing' } }, f.snapshot, f.context), 'invalid_selection');
});

test('teacher can propose only for an assigned enrollment and cannot finalize', () => {
  const f = fixture();
  f.context.access.role = 'teacher';
  const proposal: LifecycleCommand = { ...f.base, kind: 'propose_decision', sourceEnrollmentId: 'enroll-26', decision: { kind: 'promote', destination: f.placement('primary-5') } };
  expectFailure(decideLifecycleCommand(proposal, f.snapshot, f.context), 'unauthorized');
  f.context.teacherAssignments = [{ schoolId: f.snapshot.schoolId, membershipId: f.context.membershipId, classId: 'primary-4:a', sessionId: 'session-26', active: true }];
  expectPlan(decideLifecycleCommand(proposal, f.snapshot, f.context));
  f.context.teacherAssignments = [{ schoolId: 'other-school', membershipId: f.context.membershipId, classId: 'primary-4:a', sessionId: 'session-26', active: true }];
  expectFailure(decideLifecycleCommand(proposal, f.snapshot, f.context), 'unauthorized');
  f.context.teacherAssignments = [{ schoolId: f.snapshot.schoolId, membershipId: f.context.membershipId, classId: 'primary-4:a', sessionId: 'session-26', active: true }];
  expectFailure(decideLifecycleCommand({ ...f.base, kind: 'finalize_decision', sourceEnrollmentId: 'enroll-26', proposalId: 'proposal-1' }, f.snapshot, f.context), 'unauthorized');
  f.context.access.role = 'bursar';
  expectFailure(decideLifecycleCommand(proposal, f.snapshot, f.context), 'unauthorized');
});

test('transfer and early exit validate guardian review, date, destination and audit', () => {
  const f = fixture();
  const transfer: LifecycleCommand = { ...f.base, kind: 'transfer', sourceEnrollmentId: 'enroll-26', reason: 'relocation', effectiveDate: '2027-05-01', destinationSchool: 'Fictional Other School', guardianReviewConfirmed: true };
  const plan = expectPlan(decideLifecycleCommand(transfer, f.snapshot, f.context));
  assert.deepEqual(plan.effects.map(effect => effect.kind), ['insert_departure', 'set_enrollment_status', 'set_student_status', 'bump_student_version']);
  assert.equal(plan.audit?.nextState, 'withdrawn');
  expectFailure(decideLifecycleCommand({ ...transfer, destinationSchool: '' }, f.snapshot, f.context), 'invalid_selection');
  expectFailure(decideLifecycleCommand({ ...transfer, guardianReviewConfirmed: false }, f.snapshot, f.context), 'invalid_selection');
  expectFailure(decideLifecycleCommand({ ...transfer, effectiveDate: '2027-12-01' }, f.snapshot, f.context), 'invalid_selection');
  const exit: LifecycleCommand = { ...transfer, kind: 'early_exit', destinationSchool: '' };
  assert.equal(expectPlan(decideLifecycleCommand(exit, f.snapshot, f.context)).audit?.action, 'early_exit');
});

test('re-admission links an unresolved departure and keeps history intact', () => {
  const f = fixture();
  f.snapshot.student!.status = 'withdrawn';
  f.snapshot.enrollments[0].status = 'withdrawn';
  f.snapshot.departures = [{ id: 'departure-1', schoolId: f.snapshot.schoolId, studentId: f.base.studentId, sourceEnrollmentId: 'enroll-26', kind: 'transfer' }];
  const command: LifecycleCommand = { ...f.base, kind: 'readmit', departureId: 'departure-1', destination: f.placement('primary-4'), guardianReviewConfirmed: true };
  const plan = expectPlan(decideLifecycleCommand(command, f.snapshot, f.context));
  assert.deepEqual(plan.effects.map(effect => effect.kind), ['insert_enrollment', 'insert_readmission', 'set_student_status', 'bump_student_version']);
  assert.equal(f.snapshot.departures.length, 1);
  assert.equal(f.snapshot.enrollments.length, 1);
  assert.equal(plan.audit?.action, 'readmit');
  f.snapshot.readmissions = [{ id: 'readmission-1', schoolId: f.snapshot.schoolId, studentId: f.base.studentId, departureId: 'departure-1', enrollmentId: 'enroll-27' }];
  expectFailure(decideLifecycleCommand(command, f.snapshot, f.context), 'conflict');
  f.snapshot.readmissions = [];
  expectFailure(decideLifecycleCommand({ ...command, destination: f.placement('primary-4', 'b', 'session-26') }, f.snapshot, f.context), 'duplicate');
});

test('rejects duplicate and conflicting final decisions and stale proposals', () => {
  const f = fixture();
  const selection = { kind: 'promote', destination: f.placement('primary-5') } as const;
  const proposal: LifecycleCommand = { ...f.base, kind: 'propose_decision', sourceEnrollmentId: 'enroll-26', decision: selection };
  f.snapshot.decisions = [{ id: 'proposal-1', schoolId: f.snapshot.schoolId, studentId: f.base.studentId, sourceEnrollmentId: 'enroll-26', selection, status: 'proposed', structureVersion: 2, studentVersion: 1 }];
  expectFailure(decideLifecycleCommand(proposal, f.snapshot, f.context), 'conflict');
  f.snapshot.decisions[0].studentVersion = 0;
  expectFailure(decideLifecycleCommand({ ...f.base, kind: 'finalize_decision', sourceEnrollmentId: 'enroll-26', proposalId: 'proposal-1' }, f.snapshot, f.context), 'stale_state');
  f.snapshot.decisions[0].status = 'applied';
  expectFailure(decideLifecycleCommand({ ...f.base, kind: 'transfer', sourceEnrollmentId: 'enroll-26', reason: 'relocation', effectiveDate: '2027-05-01', destinationSchool: 'Fictional Other School', guardianReviewConfirmed: true }, f.snapshot, f.context), 'conflict');
});

test('idempotency replays identical requests after state changes and rejects key reuse', () => {
  const f = fixture();
  const command: LifecycleCommand = { ...f.base, kind: 'propose_decision', sourceEnrollmentId: 'enroll-26', decision: { kind: 'promote', destination: f.placement('primary-5') } };
  const fingerprint = lifecycleFingerprint(f.snapshot.schoolId, command);
  f.snapshot.idempotency = [{ schoolId: f.snapshot.schoolId, key: command.idempotencyKey, fingerprint, operationId: 'operation-1' }];
  f.snapshot.student!.version = 2;
  assert.deepEqual(decideLifecycleCommand(command, f.snapshot, f.context), { ok: true, replay: true, operationId: 'operation-1' });
  expectFailure(decideLifecycleCommand({ ...command, decision: { kind: 'repeat', destination: f.placement('primary-4') } }, f.snapshot, f.context), 'idempotency_conflict');
  const reordered: LifecycleCommand = { decision: { destination: { sessionId: 'session-27', sectionId: 'b', levelId: 'primary-5', classId: 'primary-5:b' }, kind: 'promote' }, sourceEnrollmentId: 'enroll-26', kind: 'propose_decision', expectedStructureVersion: 2, expectedStudentVersion: 1, idempotencyKey: 'key-1', studentId: 'fictional-ada' };
  assert.equal(lifecycleFingerprint(f.snapshot.schoolId, reordered), fingerprint);
});

test('fails closed for missing verification, cross-school rows, stale versions and statuses', () => {
  const f = fixture();
  const command: LifecycleCommand = { ...f.base, kind: 'propose_decision', sourceEnrollmentId: 'enroll-26', decision: { kind: 'promote', destination: f.placement('primary-5') } };
  expectFailure(decideLifecycleCommand(command, f.snapshot, { ...f.context, verifiedAuthUserId: '' }), 'missing_context');
  expectFailure(decideLifecycleCommand(command, f.snapshot, { ...f.context, today: '' }), 'missing_context');
  expectFailure(decideLifecycleCommand(command, f.snapshot, { ...f.context, access: { ...f.context.access, membershipStatus: 'suspended' } }), 'unauthorized');
  expectFailure(decideLifecycleCommand(command, f.snapshot, { ...f.context, access: { ...f.context.access, schoolId: 'other-school' } }), 'school_mismatch');
  expectFailure(decideLifecycleCommand({ ...command, schoolId: 'other-school' } as LifecycleCommand, f.snapshot, f.context), 'invalid_selection');
  expectFailure(decideLifecycleCommand({ ...command, role: 'admin' } as LifecycleCommand, f.snapshot, f.context), 'invalid_selection');
  expectFailure(decideLifecycleCommand({ ...command, expectedStudentVersion: 0 }, f.snapshot, f.context), 'stale_state');
  f.snapshot.classes[0].schoolId = 'other-school';
  expectFailure(decideLifecycleCommand(command, f.snapshot, f.context), 'school_mismatch');
  f.snapshot.classes[0].schoolId = f.snapshot.schoolId;
  f.snapshot.student!.status = 'graduated';
  expectFailure(decideLifecycleCommand(command, f.snapshot, f.context), 'invalid_status');
});
