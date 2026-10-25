import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { decodeStagingStaffAccount } from './staging-staff-account.ts';
const row = () => ({ auth_user_id: 'auth', school_id: 'school', school_user_id: 'user', membership_id: 'member', status: 'active', school_user_count: 1, active_membership_count: 1, role: 'admin' });
test('staff presentation routing accepts each unique active staff role', () => {
 for (const role of ['admin', 'teacher', 'bursar']) assert.equal(decodeStagingStaffAccount('auth', 'school', [{ ...row(), role }]), role);
});
test('staff routing denies missing, ambiguous, suspended, foreign and malformed authority', () => {
 for (const rows of [null, [], [row(), row()], [{ ...row(), role: 'owner' }], [{ ...row(), status: 'suspended' }], [{ ...row(), auth_user_id: 'foreign' }], [{ ...row(), school_id: 'foreign' }], [{ ...row(), school_user_count: 2 }], [{ ...row(), active_membership_count: 2 }], [{ ...row(), membership_id: '' }], [JSON.stringify(row())]]) assert.equal(decodeStagingStaffAccount('auth', 'school', rows), null);
});
