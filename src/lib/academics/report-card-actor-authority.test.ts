import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { decodeReportCardActorAuthority } from './report-card-actor-authority.ts';

const row = {
  auth_user_id: 'verified-auth', school_user_id: 'school-user',
  membership_id: 'teacher-membership', school_id: 'school-a',
  role: 'teacher', status: 'active', final_primary_year: 5,
  school_user_count: 1, active_membership_count: 1,
};

test('decodes one complete, active teacher authority row without conflating IDs', () => {
  assert.deepEqual(decodeReportCardActorAuthority('verified-auth', [row]), {
    authUserId: 'verified-auth', schoolUserId: 'school-user',
    membershipId: 'teacher-membership', schoolId: 'school-a',
    role: 'teacher', status: 'active', finalPrimaryYear: 5,
  });
});

test('decodes an active school admin configured for Primary 6', () => {
  const result = decodeReportCardActorAuthority('verified-auth', [{
    ...row, role: 'admin', final_primary_year: 6,
  }]);
  assert.equal(result?.role, 'admin');
  assert.equal(result?.finalPrimaryYear, 6);
});

test('fails closed for missing identity, RPC error shapes, no row, or ambiguous rows', () => {
  for (const [authId, rows] of [
    [null, [row]], [' ', [row]], ['verified-auth', null],
    ['verified-auth', { data: [row] }], ['verified-auth', []],
    ['verified-auth', [row, { ...row, school_id: 'school-b' }]],
  ] as const) assert.equal(decodeReportCardActorAuthority(authId, rows), null);
});

test('fails closed when the complete-scope counts disclose multiple school users or active memberships', () => {
  for (const patch of [
    { school_user_count: 2 },
    { active_membership_count: 2 },
    { active_membership_count: 0 },
  ]) assert.equal(decodeReportCardActorAuthority('verified-auth', [{ ...row, ...patch }]), null);
});

test('rejects foreign actor linkage, missing identifiers and unsupported role/status', () => {
  for (const patch of [
    { auth_user_id: 'other-auth' }, { school_user_id: '' },
    { membership_id: null }, { school_id: '' }, { role: 'bursar' },
    { status: 'suspended' }, { final_primary_year: null },
  ]) assert.equal(decodeReportCardActorAuthority('verified-auth', [{ ...row, ...patch }]), null);
});

test('never treats a single RLS-visible row as complete evidence without exact counts', () => {
  const visibleOnly = { ...row };
  delete (visibleOnly as Partial<typeof row>).active_membership_count;
  assert.equal(decodeReportCardActorAuthority('verified-auth', [visibleOnly]), null);
});
