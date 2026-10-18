import { createHash } from 'node:crypto';
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { validateClassStructure, type ClassStructure } from '../../components/academics/class-structure.ts';
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { sessionYear, validateAcademicDecision } from '../../components/students/academic-progression.ts';
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { validateClassAssignment } from '../../components/students/class-assignment-validation.ts';
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { validateStudentExit, type StudentExitKind, type StudentExitReason } from '../../components/students/student-exit-validation.ts';
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { canPerformLifecycleOperation, type LifecycleAccess } from './lifecycle-authorization.ts';

export type DecisionKind = 'promote' | 'repeat' | 'graduate';
export type Placement = { classId: string; levelId: string; sectionId: string; sessionId: string };
export type DecisionSelection =
  | { kind: 'promote' | 'repeat'; destination: Placement }
  | { kind: 'graduate' };

type CommandBase = { studentId: string; idempotencyKey: string; expectedStudentVersion: number; expectedStructureVersion: number };
export type LifecycleCommand =
  | (CommandBase & { kind: 'enroll'; destination: Placement })
  | (CommandBase & { kind: 'propose_decision'; sourceEnrollmentId: string; decision: DecisionSelection })
  | (CommandBase & { kind: 'finalize_decision'; sourceEnrollmentId: string; proposalId: string })
  | (CommandBase & { kind: 'transfer' | 'early_exit'; sourceEnrollmentId: string; reason: StudentExitReason; effectiveDate: string; destinationSchool: string; guardianReviewConfirmed: boolean })
  | (CommandBase & { kind: 'readmit'; departureId: string; destination: Placement; guardianReviewConfirmed: boolean });

export type LifecycleStudent = { id: string; schoolId: string; status: 'active' | 'graduated' | 'withdrawn'; version: number };
export type LifecycleEnrollment = { id: string; schoolId: string; studentId: string; classId: string; sessionId: string; status: 'active' | 'completed' | 'graduated' | 'withdrawn' };
export type LifecycleClass = { id: string; schoolId: string; levelId: string; sectionId: string };
export type LifecycleSession = { id: string; schoolId: string; label: string };
export type LifecycleDecision = { id: string; schoolId: string; studentId: string; sourceEnrollmentId: string; selection: DecisionSelection; status: 'proposed' | 'applied' | 'rejected'; structureVersion: number; studentVersion: number };
export type LifecycleDeparture = { id: string; schoolId: string; studentId: string; sourceEnrollmentId: string; kind: StudentExitKind };
export type LifecycleReadmission = { id: string; schoolId: string; studentId: string; departureId: string; enrollmentId: string };
export type IdempotencyRecord = { schoolId: string; key: string; fingerprint: string; operationId: string };

/** All rows must be loaded by a future adapter with authoritative school predicates. */
export type LifecycleSnapshot = {
  schoolId: string;
  structure: ClassStructure;
  structureVersion: number;
  student: LifecycleStudent | null;
  classes: readonly LifecycleClass[];
  sessions: readonly LifecycleSession[];
  enrollments: readonly LifecycleEnrollment[];
  decisions: readonly LifecycleDecision[];
  departures: readonly LifecycleDeparture[];
  readmissions: readonly LifecycleReadmission[];
  idempotency: readonly IdempotencyRecord[];
};
export type VerifiedLifecycleContext = {
  verifiedAuthUserId: string;
  membershipId: string;
  access: LifecycleAccess;
  requestId: string;
  today: string;
  /** Authoritative assignment rows; never client-provided claims. */
  teacherAssignments: readonly { schoolId: string; membershipId: string; classId: string; sessionId: string; active: boolean }[];
};

export type LifecycleEffect =
  | { kind: 'insert_enrollment'; studentId: string; placement: Placement }
  | { kind: 'insert_proposal'; studentId: string; sourceEnrollmentId: string; selection: DecisionSelection; structureVersion: number }
  | { kind: 'apply_decision'; proposalId: string }
  | { kind: 'insert_departure'; studentId: string; sourceEnrollmentId: string; departureKind: StudentExitKind; reason: StudentExitReason; effectiveDate: string; destinationSchool: string }
  | { kind: 'insert_readmission'; studentId: string; departureId: string; destination: Placement }
  | { kind: 'set_student_status'; studentId: string; status: 'active' | 'graduated' | 'withdrawn' }
  | { kind: 'bump_student_version'; studentId: string; fromVersion: number }
  | { kind: 'close_source_enrollment'; enrollmentId: string }
  | { kind: 'set_enrollment_status'; enrollmentId: string; status: 'graduated' | 'withdrawn' };
export type LifecycleAuditEvent = {
  schoolId: string; actorMembershipId: string; actorRole: 'admin'; requestId: string;
  action: 'enroll' | DecisionKind | StudentExitKind | 'readmit'; studentId: string;
  sourceEnrollmentId: string | null; previousState: LifecycleStudent['status']; nextState: LifecycleStudent['status'];
};
export type LifecyclePlan = {
  schoolId: string;
  idempotency: { key: string; fingerprint: string };
  preconditions: { lockOrder: readonly ['school_structure', 'student', 'source_enrollment']; structureVersion: number; studentVersion: number; sourceEnrollmentId: string | null };
  effects: readonly LifecycleEffect[];
  audit: LifecycleAuditEvent | null;
};
export type LifecycleFailureCode = 'missing_context' | 'unauthorized' | 'school_mismatch' | 'stale_state' | 'invalid_structure' | 'invalid_selection' | 'invalid_status' | 'duplicate' | 'conflict' | 'idempotency_conflict';
export type LifecycleResult =
  | { ok: true; replay: false; plan: LifecyclePlan }
  | { ok: true; replay: true; operationId: string }
  | { ok: false; code: LifecycleFailureCode; message: string };

/** Future server adapter shape; no implementation or connection is provided. */
export interface LifecycleTransactionPort {
  loadLockedSnapshot(schoolId: string, studentId: string): Promise<LifecycleSnapshot>;
  applyAtomically(plan: LifecyclePlan): Promise<{ operationId: string }>;
}
export interface LifecyclePersistenceAdapter {
  withStudentTransaction<T>(schoolId: string, studentId: string, work: (transaction: LifecycleTransactionPort) => Promise<T>): Promise<T>;
}

const fail = (code: LifecycleFailureCode, message: string): LifecycleResult => ({ ok: false, code, message });
const nonempty = (value: string | undefined | null): value is string => typeof value === 'string' && value.trim().length > 0;
const sameSchool = (schoolId: string, rows: readonly { schoolId: string }[]) => rows.every(row => row.schoolId === schoolId);
function validDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  return value;
}

/** Stable content hash; excludes the retry key and all actor-controlled role claims. */
export function lifecycleFingerprint(schoolId: string, command: LifecycleCommand): string {
  const { idempotencyKey: _key, ...content } = command;
  void _key;
  return createHash('sha256').update(JSON.stringify(canonical([schoolId, content]))).digest('hex');
}

function placementError(snapshot: LifecycleSnapshot, placement: Placement): string | null {
  const target = snapshot.classes.find(row => row.id === placement.classId && row.schoolId === snapshot.schoolId);
  const session = snapshot.sessions.find(row => row.id === placement.sessionId && row.schoolId === snapshot.schoolId);
  const level = snapshot.structure.levels.find(row => row.id === placement.levelId);
  if (!target || !session || !level || target.levelId !== level.id || target.sectionId !== placement.sectionId || !level.sections.some(row => row.id === placement.sectionId)) return 'Destination class, level, section or session is unavailable.';
  return null;
}

function currentEnrollment(snapshot: LifecycleSnapshot): LifecycleEnrollment | null {
  const active = snapshot.enrollments.filter(row => row.status === 'active');
  return active.length === 1 ? active[0] : null;
}

function audit(context: VerifiedLifecycleContext, snapshot: LifecycleSnapshot, action: LifecycleAuditEvent['action'], sourceEnrollmentId: string | null, nextState: LifecycleStudent['status']): LifecycleAuditEvent {
  return { schoolId: snapshot.schoolId, actorMembershipId: context.membershipId, actorRole: 'admin', requestId: context.requestId, action, studentId: snapshot.student!.id, sourceEnrollmentId, previousState: snapshot.student!.status, nextState };
}

/** Produces an immutable transaction plan. No effect is executed here. */
export function decideLifecycleCommand(command: LifecycleCommand, snapshot: LifecycleSnapshot, context: VerifiedLifecycleContext): LifecycleResult {
  if (!command || !snapshot || !context || !nonempty(command.studentId) || !nonempty(command.idempotencyKey) || !nonempty(context.verifiedAuthUserId) || !nonempty(context.membershipId) || !nonempty(context.requestId) || !validDate(context.today) || !context.access || !nonempty(context.access.schoolId) || !Array.isArray(context.teacherAssignments)) return fail('missing_context', 'Verified command context is required.');
  if ('schoolId' in command || 'role' in command || 'teacherAssignments' in command) return fail('invalid_selection', 'School, role and assignment claims are not accepted in commands.');
  if (!snapshot.student || !nonempty(snapshot.schoolId) || !snapshot.structure || !Array.isArray(snapshot.structure.levels) || !Array.isArray(snapshot.classes) || !Array.isArray(snapshot.sessions) || !Array.isArray(snapshot.enrollments) || !Array.isArray(snapshot.decisions) || !Array.isArray(snapshot.departures) || !Array.isArray(snapshot.readmissions) || !Array.isArray(snapshot.idempotency)) return fail('missing_context', 'A complete student snapshot is required.');
  if (context.access.schoolId !== snapshot.schoolId || snapshot.student.schoolId !== snapshot.schoolId || snapshot.structure.schoolId !== snapshot.schoolId || snapshot.student.id !== command.studentId || !sameSchool(snapshot.schoolId, [...snapshot.classes, ...snapshot.sessions, ...snapshot.enrollments, ...snapshot.decisions, ...snapshot.departures, ...snapshot.readmissions, ...snapshot.idempotency])) return fail('school_mismatch', 'Student or related records do not belong to the verified school.');
  if (snapshot.enrollments.some(row => row.studentId !== command.studentId) || snapshot.decisions.some(row => row.studentId !== command.studentId) || snapshot.departures.some(row => row.studentId !== command.studentId) || snapshot.readmissions.some(row => row.studentId !== command.studentId)) return fail('school_mismatch', 'Student history is inconsistent.');
  if (!['enroll', 'propose_decision', 'finalize_decision', 'transfer', 'early_exit', 'readmit'].includes(command.kind)) return fail('invalid_selection', 'Unknown lifecycle command.');
  if ((command.kind === 'enroll' || command.kind === 'readmit') && !command.destination) return fail('missing_context', 'Destination placement is required.');
  if (command.kind === 'propose_decision' && (!command.decision || !['promote', 'repeat', 'graduate'].includes(command.decision.kind) || (command.decision.kind !== 'graduate' && !command.decision.destination))) return fail('missing_context', 'Academic decision is required.');
  if (command.kind === 'finalize_decision' && !nonempty(command.proposalId)) return fail('missing_context', 'Proposal identifier is required.');
  if ((command.kind === 'transfer' || command.kind === 'early_exit') && (!nonempty(command.reason) || !nonempty(command.effectiveDate) || typeof command.destinationSchool !== 'string')) return fail('missing_context', 'Departure details are required.');
  if (command.kind === 'readmit' && !nonempty(command.departureId)) return fail('missing_context', 'Departure identifier is required.');
  const operation = command.kind === 'enroll' ? 'manage_enrollment' : command.kind === 'propose_decision' ? 'propose_progression' : command.kind === 'finalize_decision' ? 'decide_progression' : command.kind === 'readmit' ? 'readmit_student' : 'record_exit';
  const sourceId = 'sourceEnrollmentId' in command ? command.sourceEnrollmentId : null;
  const assignedSource = sourceId === null ? null : snapshot.enrollments.find(row => row.id === sourceId);
  const assigned = Boolean(assignedSource && context.teacherAssignments.some(row => row.active && row.schoolId === snapshot.schoolId && row.membershipId === context.membershipId && row.classId === assignedSource.classId && row.sessionId === assignedSource.sessionId));
  if (!canPerformLifecycleOperation(context.access, snapshot.schoolId, operation, assigned)) return fail('unauthorized', 'Lifecycle operation is not authorized.');
  const fingerprint = lifecycleFingerprint(snapshot.schoolId, command);
  const prior = snapshot.idempotency.find(row => row.key === command.idempotencyKey);
  if (prior) return prior.fingerprint === fingerprint ? { ok: true, replay: true, operationId: prior.operationId } : fail('idempotency_conflict', 'Idempotency key was used for a different command.');
  if (!Number.isSafeInteger(command.expectedStudentVersion) || !Number.isSafeInteger(command.expectedStructureVersion) || command.expectedStudentVersion !== snapshot.student.version || command.expectedStructureVersion !== snapshot.structureVersion) return fail('stale_state', 'Student or structure version changed.');
  const structureValid = validateClassStructure(snapshot.structure);
  if (!structureValid.valid) return fail('invalid_structure', structureValid.errors[0]);
  const primary = snapshot.structure.levels.filter(level => level.stage === 'primary');
  const finalYear = Number(snapshot.structure.levels.at(-1)?.name.trim().replace(/^Primary /i, ''));
  if (primary.length !== finalYear || primary.some((level, index) => level.name.trim().toLowerCase() !== `primary ${index + 1}`)) return fail('invalid_structure', 'Primary progression must be consecutive through the configured final year.');
  const plan = (effects: LifecycleEffect[], event: LifecycleAuditEvent | null, lockedSource: string | null): LifecycleResult => ({ ok: true, replay: false, plan: { schoolId: snapshot.schoolId, idempotency: { key: command.idempotencyKey, fingerprint }, preconditions: { lockOrder: ['school_structure', 'student', 'source_enrollment'], structureVersion: snapshot.structureVersion, studentVersion: snapshot.student!.version, sourceEnrollmentId: lockedSource }, effects: event ? [...effects, { kind: 'bump_student_version', studentId: command.studentId, fromVersion: snapshot.student!.version }] : effects, audit: event } });

  if (command.kind === 'enroll') {
    if (snapshot.student.status !== 'active' || snapshot.enrollments.length || snapshot.departures.length) return fail('invalid_status', 'Initial enrollment requires an active student without history.');
    const error = placementError(snapshot, command.destination);
    if (error) return fail('invalid_selection', error);
    const assignedClass = validateClassAssignment({ classId: command.destination.classId, sessionId: command.destination.sessionId }, snapshot.classes.map(row => ({ id: row.id, name: row.levelId, section: row.sectionId })), snapshot.sessions.map(row => ({ id: row.id, label: row.label, isCurrent: false })), snapshot.enrollments.map(row => ({ id: row.id, studentId: row.studentId, classId: row.classId, sessionId: row.sessionId, status: row.status })));
    if (!assignedClass.valid) return fail('duplicate', assignedClass.error);
    return plan([{ kind: 'insert_enrollment', studentId: command.studentId, placement: command.destination }], audit(context, snapshot, 'enroll', null, 'active'), null);
  }

  if (command.kind === 'readmit') {
    if (snapshot.student.status !== 'withdrawn' || !command.guardianReviewConfirmed) return fail('invalid_status', 'Re-admission requires a withdrawn student and guardian review.');
    const departure = snapshot.departures.find(row => row.id === command.departureId);
    const openDepartures = snapshot.departures.filter(row => !snapshot.readmissions.some(readmission => readmission.departureId === row.id));
    if (!departure || openDepartures.length !== 1 || openDepartures[0].id !== departure.id || currentEnrollment(snapshot)) return fail('conflict', 'Departure is unavailable for re-admission.');
    const error = placementError(snapshot, command.destination);
    if (error) return fail('invalid_selection', error);
    if (snapshot.enrollments.some(row => row.sessionId === command.destination.sessionId)) return fail('duplicate', 'Student already has an enrollment in that session.');
    const sourceSession = snapshot.sessions.find(row => row.id === snapshot.enrollments.find(enrollment => enrollment.id === departure.sourceEnrollmentId)?.sessionId);
    const targetSession = snapshot.sessions.find(row => row.id === command.destination.sessionId);
    if (!sourceSession || !targetSession || sessionYear(sourceSession.label) === null || sessionYear(targetSession.label) === null || sessionYear(targetSession.label)! <= sessionYear(sourceSession.label)!) return fail('invalid_selection', 'Re-admission requires a later valid session.');
    return plan([{ kind: 'insert_enrollment', studentId: command.studentId, placement: command.destination }, { kind: 'insert_readmission', studentId: command.studentId, departureId: departure.id, destination: command.destination }, { kind: 'set_student_status', studentId: command.studentId, status: 'active' }], audit(context, snapshot, 'readmit', departure.sourceEnrollmentId, 'active'), departure.sourceEnrollmentId);
  }

  if (!sourceId) return fail('missing_context', 'Source enrollment is required.');
  const source = currentEnrollment(snapshot);
  if (!source || source.id !== sourceId || snapshot.student.status !== 'active') return fail('invalid_status', 'An active source enrollment and student are required.');
  const sourceClass = snapshot.classes.find(row => row.id === source.classId);
  const sourceSession = snapshot.sessions.find(row => row.id === source.sessionId);
  if (!sourceClass || !sourceSession) return fail('invalid_selection', 'Source class or session is unavailable.');
  const priorApplied = snapshot.decisions.some(row => row.sourceEnrollmentId === source.id && row.status === 'applied');
  const priorDeparture = snapshot.departures.some(row => row.sourceEnrollmentId === source.id && !snapshot.readmissions.some(readmission => readmission.departureId === row.id));
  if (priorApplied || priorDeparture) return fail('conflict', 'Source enrollment already has a final lifecycle outcome.');

  const validateSelection = (selection: DecisionSelection): string | null => {
    const levelId = selection.kind === 'graduate' ? '' : selection.destination.levelId;
    const sectionId = selection.kind === 'graduate' ? '' : selection.destination.sectionId;
    const destinationSession = selection.kind === 'graduate' ? null : snapshot.sessions.find(row => row.id === selection.destination.sessionId);
    if (selection.kind !== 'graduate') {
      const error = placementError(snapshot, selection.destination);
      if (error) return error;
      if (!destinationSession) return 'Destination session is unavailable.';
    }
    if (selection.kind === 'graduate') {
      if (sourceClass.levelId !== snapshot.structure.finalLevelId) return 'Only the configured final Primary level may graduate.';
      if (snapshot.decisions.some(row => row.sourceEnrollmentId === source.id && row.status === 'applied')) return 'Graduation was already applied.';
      return null;
    }
    return validateAcademicDecision(snapshot.structure, { id: command.studentId, schoolId: snapshot.schoolId, levelId: sourceClass.levelId, sectionId: sourceClass.sectionId, currentSession: sourceSession.label, status: snapshot.student!.status, enrolledSessions: snapshot.enrollments.map(row => snapshot.sessions.find(session => session.id === row.sessionId)?.label ?? '') }, { studentId: command.studentId, action: selection.kind, levelId, sectionId }, destinationSession!.label);
  };

  if (command.kind === 'propose_decision') {
    if (snapshot.decisions.some(row => row.sourceEnrollmentId === source.id && row.status === 'proposed')) return fail('conflict', 'A proposal already exists for this enrollment.');
    const error = validateSelection(command.decision);
    if (error) return fail('invalid_selection', error);
    return plan([{ kind: 'insert_proposal', studentId: command.studentId, sourceEnrollmentId: source.id, selection: command.decision, structureVersion: snapshot.structureVersion }], null, source.id);
  }

  if (command.kind === 'finalize_decision') {
    const proposal = snapshot.decisions.find(row => row.id === command.proposalId && row.sourceEnrollmentId === source.id && row.status === 'proposed');
    if (!proposal) return fail('conflict', 'A pending proposal is required.');
    if (proposal.structureVersion !== snapshot.structureVersion || proposal.studentVersion !== snapshot.student.version) return fail('stale_state', 'Proposal must be reviewed against current state.');
    const error = validateSelection(proposal.selection);
    if (error) return fail('invalid_selection', error);
    const effects: LifecycleEffect[] = [{ kind: 'apply_decision', proposalId: proposal.id }];
    if (proposal.selection.kind === 'graduate') {
      effects.push({ kind: 'set_enrollment_status', enrollmentId: source.id, status: 'graduated' }, { kind: 'set_student_status', studentId: command.studentId, status: 'graduated' });
    } else effects.push({ kind: 'close_source_enrollment', enrollmentId: source.id }, { kind: 'insert_enrollment', studentId: command.studentId, placement: proposal.selection.destination });
    return plan(effects, audit(context, snapshot, proposal.selection.kind, source.id, proposal.selection.kind === 'graduate' ? 'graduated' : 'active'), source.id);
  }

  if (command.kind === 'transfer' || command.kind === 'early_exit') {
    if (snapshot.decisions.some(row => row.sourceEnrollmentId === source.id && row.status === 'proposed')) return fail('conflict', 'Resolve the pending academic proposal first.');
    const draft = { studentId: command.studentId, kind: command.kind, reason: command.reason, effectiveDate: command.effectiveDate, destinationSchool: command.destinationSchool, notes: '', guardianRequestConfirmed: command.guardianReviewConfirmed };
    const validation = validateStudentExit({ id: command.studentId, name: '', admissionNumber: '', className: '', status: snapshot.student.status }, draft, [], context.today);
    if (!validation.valid) return fail('invalid_selection', validation.errors[0]);
    return plan([{ kind: 'insert_departure', studentId: command.studentId, sourceEnrollmentId: source.id, departureKind: command.kind, reason: command.reason, effectiveDate: command.effectiveDate, destinationSchool: command.destinationSchool.trim() }, { kind: 'set_enrollment_status', enrollmentId: source.id, status: 'withdrawn' }, { kind: 'set_student_status', studentId: command.studentId, status: 'withdrawn' }], audit(context, snapshot, command.kind, source.id, 'withdrawn'), source.id);
  }
  return fail('invalid_selection', 'Unknown lifecycle command.');
}
