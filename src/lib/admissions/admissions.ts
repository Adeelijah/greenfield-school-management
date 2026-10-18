// Persistence-independent admission and guardian contracts. A future server
// adapter must construct VerifiedAdmissionActor from authenticated membership;
// browser supplied school IDs and role claims are never authoritative.
// @ts-expect-error Node's type-stripping tests require explicit source extensions.
import { createStudentRegistrationSchema } from '../students/registration.ts';
// @ts-expect-error Node's type-stripping runner requires explicit source extensions.
import { validateClassStructure, type ClassStructure } from '../../components/academics/class-structure.ts';

export type AdmissionStatus = 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'waitlisted';
export type AdmissionOutcome = Extract<AdmissionStatus, 'approved' | 'rejected' | 'waitlisted'>;
export type GuardianRelationship = 'parent' | 'legal_guardian' | 'other';
export type SchoolRole = 'admin' | 'teacher' | 'bursar';

export type VerifiedAdmissionActor = { membershipId: string; schoolId: string; role: SchoolRole; status: 'active' | 'suspended' };
export type VerifiedAdmissionContext = { actor: VerifiedAdmissionActor; occurredAt: string };
export type AdmissionMembership = VerifiedAdmissionActor;
export type AdmissionClass = { id: string; schoolId: string; levelId: string; name: string; active: boolean };
export type AdmissionSession = { id: string; schoolId: string; label: string; active: boolean };
export type AdmissionGuardianDraft = { fullName: string; phone: string; email: string; relationship: GuardianRelationship; isPrimary: boolean; isEmergency: boolean };
export type AdmissionApplicantInput = {
  firstName: string; lastName: string; dateOfBirth: string; requestedLevelId: string;
  proposedClassId: string; guardian: AdmissionGuardianDraft;
};
export type AdmissionApplicant = AdmissionApplicantInput & {
  id: string; schoolId: string; status: AdmissionStatus; version: number; submittedAt: string;
  guardianIds: string[]; guardianRelationships: Array<Omit<GuardianLink, 'id' | 'schoolId' | 'studentId' | 'active'>>;
  notes: string[]; decisionHistory: AdmissionHistory[]; studentId?: string;
};
export type AdmissionHistory = { from: AdmissionStatus | null; to: AdmissionStatus; note: string; actorMembershipId: string; createdAt: string };
export type AdmissionGuardian = { id: string; schoolId: string; fullName: string; phone: string; email: string; version: number };
export type GuardianLink = {
  id: string; schoolId: string; studentId: string; guardianId: string; relationship: GuardianRelationship;
  isPrimary: boolean; isEmergency: boolean; active: boolean;
};
export type GuardianRelationshipHistory = {
  linkId: string; schoolId: string; studentId: string; guardianId: string; relationship: GuardianRelationship;
  isPrimary: boolean; isEmergency: boolean; endedByOperationId: string;
};
export type AdmissionStudent = { id: string; schoolId: string; admissionNumber: string; firstName: string; lastName: string; dateOfBirth: string; version: number };
export type AdmissionEnrollment = { id: string; schoolId: string; studentId: string; classId: string; sessionId: string; status: 'active' | 'completed' | 'withdrawn' | 'graduated' };
export type AdmissionAuditEvent = {
  id: string; operationId: string; schoolId: string; actorMembershipId: string; action: string;
  entityType: 'admission' | 'student' | 'guardian' | 'guardian_relationship'; entityId: string;
  previousState?: string; nextState?: string;
};
export type AdmissionIdempotencyRecord = { operationId: string; schoolId: string; fingerprint: string; auditEventId: string };

export type AdmissionPreviewState = {
  schoolId: string;
  finalPrimaryYear: 5 | 6;
  structure: ClassStructure;
  classes: AdmissionClass[];
  sessions: AdmissionSession[];
  memberships: AdmissionMembership[];
  applicants: AdmissionApplicant[];
  guardians: AdmissionGuardian[];
  guardianLinks: GuardianLink[];
  relationshipHistory: GuardianRelationshipHistory[];
  students: AdmissionStudent[];
  enrollments: AdmissionEnrollment[];
  auditEvents: AdmissionAuditEvent[];
  idempotency: AdmissionIdempotencyRecord[];
};

export type AdmissionCommand =
  | { kind: 'register_applicant'; operationId: string; applicantId: string; input: AdmissionApplicantInput }
  | { kind: 'set_review_status'; operationId: string; applicantId: string; expectedVersion: number; status: 'reviewing' | 'submitted'; note?: string }
  | { kind: 'decide_admission'; operationId: string; applicantId: string; expectedVersion: number; outcome: AdmissionOutcome; note: string }
  | { kind: 'onboard_approved_applicant'; operationId: string; applicantId: string; expectedVersion: number; admissionNumber: string; classId: string; sessionId: string }
  | { kind: 'create_guardian'; operationId: string; guardianId: string; fullName: string; phone: string; email: string }
  | { kind: 'update_guardian_contact'; operationId: string; guardianId: string; expectedVersion: number; fullName: string; phone: string; email: string }
  | { kind: 'link_guardian'; operationId: string; studentId: string; expectedStudentVersion: number; guardianId: string; relationship: GuardianRelationship; isPrimary: boolean; isEmergency: boolean };

export type AdmissionFailureCode = 'unauthorized' | 'invalid_context' | 'invalid_input' | 'not_found' | 'conflict' | 'stale_version' | 'invalid_transition' | 'invalid_placement';
export type AdmissionCommandResult =
  | { ok: true; state: AdmissionPreviewState; auditEvent: AdmissionAuditEvent; replayed: boolean }
  | { ok: false; code: AdmissionFailureCode; message: string };

export type AdmissionPersistenceAdapter = {
  /** Future contract only: load an authoritative school-scoped snapshot and apply the returned plan atomically. */
  withSchoolTransaction<T>(schoolId: string, lockKeys: readonly string[], work: (transaction: AdmissionTransactionPort) => Promise<T>): Promise<T>;
};
export type AdmissionTransactionPort = {
  loadAdmissionSnapshot(applicantId?: string): Promise<AdmissionPreviewState>;
  applyAdmissionCommand(command: AdmissionCommand, context: VerifiedAdmissionContext): Promise<AdmissionCommandResult>;
};

const activeStatuses = new Set<AdmissionStatus>(['draft', 'submitted', 'reviewing', 'approved', 'waitlisted']);
const transitions: Record<AdmissionStatus, readonly AdmissionStatus[]> = {
  draft: ['submitted'], submitted: ['reviewing'], reviewing: ['approved', 'rejected', 'waitlisted'],
  approved: [], rejected: [], waitlisted: ['reviewing'],
};

export function normalizeContact(value: string): string { return value.replace(/[^\d+]/g, ''); }
export function normalizeEmail(value: string): string { return value.trim().toLocaleLowerCase(); }
export function applicantIdentityKey(value: Pick<AdmissionApplicantInput, 'firstName' | 'lastName' | 'dateOfBirth'>): string {
  return `${value.firstName.trim().toLocaleLowerCase()}|${value.lastName.trim().toLocaleLowerCase()}|${value.dateOfBirth}`;
}
export function canManageAdmissions(actor: VerifiedAdmissionActor | null | undefined, memberships: readonly AdmissionMembership[], schoolId: string): boolean {
  if (!actor || actor.status !== 'active' || actor.role !== 'admin' || actor.schoolId !== schoolId || !actor.membershipId) return false;
  return memberships.some(member => member.membershipId === actor.membershipId && member.schoolId === schoolId && member.status === 'active' && member.role === 'admin');
}

export function validateAdmissionPlacement(state: Pick<AdmissionPreviewState, 'schoolId' | 'finalPrimaryYear' | 'structure' | 'classes'>, levelId: string, classId: string): string | null {
  const structureCheck = validateClassStructure(state.structure);
  if (!structureCheck.valid) return 'The school academic progression is invalid.';
  if (state.structure.schoolId !== state.schoolId) return 'Academic structure does not belong to this school.';
  if (![5, 6].includes(state.finalPrimaryYear)) return 'The configured final Primary level must be Primary 5 or Primary 6.';
  const finalLevel = state.structure.levels.find(item => item.id === state.structure.finalLevelId);
  if (!finalLevel || finalLevel.name !== `Primary ${state.finalPrimaryYear}`) return 'The configured Primary final level does not match the academic progression.';
  const primaryLevels = state.structure.levels.filter(item => item.stage === 'primary');
  if (primaryLevels.length !== state.finalPrimaryYear || primaryLevels.some((item, index) => item.name !== `Primary ${index + 1}`)) return 'Primary levels must progress consecutively from Primary 1 to the configured final level.';
  const level = state.structure.levels.find(item => item.id === levelId);
  const placement = state.classes.find(item => item.id === classId);
  if (!level) return 'Select an active Creche, Nursery, or Primary level.';
  if (!placement || placement.schoolId !== state.schoolId || !placement.active) return 'Select a valid active class placement.';
  if (placement.levelId !== levelId) return 'The proposed class must belong to the requested academic level.';
  return null;
}

export function validateApplicantInput(input: AdmissionApplicantInput, today: string): string | null {
  if (!input || typeof input !== 'object' || typeof input.firstName !== 'string' || typeof input.lastName !== 'string' || typeof input.dateOfBirth !== 'string' || typeof input.requestedLevelId !== 'string' || typeof input.proposedClassId !== 'string') return 'Applicant details are incomplete.';
  const registration = createStudentRegistrationSchema(() => today).safeParse({
    admissionNumber: `PENDING-${input.firstName}-${input.lastName}`.slice(0, 50),
    firstName: input.firstName, lastName: input.lastName, dateOfBirth: input.dateOfBirth || undefined,
  });
  if (!registration.success) return registration.error.issues[0]?.message ?? 'Applicant details are invalid.';
  if (!input.requestedLevelId.trim() || !input.proposedClassId.trim()) return 'Choose a requested academic level and proposed class.';
  const guardian = input.guardian;
  if (!guardian || typeof guardian.fullName !== 'string' || typeof guardian.phone !== 'string' || typeof guardian.email !== 'string' || !guardian.fullName.trim() || guardian.fullName.trim().length > 180) return 'Enter a valid guardian name.';
  if (!guardian.phone.trim() && !guardian.email.trim()) return 'Provide at least one guardian contact method.';
  if (guardian.phone && (normalizeContact(guardian.phone).length < 7 || guardian.phone.length > 32)) return 'Enter a valid guardian phone number.';
  if (guardian.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardian.email.trim()) || guardian.email.length > 254)) return 'Enter a valid guardian email address.';
  if (!['parent', 'legal_guardian', 'other'].includes(guardian.relationship)) return 'Choose a supported guardian relationship.';
  if (typeof guardian.isPrimary !== 'boolean' || typeof guardian.isEmergency !== 'boolean' || !guardian.isPrimary) return 'Each applicant must have exactly one primary guardian and valid contact flags.';
  return null;
}

export function executeAdmissionCommand(state: AdmissionPreviewState, context: VerifiedAdmissionContext | null | undefined, command: AdmissionCommand): AdmissionCommandResult {
  if (!context || !context.actor || !Number.isFinite(Date.parse(context.occurredAt))) return fail('invalid_context', 'Verified school and time context is required.');
  const actor = context.actor;
  if (!canManageAdmissions(actor, state.memberships, state.schoolId)) return fail('unauthorized', 'An active school administrator is required for admissions and guardian records.');
  if (actor.schoolId !== state.schoolId) return fail('invalid_context', 'Verified school context is required.');
  if (!command || typeof command !== 'object' || !['register_applicant', 'set_review_status', 'decide_admission', 'onboard_approved_applicant', 'create_guardian', 'update_guardian_contact', 'link_guardian'].includes(command.kind)) return fail('invalid_input', 'Unsupported admission or guardian command.');
  const unsafe = command as AdmissionCommand & { schoolId?: string; role?: string };
  if (containsAuthorityClaim(unsafe)) return fail('invalid_input', 'School and role claims cannot be supplied in a command.');
  if (typeof command.operationId !== 'string' || !command.operationId.trim() || command.operationId.length > 120) return fail('invalid_input', 'A valid operation identifier is required.');

  const fingerprint = stableFingerprint(command);
  const prior = state.idempotency.find(record => record.operationId === command.operationId && record.schoolId === state.schoolId);
  if (prior) {
    if (prior.fingerprint !== fingerprint) return fail('conflict', 'This operation identifier was already used with different content.');
    const event = state.auditEvents.find(row => row.id === prior.auditEventId);
    return event ? { ok: true, state, auditEvent: event, replayed: true } : fail('conflict', 'The original operation record is incomplete.');
  }

  let next = state;
  let event: AdmissionAuditEvent;
  const timestamp = context.occurredAt;
  const eventId = `audit-${state.schoolId}-${command.operationId}`;
  const newEvent = (action: string, entityType: AdmissionAuditEvent['entityType'], entityId: string, previousState?: string, nextState?: string): AdmissionAuditEvent => ({
    id: eventId, operationId: command.operationId, schoolId: state.schoolId, actorMembershipId: actor.membershipId,
    action, entityType, entityId, ...(previousState ? { previousState } : {}), ...(nextState ? { nextState } : {}),
  });

  if (command.kind === 'register_applicant') {
    if (typeof command.applicantId !== 'string' || !command.applicantId.trim() || state.applicants.some(item => item.id === command.applicantId)) return fail('conflict', 'Applicant identifier is already in use.');
    const invalid = validateApplicantInput(command.input, timestamp.slice(0, 10));
    if (invalid) return fail('invalid_input', invalid);
    const placementError = validateAdmissionPlacement(state, command.input.requestedLevelId, command.input.proposedClassId);
    if (placementError) return fail('invalid_placement', placementError);
    const key = applicantIdentityKey(command.input);
    if (state.applicants.some(item => activeStatuses.has(item.status) && applicantIdentityKey(item) === key) || state.students.some(item => item.schoolId === state.schoolId && applicantIdentityKey(item) === key)) {
      return fail('conflict', 'A matching application or student record already exists in this school.');
    }
    const guardianResult = resolveGuardian(state, command.input.guardian);
    if (!guardianResult.ok) return guardianResult;
    const applicant: AdmissionApplicant = {
      ...command.input, firstName: command.input.firstName.trim(), lastName: command.input.lastName.trim(),
      dateOfBirth: command.input.dateOfBirth, id: command.applicantId, schoolId: state.schoolId,
      status: 'submitted', version: 1, submittedAt: timestamp, guardianIds: [guardianResult.guardian.id],
      guardianRelationships: [{ guardianId: guardianResult.guardian.id, relationship: command.input.guardian.relationship, isPrimary: true, isEmergency: command.input.guardian.isEmergency }], notes: [],
      decisionHistory: [{ from: null, to: 'submitted', note: 'Application submitted.', actorMembershipId: actor.membershipId, createdAt: timestamp }],
    };
    next = { ...state, applicants: [...state.applicants, applicant], guardians: guardianResult.isNew ? [...state.guardians, guardianResult.guardian] : state.guardians };
    event = newEvent('admission.application_submitted', 'admission', applicant.id, undefined, 'submitted');
  } else if (command.kind === 'set_review_status') {
    const applicant = findApplicant(state, command.applicantId);
    if (!applicant) return fail('not_found', 'Application was not found in this school.');
    if (applicant.version !== command.expectedVersion) return fail('stale_version', 'Application changed. Refresh it before continuing.');
    if (!transitions[applicant.status].includes(command.status)) return fail('invalid_transition', `Application cannot move from ${applicant.status} to ${command.status}.`);
    if (command.note !== undefined && (typeof command.note !== 'string' || command.note.length > 1000)) return fail('invalid_input', 'Admission notes must be 1,000 characters or less.');
    next = replaceApplicant(state, {
      ...applicant, status: command.status, version: applicant.version + 1,
      notes: command.note?.trim() ? [...applicant.notes, command.note.trim()] : applicant.notes,
      decisionHistory: [...applicant.decisionHistory, { from: applicant.status, to: command.status, note: command.note?.trim() ?? '', actorMembershipId: actor.membershipId, createdAt: timestamp }],
    });
    event = newEvent('admission.status_changed', 'admission', applicant.id, applicant.status, command.status);
  } else if (command.kind === 'decide_admission') {
    const applicant = findApplicant(state, command.applicantId);
    if (!applicant) return fail('not_found', 'Application was not found in this school.');
    if (applicant.version !== command.expectedVersion) return fail('stale_version', 'Application changed. Refresh it before deciding.');
    if (applicant.status !== 'reviewing' || !transitions.reviewing.includes(command.outcome)) return fail('invalid_transition', 'Only a reviewing application can receive a final admission decision.');
    if (typeof command.note !== 'string' || !command.note.trim() || command.note.trim().length > 1000) return fail('invalid_input', 'Enter an admission decision note of 1,000 characters or less.');
    if (command.outcome === 'approved') {
      const placementError = validateAdmissionPlacement(state, applicant.requestedLevelId, applicant.proposedClassId);
      if (placementError) return fail('invalid_placement', placementError);
    }
    const updated = { ...applicant, status: command.outcome, version: applicant.version + 1,
      notes: [...applicant.notes, command.note.trim()],
      decisionHistory: [...applicant.decisionHistory, { from: applicant.status, to: command.outcome, note: command.note.trim(), actorMembershipId: actor.membershipId, createdAt: timestamp }] };
    next = replaceApplicant(state, updated);
    event = newEvent(`admission.${command.outcome}`, 'admission', applicant.id, applicant.status, command.outcome);
  } else if (command.kind === 'onboard_approved_applicant') {
    const applicant = findApplicant(state, command.applicantId);
    if (!applicant) return fail('not_found', 'Application was not found in this school.');
    if (applicant.version !== command.expectedVersion) return fail('stale_version', 'Application changed. Refresh it before onboarding.');
    if (applicant.status !== 'approved' || applicant.studentId) return fail('invalid_transition', 'Only an approved applicant without a student record can be onboarded.');
    const placementError = validateAdmissionPlacement(state, applicant.requestedLevelId, command.classId);
    if (placementError) return fail('invalid_placement', placementError);
    if (command.classId !== applicant.proposedClassId) return fail('invalid_placement', 'Onboarding class must match the reviewed proposed placement.');
    const session = state.sessions.find(item => item.id === command.sessionId && item.schoolId === state.schoolId && item.active);
    if (!session) return fail('invalid_placement', 'Select an active academic session.');
    const registration = createStudentRegistrationSchema(() => timestamp.slice(0, 10)).safeParse({ admissionNumber: command.admissionNumber, firstName: applicant.firstName, lastName: applicant.lastName, dateOfBirth: applicant.dateOfBirth || undefined });
    if (!registration.success) return fail('invalid_input', registration.error.issues[0]?.message ?? 'Student registration details are invalid.');
    const normalizedAdmissionNumber = command.admissionNumber.trim().toLocaleLowerCase();
    if (state.students.some(student => student.schoolId === state.schoolId && student.admissionNumber.toLocaleLowerCase() === normalizedAdmissionNumber)) return fail('conflict', 'This admission number is already in use.');
    const identity = applicantIdentityKey(applicant);
    const existing = state.students.find(student => student.schoolId === state.schoolId && applicantIdentityKey(student) === identity);
    if (existing) return fail('conflict', 'A matching student record already exists; onboarding was stopped to prevent duplication.');
    const studentId = `student-${applicant.id}`;
    if (state.students.some(student => student.id === studentId) || state.enrollments.some(row => row.studentId === studentId && row.sessionId === session.id)) return fail('conflict', 'Student or enrollment already exists for this application.');
    const student: AdmissionStudent = { id: studentId, schoolId: state.schoolId, admissionNumber: registration.data.admissionNumber, firstName: registration.data.firstName, lastName: registration.data.lastName, dateOfBirth: applicant.dateOfBirth, version: 1 };
    const enrollment: AdmissionEnrollment = { id: `enrollment-${applicant.id}-${session.id}`, schoolId: state.schoolId, studentId, classId: command.classId, sessionId: session.id, status: 'active' };
    if (!applicant.guardianRelationships.some(link => link.isPrimary) || applicant.guardianRelationships.some(link => !state.guardians.some(guardian => guardian.id === link.guardianId && guardian.schoolId === state.schoolId))) return fail('conflict', 'Approved applicant guardian links are incomplete or outside this school.');
    if (applicant.guardianRelationships.filter(link => link.isPrimary).length !== 1 || new Set(applicant.guardianRelationships.map(link => link.guardianId)).size !== applicant.guardianRelationships.length || applicant.guardianIds.length !== applicant.guardianRelationships.length || applicant.guardianIds.some(id => !applicant.guardianRelationships.some(link => link.guardianId === id))) return fail('conflict', 'Applicant guardian relationships are inconsistent.');
    const guardianLinks = applicant.guardianRelationships.map((link): GuardianLink => ({ id: `guardian-link-${applicant.id}-${link.guardianId}`, schoolId: state.schoolId, studentId, ...link, active: true }));
    const updated = { ...applicant, studentId, version: applicant.version + 1 };
    next = { ...state, applicants: state.applicants.map(row => row.id === applicant.id ? updated : row), students: [...state.students, student], enrollments: [...state.enrollments, enrollment], guardianLinks: [...state.guardianLinks, ...guardianLinks] };
    event = newEvent('admission.applicant_onboarded', 'student', student.id, 'approved_applicant', 'active_student');
  } else if (command.kind === 'create_guardian') {
    if (typeof command.guardianId !== 'string' || !command.guardianId.trim() || state.guardians.some(item => item.id === command.guardianId)) return fail('conflict', 'Guardian identifier is already in use.');
    const normalized = normalizeGuardianInput(command);
    if (!normalized.ok) return normalized;
    if (findDuplicateGuardian(state.guardians, state.schoolId, normalized.value)) return fail('conflict', 'A guardian with this phone or email already exists in this school.');
    const guardian: AdmissionGuardian = { id: command.guardianId, schoolId: state.schoolId, ...normalized.value, version: 1 };
    next = { ...state, guardians: [...state.guardians, guardian] };
    event = newEvent('guardian.created', 'guardian', guardian.id);
  } else if (command.kind === 'update_guardian_contact') {
    const guardian = state.guardians.find(item => item.id === command.guardianId && item.schoolId === state.schoolId);
    if (!guardian) return fail('not_found', 'Guardian was not found in this school.');
    if (guardian.version !== command.expectedVersion) return fail('stale_version', 'Guardian contact changed. Refresh before editing.');
    const normalized = normalizeGuardianInput(command);
    if (!normalized.ok) return normalized;
    const duplicate = findDuplicateGuardian(state.guardians, state.schoolId, normalized.value, guardian.id);
    if (duplicate) return fail('conflict', 'Another guardian already uses this phone or email in this school.');
    const updated = { ...guardian, ...normalized.value, version: guardian.version + 1 };
    next = { ...state, guardians: state.guardians.map(item => item.id === guardian.id ? updated : item) };
    event = newEvent('guardian.contact_updated', 'guardian', guardian.id);
  } else {
    const student = state.students.find(item => item.id === command.studentId && item.schoolId === state.schoolId);
    const guardian = state.guardians.find(item => item.id === command.guardianId && item.schoolId === state.schoolId);
    if (!student || !guardian) return fail('not_found', 'Student or guardian was not found in this school.');
    if (student.version !== command.expectedStudentVersion) return fail('stale_version', 'Student guardian links changed. Refresh before updating.');
    if (!['parent', 'legal_guardian', 'other'].includes(command.relationship)) return fail('invalid_input', 'Choose a supported guardian relationship.');
    const current = state.guardianLinks.find(row => row.active && row.schoolId === state.schoolId && row.studentId === student.id && row.guardianId === guardian.id);
    if (typeof command.isPrimary !== 'boolean' || typeof command.isEmergency !== 'boolean') return fail('invalid_input', 'Primary and emergency contact flags must be explicit booleans.');
    if (current && current.relationship === command.relationship && current.isPrimary === command.isPrimary && current.isEmergency === command.isEmergency) return fail('conflict', 'This guardian relationship is already active.');
    const currentPrimary = state.guardianLinks.find(row => row.active && row.studentId === student.id && row.isPrimary);
    if (!currentPrimary && !command.isPrimary) return fail('invalid_input', 'A student must have one primary guardian.');
    if (current?.isPrimary && !command.isPrimary && (!currentPrimary || currentPrimary.id === current.id)) return fail('invalid_input', 'A student must retain one primary guardian.');
    const history = [...state.relationshipHistory];
    let links = [...state.guardianLinks];
    for (const prior of links.filter(row => row.active && row.studentId === student.id && (row.id === current?.id || (command.isPrimary && row.isPrimary)))) {
      history.push({ linkId: prior.id, schoolId: prior.schoolId, studentId: prior.studentId, guardianId: prior.guardianId, relationship: prior.relationship, isPrimary: prior.isPrimary, isEmergency: prior.isEmergency, endedByOperationId: command.operationId });
      links = links.map(row => row.id === prior.id ? { ...row, active: false } : row);
      if (prior.isPrimary && command.isPrimary && prior.id !== current?.id) links.push({ ...prior, id: `${prior.id}-revision-${command.operationId}`, isPrimary: false, active: true });
    }
    const replacement: GuardianLink = { id: `guardian-link-${command.operationId}`, schoolId: state.schoolId, studentId: student.id, guardianId: guardian.id, relationship: command.relationship, isPrimary: command.isPrimary, isEmergency: command.isEmergency, active: true };
    next = { ...state, guardianLinks: [...links, replacement], relationshipHistory: history, students: state.students.map(item => item.id === student.id ? { ...item, version: item.version + 1 } : item) };
    event = newEvent('guardian.relationship_updated', 'guardian_relationship', replacement.id);
  }

  next = { ...next, auditEvents: [...next.auditEvents, event], idempotency: [...next.idempotency, { operationId: command.operationId, schoolId: state.schoolId, fingerprint, auditEventId: event.id }] };
  return { ok: true, state: next, auditEvent: event, replayed: false };
}

function resolveGuardian(state: AdmissionPreviewState, draft: AdmissionGuardianDraft): { ok: true; guardian: AdmissionGuardian; isNew: boolean } | { ok: false; code: AdmissionFailureCode; message: string } {
  const input = normalizeGuardianInput(draft);
  if (!input.ok) return input;
  const match = findDuplicateGuardian(state.guardians, state.schoolId, input.value);
  if (match) {
    if (match.fullName.trim().toLocaleLowerCase() !== input.value.fullName.toLocaleLowerCase()) return fail('conflict', 'Guardian contact details match a different guardian identity.');
    if ((input.value.phone && match.phone && normalizeContact(input.value.phone) !== normalizeContact(match.phone)) || (input.value.email && match.email && normalizeEmail(input.value.email) !== normalizeEmail(match.email))) return fail('conflict', 'Guardian contact details conflict with the existing contact identity.');
    return { ok: true, guardian: match, isNew: false };
  }
  return { ok: true, guardian: { id: `guardian-${state.guardians.length + 1}`, schoolId: state.schoolId, ...input.value, version: 1 }, isNew: true };
}
function normalizeGuardianInput(value: { fullName: string; phone: string; email: string }): { ok: true; value: { fullName: string; phone: string; email: string } } | { ok: false; code: AdmissionFailureCode; message: string } {
  if (!value || typeof value.fullName !== 'string' || typeof value.phone !== 'string' || typeof value.email !== 'string') return fail('invalid_input', 'Guardian contact details are incomplete.');
  const fullName = value.fullName.trim();
  const phone = value.phone.trim();
  const email = value.email.trim();
  if (!fullName || fullName.length > 180 || (!phone && !email)) return fail('invalid_input', 'A valid guardian name and at least one contact method are required.');
  if (phone && (normalizeContact(phone).length < 7 || phone.length > 32)) return fail('invalid_input', 'Enter a valid guardian phone number.');
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return fail('invalid_input', 'Enter a valid guardian email address.');
  return { ok: true, value: { fullName, phone, email } };
}
function findDuplicateGuardian(guardians: readonly AdmissionGuardian[], schoolId: string, input: { fullName: string; phone: string; email: string }, excludingId?: string): AdmissionGuardian | undefined {
  return guardians.find(guardian => guardian.id !== excludingId && guardian.schoolId === schoolId && (
    (!!input.phone && !!guardian.phone && normalizeContact(guardian.phone) === normalizeContact(input.phone)) ||
    (!!input.email && !!guardian.email && normalizeEmail(guardian.email) === normalizeEmail(input.email))
  ));
}
function findApplicant(state: AdmissionPreviewState, id: string): AdmissionApplicant | undefined { return state.applicants.find(item => item.id === id && item.schoolId === state.schoolId); }
function replaceApplicant(state: AdmissionPreviewState, updated: AdmissionApplicant): AdmissionPreviewState { return { ...state, applicants: state.applicants.map(item => item.id === updated.id ? updated : item) }; }
function stableFingerprint(value: unknown): string {
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sort(child)]));
    return item;
  };
  return JSON.stringify(sort(value));
}
function containsAuthorityClaim(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsAuthorityClaim);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => ['schoolId', 'school_id', 'role', 'membershipId', 'membership_id'].includes(key) || containsAuthorityClaim(child));
}
function fail(code: AdmissionFailureCode, message: string): Extract<AdmissionCommandResult, { ok: false }> { return { ok: false, code, message }; }
