import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionFirstSchoolAdmin } from './lib/provision-first-school-admin.mjs';

const input = {
  authUserId: '123e4567-e89b-42d3-a456-426614174000',
  schoolSlug: 'greenfield-demo',
  schoolName: 'Greenfield Demo',
  displayName: 'Demo Admin',
};

function mockDb({ authExists = true, alreadyLinked = false, failAt } = {}) {
  const calls = [];
  const tx = async (parts, ...values) => {
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    calls.push({ query, values });
    if (failAt && query.includes(failAt)) throw new Error('simulated database failure');
    if (query.includes('FROM auth.users')) return [{ exists: authExists }];
    if (query.includes('FROM public.school_users')) return [{ exists: alreadyLinked }];
    if (query.includes('INSERT INTO public.schools')) return [{ id: 'school-id' }];
    if (query.includes('INSERT INTO public.school_users')) return [{ id: 'user-id' }];
    return [];
  };
  const db = { begin: async (callback) => callback(tx) };
  return { db, calls };
}

test('rejects invalid input before any database call', async () => {
  const { db, calls } = mockDb();
  await assert.rejects(provisionFirstSchoolAdmin(db, { ...input, schoolSlug: 'bad;DROP' }), /Invalid school/);
  assert.equal(calls.length, 0);
});

test('rejects an identity absent from Supabase Auth', async () => {
  const { db, calls } = mockDb({ authExists: false });
  await assert.rejects(provisionFirstSchoolAdmin(db, input), /does not exist/);
  assert.equal(calls.filter(c => c.query.includes('INSERT')).length, 0);
});

test('rejects an already provisioned auth account', async () => {
  const { db, calls } = mockDb({ alreadyLinked: true });
  await assert.rejects(provisionFirstSchoolAdmin(db, input), /already provisioned/);
  assert.equal(calls.filter(c => c.query.includes('INSERT')).length, 0);
});

test('prepares school, user, admin membership and audit writes in one transaction', async () => {
  const { db, calls } = mockDb();
  const result = await provisionFirstSchoolAdmin(db, input);
  assert.deepEqual(result, { schoolId: 'school-id', schoolUserId: 'user-id' });
  assert.deepEqual(calls.filter(c => c.query.startsWith('INSERT')).map(c => c.query.match(/INSERT INTO public\.(\w+)/)[1]),
    ['schools', 'school_users', 'memberships', 'audit_events']);
  assert.ok(calls.some(c => c.query.includes("'admin', 'active'")));
  assert.ok(calls.some(c => c.query.includes("'school.bootstrap'")));
});

test('propagates database errors rather than reporting success', async () => {
  const { db } = mockDb({ failAt: 'INSERT INTO public.memberships' });
  await assert.rejects(provisionFirstSchoolAdmin(db, input), /simulated database failure/);
});
