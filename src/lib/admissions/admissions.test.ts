import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's type-stripping runner needs an explicit TypeScript extension.
import { canManageAdmissions, executeAdmissionCommand, validateAdmissionPlacement, type AdmissionCommand, type AdmissionPreviewState } from './admissions.ts';
// @ts-expect-error Node's type-stripping runner needs an explicit TypeScript extension.
import { admissionsAdmin, admissionsBursar, admissionsTeacher, newAdmissionsPreviewState } from '../../components/admissions/admissions-fixtures.ts';

type RegisterApplicantCommand = Extract<AdmissionCommand, { kind: 'register_applicant' }>;
function submitCommand(operationId = 'op-submit-new'): RegisterApplicantCommand {
  return {
    kind: 'register_applicant', operationId, applicantId: `application-${operationId}`,
    input: {
      firstName: 'Mina', lastName: 'Adebayo', dateOfBirth: '2021-04-12', requestedLevelId: 'level-nursery-1',
      proposedClassId: 'class-level-nursery-1-green',
      guardian: { fullName: 'Tola Adebayo', phone: '+234 802 555 0188', email: 'tola@example.test', relationship: 'parent', isPrimary: true, isEmergency: true },
    },
  };
}
function run(state: AdmissionPreviewState, command: AdmissionCommand, actor = admissionsAdmin) { return executeAdmissionCommand(state, { actor, occurredAt: '2026-08-18T10:00:00.000Z' }, command); }
function applicant(state: AdmissionPreviewState, id: string) { const result = state.applicants.find(item => item.id === id); assert.ok(result); return result; }

test('active school admin can register applicants and creates one scoped guardian, history, and audit event', () => {
  const initial = newAdmissionsPreviewState();
  const result = run(initial, submitCommand());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const created = applicant(result.state, 'application-op-submit-new');
  assert.equal(created.status, 'submitted');
  assert.equal(created.guardianIds.length, 1);
  assert.equal(created.guardianRelationships[0]?.isPrimary, true);
  assert.equal(result.state.guardians.length, initial.guardians.length + 1);
  assert.equal(result.state.auditEvents.at(-1)?.action, 'admission.application_submitted');
  assert.equal(result.state.auditEvents.at(-1)?.entityType, 'admission');
  assert.deepEqual(initial.applicants.map(item => item.id), newAdmissionsPreviewState().applicants.map(item => item.id));
});

test('missing, suspended, teacher, bursar, forged, and cross-school membership contexts fail closed', () => {
  const state = newAdmissionsPreviewState();
  assert.equal(canManageAdmissions(undefined, state.memberships, state.schoolId), false);
  assert.equal(executeAdmissionCommand(state, null, submitCommand()).ok, false);
  assert.equal(executeAdmissionCommand(state, { actor: admissionsAdmin, occurredAt: 'not-a-date' }, submitCommand()).ok, false);
  assert.equal(run(state, submitCommand(), admissionsTeacher).ok, false);
  assert.equal(run(state, submitCommand(), admissionsBursar).ok, false);
  assert.equal(run(state, submitCommand(), { ...admissionsAdmin, membershipId: 'unknown-member' }).ok, false);
  assert.equal(run(state, submitCommand(), { ...admissionsAdmin, membershipId: 'membership-suspended-admin' }).ok, false);
  assert.equal(run(state, submitCommand(), { ...admissionsAdmin, schoolId: 'fictional-river-school', membershipId: 'membership-admin-other-school' }).ok, false);
  const forged = { ...submitCommand(), schoolId: state.schoolId } as AdmissionCommand & { schoolId: string };
  const forgedResult = executeAdmissionCommand(state, { actor: admissionsAdmin, occurredAt: '2026-08-18T10:00:00.000Z' }, forged);
  assert.equal(forgedResult.ok, false);
  if (!forgedResult.ok) assert.equal(forgedResult.code, 'invalid_input');
});

test('status transitions allow review and decisions only from valid states', () => {
  const state = newAdmissionsPreviewState();
  const submitted = applicant(state, 'app-laila');
  const review = run(state, { kind: 'set_review_status', operationId: 'op-review-laila', applicantId: submitted.id, expectedVersion: submitted.version, status: 'reviewing', note: 'Documents received.' });
  assert.equal(review.ok, true);
  if (!review.ok) return;
  const reviewing = applicant(review.state, submitted.id);
  assert.equal(reviewing.version, submitted.version + 1);
  const decision = run(review.state, { kind: 'decide_admission', operationId: 'op-approve-laila', applicantId: submitted.id, expectedVersion: reviewing.version, outcome: 'approved', note: 'Placement confirmed.' });
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.equal(applicant(decision.state, submitted.id).status, 'approved');
  assert.equal(decision.auditEvent.previousState, 'reviewing');
  assert.equal(decision.auditEvent.nextState, 'approved');
  for (const outcome of ['rejected', 'waitlisted'] as const) {
    const reviewApplicant = applicant(state, 'app-ibrahim');
    const outcomeResult = run(state, { kind: 'decide_admission', operationId: `op-${outcome}`, applicantId: reviewApplicant.id, expectedVersion: reviewApplicant.version, outcome, note: `Reviewed and set ${outcome}.` });
    assert.equal(outcomeResult.ok, true);
    if (outcomeResult.ok) assert.equal(applicant(outcomeResult.state, reviewApplicant.id).status, outcome);
  }
  const invalid = run(state, { kind: 'decide_admission', operationId: 'op-invalid-decision', applicantId: submitted.id, expectedVersion: submitted.version, outcome: 'rejected', note: 'No review started.' });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.code, 'invalid_transition');
  const invalidNote = run(review.state, { kind: 'decide_admission', operationId: 'op-no-note', applicantId: submitted.id, expectedVersion: reviewing.version, outcome: 'waitlisted', note: ' ' });
  assert.equal(invalidNote.ok, false);
});

test('duplicate active applications and existing student identities are rejected without changing state', () => {
  const state = newAdmissionsPreviewState();
  const duplicateExistingApplicant = run(state, { ...submitCommand('op-duplicate-app'), input: { ...submitCommand().input, firstName: 'Laila', lastName: 'Bello', dateOfBirth: '2021-09-04' } });
  assert.equal(duplicateExistingApplicant.ok, false);
  const duplicateStudent = run(state, { ...submitCommand('op-duplicate-student'), input: { ...submitCommand().input, firstName: 'Nia', lastName: 'Okafor', dateOfBirth: '2019-07-21' } });
  assert.equal(duplicateStudent.ok, false);
  assert.equal(state.auditEvents.length, 0);
  assert.equal(state.guardians.length, newAdmissionsPreviewState().guardians.length);
});

test('academic placement validates Creche to Primary progression, class ownership, and Primary 5/6 configuration', () => {
  const state = newAdmissionsPreviewState();
  assert.equal(validateAdmissionPlacement(state, 'level-nursery-1', 'class-level-nursery-1-green'), null);
  assert.ok(validateAdmissionPlacement(state, 'level-nursery-1', 'class-level-primary-1-green'));
  assert.ok(validateAdmissionPlacement(state, 'no-such-level', 'class-level-nursery-1-green'));
  const mismatch = { ...state, finalPrimaryYear: 6 as const };
  assert.ok(validateAdmissionPlacement(mismatch, 'level-primary-1', 'class-level-primary-1-green'));
  const p6Structure = {
    ...state.structure, finalLevelId: 'level-primary-6',
    levels: [...state.structure.levels, { id: 'level-primary-6', name: 'Primary 6', stage: 'primary' as const, order: 9, sections: [{ id: 'level-primary-6-section-green', name: 'Green' }] }],
  };
  const p6 = { ...state, finalPrimaryYear: 6 as const, structure: p6Structure, classes: [...state.classes, { id: 'class-level-primary-6-green', schoolId: state.schoolId, levelId: 'level-primary-6', name: 'Primary 6 · Green', active: true }] };
  assert.equal(validateAdmissionPlacement(p6, 'level-primary-6', 'class-level-primary-6-green'), null);
  const outside = { ...state, classes: [...state.classes, { id: 'cross-school-class', schoolId: 'fictional-river-school', levelId: 'level-nursery-1', name: 'Other school', active: true }] };
  assert.ok(validateAdmissionPlacement(outside, 'level-nursery-1', 'cross-school-class'));
});

test('same operation key replays exactly; different payload conflicts; stale versions reject concurrent decisions', () => {
  const state = newAdmissionsPreviewState();
  const command = submitCommand('op-idem');
  const first = run(state, command);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const replay = run(first.state, command);
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.replayed, true);
  assert.equal(replay.state.applicants.length, first.state.applicants.length);
  const reordered = { input: command.input, applicantId: command.applicantId, operationId: command.operationId, kind: command.kind } as RegisterApplicantCommand;
  const reorderedReplay = run(first.state, reordered);
  assert.equal(reorderedReplay.ok, true);
  if (reorderedReplay.ok) assert.equal(reorderedReplay.replayed, true);
  const changed = run(first.state, { ...command, input: { ...command.input, lastName: 'Changed' } });
  assert.equal(changed.ok, false);
  if (!changed.ok) assert.equal(changed.code, 'conflict');

  const submitted = applicant(state, 'app-laila');
  const one = run(state, { kind: 'set_review_status', operationId: 'op-version-one', applicantId: submitted.id, expectedVersion: submitted.version, status: 'reviewing' });
  assert.equal(one.ok, true);
  if (!one.ok) return;
  const stale = run(one.state, { kind: 'set_review_status', operationId: 'op-version-two', applicantId: submitted.id, expectedVersion: submitted.version, status: 'reviewing' });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, 'stale_version');
});

test('approved applicant onboarding creates one student, one enrollment, guardian links, and minimal audit atomically', () => {
  const state = newAdmissionsPreviewState();
  const approved = applicant(state, 'app-zara');
  const command: AdmissionCommand = { kind: 'onboard_approved_applicant', operationId: 'op-onboard-zara', applicantId: approved.id, expectedVersion: approved.version, admissionNumber: 'GF/27/016', classId: approved.proposedClassId, sessionId: 'session-2026' };
  const result = run(state, command);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.students.length, state.students.length + 1);
  assert.equal(result.state.enrollments.filter(row => row.studentId === 'student-app-zara').length, 1);
  assert.equal(result.state.guardianLinks.filter(row => row.studentId === 'student-app-zara' && row.active).length, 2);
  assert.equal(result.state.guardianLinks.filter(row => row.studentId === 'student-app-zara' && row.isPrimary).length, 1);
  assert.equal(result.state.auditEvents.at(-1)?.action, 'admission.applicant_onboarded');
  assert.equal('fullName' in result.auditEvent, false);
  const replay = run(result.state, command);
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.state.students.length, result.state.students.length);
  const collision = run(state, { ...command, operationId: 'op-admission-collision', admissionNumber: 'GF/26/011' });
  assert.equal(collision.ok, false);
  const invalidPlacement = run(state, { ...command, operationId: 'op-placement-conflict', classId: 'class-level-primary-1-green' });
  assert.equal(invalidPlacement.ok, false);
  assert.equal(state.students.length, 3);
  assert.equal(state.enrollments.length, 3);
});

test('onboarding rejects an existing same-name student and non-approved applicant', () => {
  let state = newAdmissionsPreviewState();
  state = { ...state, applicants: state.applicants.map(item => item.id === 'app-zara' ? { ...item, firstName: 'Nia', lastName: 'Okafor', dateOfBirth: '2019-07-21' } : item) };
  const approved = applicant(state, 'app-zara');
  const collision = run(state, { kind: 'onboard_approved_applicant', operationId: 'op-name-collision', applicantId: approved.id, expectedVersion: approved.version, admissionNumber: 'GF/27/016', classId: approved.proposedClassId, sessionId: 'session-2026' });
  assert.equal(collision.ok, false);
  const submitted = applicant(newAdmissionsPreviewState(), 'app-laila');
  const denied = run(newAdmissionsPreviewState(), { kind: 'onboard_approved_applicant', operationId: 'op-not-approved', applicantId: submitted.id, expectedVersion: submitted.version, admissionNumber: 'GF/27/016', classId: submitted.proposedClassId, sessionId: 'session-2026' });
  assert.equal(denied.ok, false);
});

test('guardian contact identity and relationship integrity are school-scoped and versioned', () => {
  const state = newAdmissionsPreviewState();
  const duplicateContact = run(state, { kind: 'create_guardian', operationId: 'op-duplicate-guardian', guardianId: 'guardian-duplicate', fullName: 'Another Contact', phone: '+2348010001001', email: 'new@example.test' });
  assert.equal(duplicateContact.ok, false);
  const duplicateEmail = run(state, { kind: 'update_guardian_contact', operationId: 'op-duplicate-email', guardianId: 'guardian-samira', expectedVersion: 1, fullName: 'Samira Bello', phone: '+2348010001001', email: 'adaeze@example.test' });
  assert.equal(duplicateEmail.ok, false);
  const link = run(state, { kind: 'link_guardian', operationId: 'op-duplicate-link', studentId: 'student-amina', expectedStudentVersion: 1, guardianId: 'guardian-tunde', relationship: 'parent', isPrimary: false, isEmergency: true });
  assert.equal(link.ok, false);
  const crossSchool = run(state, { kind: 'link_guardian', operationId: 'op-cross-school', studentId: 'student-amina', expectedStudentVersion: 1, guardianId: 'guardian-from-other-school', relationship: 'other', isPrimary: false, isEmergency: false });
  assert.equal(crossSchool.ok, false);
  const withForeignGuardian = { ...state, guardians: [...state.guardians, { id: 'guardian-from-other-school', schoolId: 'fictional-river-school', fullName: 'River Guardian', phone: '+2348019000000', email: 'river@example.test', version: 1 }] };
  const foreignReference = run(withForeignGuardian, { kind: 'link_guardian', operationId: 'op-real-cross-school', studentId: 'student-amina', expectedStudentVersion: 1, guardianId: 'guardian-from-other-school', relationship: 'other', isPrimary: false, isEmergency: false });
  assert.equal(foreignReference.ok, false);
  const stale = run(state, { kind: 'update_guardian_contact', operationId: 'op-stale-contact', guardianId: 'guardian-samira', expectedVersion: 2, fullName: 'Samira Bello', phone: '+2348010001111', email: 'samira@example.test' });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, 'stale_version');
  const create = run(state, { kind: 'create_guardian', operationId: 'op-create-guardian', guardianId: 'guardian-new', fullName: 'Mara Sample', phone: '+2348020009191', email: 'mara@example.test' });
  assert.equal(create.ok, true);
  if (!create.ok) return;
  const update = run(create.state, { kind: 'update_guardian_contact', operationId: 'op-update-guardian', guardianId: 'guardian-new', expectedVersion: 1, fullName: 'Mara Sample', phone: '+2348020009192', email: 'mara@example.test' });
  assert.equal(update.ok, true);
  if (update.ok) assert.equal(update.state.guardians.find(item => item.id === 'guardian-new')?.version, 2);
});

test('guardian links support siblings, multiple guardians, primary handoff, emergency flags, and retained relationship history', () => {
  const state = newAdmissionsPreviewState();
  const command: AdmissionCommand = { kind: 'link_guardian', operationId: 'op-primary-handoff', studentId: 'student-amina', expectedStudentVersion: 1, guardianId: 'guardian-tunde', relationship: 'legal_guardian', isPrimary: true, isEmergency: true };
  const result = run(state, command);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const activeLinks = result.state.guardianLinks.filter(link => link.active && link.studentId === 'student-amina');
  assert.equal(activeLinks.filter(link => link.isPrimary).length, 1);
  assert.equal(activeLinks.find(link => link.guardianId === 'guardian-tunde')?.isPrimary, true);
  assert.ok(result.state.relationshipHistory.some(item => item.guardianId === 'guardian-samira' && item.isPrimary));
  assert.equal(result.state.students.find(item => item.id === 'student-amina')?.version, 2);
  assert.equal(result.state.guardianLinks.filter(link => link.guardianId === 'guardian-samira' && link.studentId === 'student-kofi' && link.active).length, 1);
  const removeOnlyPrimary = run(result.state, { kind: 'link_guardian', operationId: 'op-remove-primary', studentId: 'student-kofi', expectedStudentVersion: 1, guardianId: 'guardian-samira', relationship: 'parent', isPrimary: false, isEmergency: true });
  assert.equal(removeOnlyPrimary.ok, false);
});

test('registration requires a primary guardian and rejects malformed or cross-school references', () => {
  const state = newAdmissionsPreviewState();
  const noPrimary = submitCommand('op-no-primary');
  noPrimary.input.guardian.isPrimary = false;
  assert.equal(run(state, noPrimary).ok, false);
  const futureDob = submitCommand('op-future-dob');
  futureDob.input.dateOfBirth = '2027-01-01';
  assert.equal(run(state, futureDob).ok, false);
  const foreignApplicant = { ...state, applicants: [...state.applicants, { ...applicant(state, 'app-laila'), id: 'app-foreign', schoolId: 'fictional-river-school' }] };
  const foreignReview = run(foreignApplicant, { kind: 'set_review_status', operationId: 'op-foreign-applicant', applicantId: 'app-foreign', expectedVersion: 1, status: 'reviewing' });
  assert.equal(foreignReview.ok, false);
  const duplicateEnrollmentState = { ...state, enrollments: [...state.enrollments, { id: 'already-onboard-enrollment', schoolId: state.schoolId, studentId: 'student-app-zara', classId: 'class-level-nursery-2-gold', sessionId: 'session-2026', status: 'active' as const }] };
  const zara = applicant(duplicateEnrollmentState, 'app-zara');
  const duplicateEnrollment = run(duplicateEnrollmentState, { kind: 'onboard_approved_applicant', operationId: 'op-enrollment-collision', applicantId: zara.id, expectedVersion: zara.version, admissionNumber: 'GF/27/099', classId: zara.proposedClassId, sessionId: 'session-2026' });
  assert.equal(duplicateEnrollment.ok, false);
});
