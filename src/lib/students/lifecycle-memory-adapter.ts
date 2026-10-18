// Fictional, process-local simulator. Never import this into a production handler.
// @ts-expect-error Node 22 offline tests require explicit TypeScript extensions.
import { decideLifecycleCommand, type IdempotencyRecord, type LifecycleAuditEvent, type LifecycleClass, type LifecycleCommand, type LifecycleDecision, type LifecycleDeparture, type LifecycleEffect, type LifecycleEnrollment, type LifecyclePersistenceAdapter, type LifecyclePlan, type LifecycleReadmission, type LifecycleResult, type LifecycleSession, type LifecycleSnapshot, type LifecycleStudent, type LifecycleTransactionPort, type VerifiedLifecycleContext } from './lifecycle-commands.ts';
import type { ClassStructure } from '../../components/academics/class-structure.ts';
import type { LifecycleRole } from './lifecycle-authorization.ts';

export type MemorySchool = { id: string; structure: ClassStructure; structureVersion: number };
export type MemoryMembership = { id: string; schoolId: string; authUserId: string; role: LifecycleRole; status: 'active' | 'suspended' };
export type MemoryTeacherAssignment = { schoolId: string; membershipId: string; classId: string; sessionId: string; active: boolean };
export type MemoryAuditEvent = LifecycleAuditEvent & { id: string; operationId: string };
export type MemoryDeparture = LifecycleDeparture & { reason: string; effectiveDate: string; destinationSchool: string };
export type MemoryReadmission = LifecycleReadmission;
export type MemoryState = {
  schools: MemorySchool[];
  memberships: MemoryMembership[];
  teacherAssignments: MemoryTeacherAssignment[];
  students: LifecycleStudent[];
  classes: LifecycleClass[];
  sessions: LifecycleSession[];
  enrollments: LifecycleEnrollment[];
  decisions: LifecycleDecision[];
  departures: MemoryDeparture[];
  readmissions: MemoryReadmission[];
  idempotency: IdempotencyRecord[];
  auditEvents: MemoryAuditEvent[];
  nextId: number;
};
export type SimulatedVerifiedIdentity = { authUserId: string; requestId: string; today: string };
export type FailureInjection = { afterEffect: number } | { atAudit: true } | { atIdempotency: true };
export type MemoryExecutionResult =
  | { ok: true; replay: boolean; operationId: string; plan?: LifecyclePlan }
  | { ok: false; code: string; message: string };

class SimulationFailure extends Error {}
const clone = <T>(value: T): T => structuredClone(value);
function conflict(message: string): never { throw new SimulationFailure(message); }
const nextId = (state: MemoryState, prefix: string): string => `${prefix}-${state.nextId++}`;

function scopedSnapshot(state: MemoryState, schoolId: string, studentId: string): LifecycleSnapshot {
  const school = state.schools.find(row => row.id === schoolId);
  if (!school) conflict('Verified school is unavailable.');
  return {
    schoolId,
    structure: clone(school.structure),
    structureVersion: school.structureVersion,
    student: clone(state.students.find(row => row.schoolId === schoolId && row.id === studentId) ?? null),
    classes: clone(state.classes.filter(row => row.schoolId === schoolId)),
    sessions: clone(state.sessions.filter(row => row.schoolId === schoolId)),
    enrollments: clone(state.enrollments.filter(row => row.schoolId === schoolId && row.studentId === studentId)),
    decisions: clone(state.decisions.filter(row => row.schoolId === schoolId && row.studentId === studentId)),
    departures: clone(state.departures.filter(row => row.schoolId === schoolId && row.studentId === studentId)),
    readmissions: clone(state.readmissions.filter(row => row.schoolId === schoolId && row.studentId === studentId)),
    // Key uniqueness is school-wide, including another student's operation.
    idempotency: clone(state.idempotency.filter(row => row.schoolId === schoolId)),
  };
}

function applyEffect(state: MemoryState, plan: LifecyclePlan, effect: LifecycleEffect): void {
  const schoolId = plan.schoolId;
  const studentId = plan.audit?.studentId ?? ('studentId' in plan.effects[0] ? plan.effects[0].studentId : null);
  if ('studentId' in effect && effect.studentId !== studentId) conflict('Effect targets another student.');
  const student = state.students.find(row => row.schoolId === schoolId && row.id === studentId);
  if ('studentId' in effect && !student) conflict('Student is unavailable in the verified school.');

  switch (effect.kind) {
    case 'insert_enrollment': {
      const { classId, levelId, sectionId, sessionId } = effect.placement;
      const target = state.classes.find(row => row.schoolId === schoolId && row.id === classId && row.levelId === levelId && row.sectionId === sectionId);
      const session = state.sessions.find(row => row.schoolId === schoolId && row.id === sessionId);
      if (!target || !session || state.enrollments.some(row => row.schoolId === schoolId && row.studentId === effect.studentId && row.sessionId === sessionId) || state.enrollments.some(row => row.schoolId === schoolId && row.studentId === effect.studentId && row.status === 'active')) conflict('Enrollment placement conflicts with current records.');
      state.enrollments.push({ id: nextId(state, 'enrollment'), schoolId, studentId: effect.studentId, classId, sessionId, status: 'active' });
      return;
    }
    case 'insert_proposal': {
      const source = state.enrollments.find(row => row.schoolId === schoolId && row.id === effect.sourceEnrollmentId && row.studentId === effect.studentId && row.status === 'active');
      if (!source || !student || state.decisions.some(row => row.schoolId === schoolId && row.sourceEnrollmentId === source.id && row.status === 'proposed')) conflict('Academic proposal conflicts with current records.');
      state.decisions.push({ id: nextId(state, 'decision'), schoolId, studentId: effect.studentId, sourceEnrollmentId: source.id, selection: clone(effect.selection), status: 'proposed', structureVersion: effect.structureVersion, studentVersion: student.version });
      return;
    }
    case 'apply_decision': {
      const decision = state.decisions.find(row => row.schoolId === schoolId && row.id === effect.proposalId && row.status === 'proposed');
      if (!decision || decision.studentId !== studentId || state.decisions.some(row => row.schoolId === schoolId && row.sourceEnrollmentId === decision.sourceEnrollmentId && row.status === 'applied')) conflict('Academic decision was already finalized.');
      decision.status = 'applied';
      return;
    }
    case 'close_source_enrollment': {
      const source = state.enrollments.find(row => row.schoolId === schoolId && row.studentId === studentId && row.id === effect.enrollmentId && row.status === 'active');
      if (!source) conflict('Active source enrollment is unavailable.');
      source.status = 'completed';
      return;
    }
    case 'set_enrollment_status': {
      const source = state.enrollments.find(row => row.schoolId === schoolId && row.studentId === studentId && row.id === effect.enrollmentId && row.status === 'active');
      if (!source) conflict('Active source enrollment is unavailable.');
      source.status = effect.status;
      return;
    }
    case 'insert_departure': {
      const source = state.enrollments.find(row => row.schoolId === schoolId && row.id === effect.sourceEnrollmentId && row.studentId === effect.studentId && row.status === 'active');
      if (!source || state.departures.some(row => row.schoolId === schoolId && row.sourceEnrollmentId === source.id)) conflict('Departure conflicts with current records.');
      state.departures.push({ id: nextId(state, 'departure'), schoolId, studentId: effect.studentId, sourceEnrollmentId: source.id, kind: effect.departureKind, reason: effect.reason, effectiveDate: effect.effectiveDate, destinationSchool: effect.destinationSchool });
      return;
    }
    case 'insert_readmission': {
      const departure = state.departures.find(row => row.schoolId === schoolId && row.id === effect.departureId && row.studentId === effect.studentId);
      const enrollment = [...state.enrollments].reverse().find(row => row.schoolId === schoolId && row.studentId === effect.studentId && row.classId === effect.destination.classId && row.sessionId === effect.destination.sessionId && row.status === 'active');
      if (!departure || !enrollment || state.readmissions.some(row => row.schoolId === schoolId && (row.departureId === departure.id || row.enrollmentId === enrollment.id))) conflict('Re-admission link conflicts with current records.');
      state.readmissions.push({ id: nextId(state, 'readmission'), schoolId, studentId: effect.studentId, departureId: departure.id, enrollmentId: enrollment.id });
      return;
    }
    case 'set_student_status': {
      if (!student) conflict('Student is unavailable.');
      const valid = (student.status === 'active' && ['graduated', 'withdrawn'].includes(effect.status)) || (student.status === 'withdrawn' && effect.status === 'active');
      if (!valid) conflict('Student status transition is invalid.');
      student.status = effect.status;
      return;
    }
    case 'bump_student_version': {
      if (!student || student.version !== effect.fromVersion) conflict('Student version changed.');
      student.version++;
      return;
    }
    default: {
      const unreachable: never = effect;
      return unreachable;
    }
  }
}

function applyPlan(state: MemoryState, plan: LifecyclePlan, injection?: FailureInjection): string {
  if (!plan.effects.length) conflict('Transaction plan has no effects.');
  const school = state.schools.find(row => row.id === plan.schoolId);
  const student = state.students.find(row => row.schoolId === plan.schoolId && row.id === (plan.audit?.studentId ?? ('studentId' in plan.effects[0] ? plan.effects[0].studentId : null)));
  if (!school || !student || school.structureVersion !== plan.preconditions.structureVersion || student.version !== plan.preconditions.studentVersion) conflict('Optimistic version check failed.');
  if (plan.preconditions.lockOrder.join(',') !== 'school_structure,student,source_enrollment') conflict('Unexpected lock order.');
  if (plan.preconditions.sourceEnrollmentId && !state.enrollments.some(row => row.schoolId === plan.schoolId && row.studentId === student.id && row.id === plan.preconditions.sourceEnrollmentId)) conflict('Source enrollment changed.');
  if (state.idempotency.some(row => row.schoolId === plan.schoolId && row.key === plan.idempotency.key)) conflict('Idempotency key already exists.');
  if (plan.audit === null && plan.effects.some(row => row.kind !== 'insert_proposal')) conflict('Finalized operation requires an audit event.');
  if (plan.audit !== null && (plan.audit.schoolId !== plan.schoolId || plan.audit.studentId !== student.id || plan.audit.actorRole !== 'admin' || !plan.effects.some(row => row.kind === 'bump_student_version'))) conflict('Audit contract is invalid.');
  const operationId = nextId(state, 'operation');
  plan.effects.forEach((effect, index) => {
    applyEffect(state, plan, effect);
    if (injection && 'afterEffect' in injection && injection.afterEffect === index) conflict('Injected effect failure.');
  });
  if (plan.audit) {
    if (injection && 'atAudit' in injection) conflict('Injected audit failure.');
    if (student.status !== plan.audit.nextState) conflict('Audit state does not match applied transition.');
    state.auditEvents.push({ ...clone(plan.audit), id: nextId(state, 'audit'), operationId });
  }
  if (injection && 'atIdempotency' in injection) conflict('Injected idempotency failure.');
  state.idempotency.push({ schoolId: plan.schoolId, key: plan.idempotency.key, fingerprint: plan.idempotency.fingerprint, operationId });
  return operationId;
}

/** Serializes fictional transactions and publishes only a fully successful clone. */
export class InMemoryLifecycleStore implements LifecyclePersistenceAdapter {
  private state: MemoryState;
  private tail: Promise<void> = Promise.resolve();

  constructor(seed: MemoryState) { this.state = clone(seed); }
  inspect(): MemoryState { return clone(this.state); }

  async withStudentTransaction<T>(schoolId: string, studentId: string, work: (transaction: LifecycleTransactionPort) => Promise<T>, injection?: FailureInjection): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const draft = clone(this.state);
    let applied = false;
    const transaction: LifecycleTransactionPort = {
      loadLockedSnapshot: async (requestedSchool, requestedStudent) => {
        if (requestedSchool !== schoolId || requestedStudent !== studentId) conflict('Transaction scope changed.');
        return scopedSnapshot(draft, schoolId, studentId);
      },
      applyAtomically: async plan => {
        const plannedStudentId = plan.audit?.studentId ?? ('studentId' in plan.effects[0] ? plan.effects[0].studentId : null);
        if (applied || plan.schoolId !== schoolId || plannedStudentId !== studentId) conflict('Transaction plan scope changed.');
        const operationId = applyPlan(draft, plan, injection);
        applied = true;
        return { operationId };
      },
    };
    try {
      const result = await work(transaction);
      if (applied) this.state = draft;
      return result;
    } finally {
      release();
    }
  }

  async execute(command: LifecycleCommand, identity: SimulatedVerifiedIdentity, injection?: FailureInjection): Promise<MemoryExecutionResult> {
    // The test harness passes an identity token; every role and assignment is
    // resolved from store records. This is not real authentication.
    const memberships = this.state.memberships.filter(row => row.authUserId === identity.authUserId && row.status === 'active');
    if (memberships.length !== 1) return { ok: false, code: 'unauthorized', message: 'One active membership is required.' };
    const membership = memberships[0];
    try {
      return await this.withStudentTransaction(membership.schoolId, command.studentId, async transaction => {
        const snapshot = await transaction.loadLockedSnapshot(membership.schoolId, command.studentId);
        const context: VerifiedLifecycleContext = {
          verifiedAuthUserId: identity.authUserId,
          membershipId: membership.id,
          access: { schoolId: membership.schoolId, role: membership.role, membershipStatus: membership.status },
          requestId: identity.requestId,
          today: identity.today,
          teacherAssignments: this.state.teacherAssignments.filter(row => row.schoolId === membership.schoolId && row.membershipId === membership.id).map(row => clone(row)),
        };
        const decision: LifecycleResult = decideLifecycleCommand(command, snapshot, context);
        if (!decision.ok) return decision;
        if (decision.replay) return { ok: true, replay: true, operationId: decision.operationId };
        const applied = await transaction.applyAtomically(decision.plan);
        return { ok: true, replay: false, operationId: applied.operationId, plan: decision.plan };
      }, injection);
    } catch (error) {
      if (!(error instanceof SimulationFailure)) throw error;
      return { ok: false, code: 'transaction_failed', message: 'Simulated transaction failed without committing.' };
    }
  }
}
