import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 22 direct type stripping requires the TypeScript extension.
import { canPerformLifecycleOperation, type LifecycleAccess, type LifecycleOperation } from './lifecycle-authorization.ts';

const admin: LifecycleAccess = { schoolId: 'school-a', role: 'admin', membershipStatus: 'active' };
const teacher: LifecycleAccess = { ...admin, role: 'teacher' };
const bursar: LifecycleAccess = { ...admin, role: 'bursar' };

const allOperations: LifecycleOperation[] = [
  'read_structure', 'edit_structure', 'read_roster', 'read_profile',
  'read_guardians', 'register_student', 'manage_guardians',
  'manage_enrollment', 'decide_progression', 'record_exit', 'readmit_student', 'read_audit',
  'propose_progression',
];

test('admin may perform school-scoped lifecycle operations', () => {
  for (const operation of allOperations) {
    assert.equal(canPerformLifecycleOperation(admin, 'school-a', operation), true, operation);
  }
});

test('teacher has structure read and assigned-student roster/proposal access only', () => {
  for (const operation of allOperations) {
    assert.equal(
      canPerformLifecycleOperation(teacher, 'school-a', operation),
      operation === 'read_structure',
      operation,
    );
    assert.equal(
      canPerformLifecycleOperation(teacher, 'school-a', operation, true),
      ['read_structure', 'read_roster', 'propose_progression'].includes(operation),
      operation,
    );
  }
});

test('bursar has no lifecycle access', () => {
  for (const operation of allOperations) {
    assert.equal(canPerformLifecycleOperation(bursar, 'school-a', operation), false, operation);
  }
});

test('cross-school, inactive, absent and malformed access fail closed', () => {
  for (const operation of allOperations) {
    assert.equal(canPerformLifecycleOperation(admin, 'school-b', operation), false, operation);
    assert.equal(canPerformLifecycleOperation({ ...admin, membershipStatus: 'suspended' }, 'school-a', operation), false, operation);
    assert.equal(canPerformLifecycleOperation(null, 'school-a', operation), false, operation);
  }
  assert.equal(canPerformLifecycleOperation({ ...admin, schoolId: '' }, '', 'read_structure'), false);
  assert.equal(canPerformLifecycleOperation({ ...admin, role: 'unknown' as LifecycleAccess['role'] }, 'school-a', 'read_roster'), false);
  assert.equal(canPerformLifecycleOperation(admin, 'school-a', 'unknown' as LifecycleOperation), false);
});
