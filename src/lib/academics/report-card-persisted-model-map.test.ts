import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { mapPersistedReportIdentity, mapPersistedReportPlacement, type PersistedIdentityRows, type PersistedPlacementRows } from './report-card-persisted-model-map.ts';
const report = { schoolId: 'school', studentId: 'student', classId: 'class', sessionId: 'session', termId: 'term' };
function fixture() {
 const auth: PersistedIdentityRows = { users: [{ id: 'school-user', authUserId: 'verified-auth' }], memberships: [{ id: 'teacher', userId: 'school-user', schoolId: 'school', role: 'teacher', status: 'active' }], schools: [{ id: 'school', finalPrimaryYear: 5 }] };
 const rows: PersistedPlacementRows = {
  students: [{ id: 'student', schoolId: 'school', status: 'active' }],
  enrollments: [{ id: 'enrollment', ...report, status: 'active' }],
  classes: [{ id: 'class', schoolId: 'school', levelId: 'level', sectionId: 'section' }],
  levels: [{ id: 'level', schoolId: 'school', stage: 'primary', primaryYear: 5, isActive: true }],
  sections: [{ id: 'section', schoolId: 'school', levelId: 'level', isActive: true }],
  sessions: [{ id: 'session', schoolId: 'school', startsOn: '2026-09-01', endsOn: '2027-07-31', isCurrent: false }],
  terms: [{ id: 'term', schoolId: 'school', sessionId: 'session', startsOn: '2026-09-01', endsOn: '2026-12-18', isCurrent: false }],
  assignments: [{ id: 'assignment', schoolId: 'school', teacherMembershipId: 'teacher', classId: 'class', sessionId: 'session', endedAt: null }],
 };
 const identity = () => { const result = mapPersistedReportIdentity('verified-auth', auth); assert.ok(result.ok); return result.identity; };
 return { auth, rows, identity, map: () => mapPersistedReportPlacement(identity(), report, 'enrollment', rows) };
}
test('joins verified auth user to school user, membership and school without conflating identifiers', () => {
 const f = fixture(); const identity = f.identity();
 assert.equal(identity.membership.id, 'teacher'); assert.equal(identity.membership.authUserId, 'verified-auth');
 assert.equal(identity.school.id, 'school'); assert.equal(f.map().ok, true);
});
test('missing/forged identity, other-user memberships and ambiguous active schools fail closed', () => {
 const f = fixture(); assert.equal(mapPersistedReportIdentity(null, f.auth).ok, false);
 assert.equal(mapPersistedReportIdentity('forged', f.auth).ok, false);
 const member = f.auth.memberships[0]!;
 f.auth.memberships = [{ ...member, userId: 'other' }]; assert.equal(mapPersistedReportIdentity('verified-auth', f.auth).ok, false);
 f.auth.memberships = [member, { ...member, id: 'second', schoolId: 'other' }]; assert.equal(mapPersistedReportIdentity('verified-auth', f.auth).ok, false);
});
test('exactly one active membership matches existing auth policy; suspended and bursar access is denied', () => {
 const f = fixture(); const member = f.auth.memberships[0]!;
 f.auth.memberships = [member, { ...member, id: 'old', schoolId: 'old-school', status: 'suspended' }]; assert.ok(mapPersistedReportIdentity('verified-auth', f.auth).ok);
 f.auth.memberships = [{ ...member, status: 'suspended' }]; assert.equal(mapPersistedReportIdentity('verified-auth', f.auth).ok, false);
 f.auth.memberships = [{ ...member, role: 'bursar' }]; assert.equal(mapPersistedReportIdentity('verified-auth', f.auth).ok, false);
});
test('maps actual teacherMembershipId and endedAt columns; inactive or duplicate assignments deny teacher', () => {
 const f = fixture(); const result = f.map(); assert.ok(result.ok);
 assert.equal(result.placement.assignments[0]!.membershipId, 'teacher'); assert.equal(result.placement.assignments[0]!.status, 'active');
 const assignment = f.rows.assignments[0]!;
 f.rows.assignments = [{ ...assignment, endedAt: new Date('2026-10-01') }]; assert.equal(f.map().ok, false);
 f.rows.assignments = [assignment, { ...assignment, id: 'duplicate' }]; assert.equal(f.map().ok, false);
 f.auth.memberships = [{ ...f.auth.memberships[0]!, role: 'admin' }]; f.rows.assignments = []; assert.equal(f.map().ok, true);
});
test('requires student ownership and one exact active enrollment, including duplicates in another class', () => {
 const f = fixture(); const enrollment = f.rows.enrollments[0]!;
 f.rows.enrollments = [enrollment, { ...enrollment, id: 'duplicate', classId: 'other-class' }]; assert.equal(f.map().ok, false);
 f.rows.enrollments = [{ ...enrollment, id: 'wrong-enrollment' }]; assert.equal(f.map().ok, false);
 f.rows.enrollments = [enrollment]; f.rows.students = [{ ...f.rows.students[0]!, schoolId: 'foreign' }]; assert.equal(f.map().ok, false);
 f.rows.students = [{ id: 'student', schoolId: 'school', status: 'withdrawn' }]; assert.equal(f.map().ok, false);
});
test('nullable legacy class mappings and wrong/inactive sections are rejected', () => {
 const f = fixture(); const klass = f.rows.classes[0]!;
 f.rows.classes = [{ ...klass, levelId: null, sectionId: null }]; assert.equal(f.map().ok, false);
 f.rows.classes = [klass]; const section = f.rows.sections[0]!;
 f.rows.sections = [{ ...section, levelId: 'other-level' }]; assert.equal(f.map().ok, false);
 f.rows.sections = [{ ...section, isActive: false }]; assert.equal(f.map().ok, false);
});
test('Primary 5 and Primary 6 configuration is respected without excluding early years', () => {
 const f = fixture(); const level = f.rows.levels[0]!;
 f.rows.levels = [{ ...level, primaryYear: 6 }]; assert.equal(f.map().ok, false);
 f.auth.schools = [{ id: 'school', finalPrimaryYear: 6 }]; assert.equal(f.map().ok, true);
 for (const stage of ['creche', 'nursery'] as const) { f.rows.levels = [{ ...level, stage, primaryYear: null }]; assert.equal(f.map().ok, true); }
 f.auth.schools = [{ id: 'school', finalPrimaryYear: null }]; assert.equal(f.map().ok, false);
});
test('term-session ownership, containment and real calendar dates are checked', () => {
 const f = fixture(); const term = f.rows.terms[0]!;
 for (const patch of [{ sessionId: 'other-session' }, { endsOn: '2028-01-01' }, { startsOn: '2026-02-30' }, { startsOn: '2026-12-19' }]) {
  f.rows.terms = [{ ...term, ...patch }]; assert.equal(f.map().ok, false);
 }
});
test('every joined school-scoped collection rejects a mixed-school row', () => {
 for (const key of Object.keys(fixture().rows) as (keyof PersistedPlacementRows)[]) {
  const f = fixture(); const row = f.rows[key][0]!;
  // Use a fresh typed fixture collection; only the shared schoolId is changed.
  Object.assign(row, { schoolId: 'foreign' }); assert.equal(f.map().ok, false, key);
 }
});
test('mapping copies rows and preserves isCurrent without inventing engine fields', () => {
 const f = fixture(); const before = structuredClone(f.rows); const result = f.map(); assert.ok(result.ok);
 assert.deepEqual(f.rows, before); assert.equal(result.placement.term.isCurrent, false);
 assert.equal('number' in result.placement.term, false); assert.equal('version' in result.placement.session, false);
 assert.equal('assessmentRevision' in result.placement, false);
 result.placement.enrollments[0]!.classId = 'changed'; assert.deepEqual(f.rows, before);
});
