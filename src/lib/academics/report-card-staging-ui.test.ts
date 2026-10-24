import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { stagingUiEnabled, stagingCommandsEnabled, stagingProjectUrl, validStagingPublicKey, validStagingDatabaseUrl, stagingSelector, parseStagingCommandForm, isStagingPath, stagingProxyDestination } from './report-card-staging-ui.ts';
const env = { NODE_ENV: 'development', GREENFIELD_STAGING_UI: 'LOCAL_STAGING_REPORTS_ONLY', NEXT_PUBLIC_SUPABASE_URL: stagingProjectUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test' };
const id = '00000000-0000-4000-8000-000000000001';
function form(row: Record<string, string>) { const f = new FormData(); for (const [k, v] of Object.entries(row)) f.append(k, v); return f; }
test('local UI and writes require separate exact opt-ins and the fixed staging project', () => {
  assert.equal(stagingUiEnabled(env), true); assert.equal(stagingCommandsEnabled(env), false);
  assert.equal(stagingCommandsEnabled({ ...env, GREENFIELD_STAGING_COMMANDS: 'FICTIONAL_STAGING_WRITES_ONLY' }), true);
  for (const mutation of [{ NODE_ENV: 'production' }, { GREENFIELD_STAGING_UI: '' }, { NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' }]) {
    assert.equal(stagingUiEnabled({ ...env, ...mutation }), false);
    assert.equal(stagingCommandsEnabled({ ...env, GREENFIELD_STAGING_COMMANDS: 'FICTIONAL_STAGING_WRITES_ONLY', ...mutation }), false);
  }
});
test('public configuration refuses service/secret keys and foreign legacy projects', () => {
  const jwt = (role: string, ref: string) => 'e30.' + btoa(JSON.stringify({ role, ref })) + '.signature';
  assert.equal(validStagingPublicKey(jwt('anon', 'hweoqkbgmzycyznrbvng')), true);
  for (const key of ['sb_secret_test', 'garbage', jwt('service_role', 'hweoqkbgmzycyznrbvng'), jwt('anon', 'foreign')]) {
    assert.equal(validStagingPublicKey(key), false); assert.equal(stagingUiEnabled({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: key }), false);
  }
});
test('connection requires the exact restricted pooler LOGIN, fixed database and no URL options', () => {
  const url = 'postgresql://greenfield_app.hweoqkbgmzycyznrbvng:example%21@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';
  assert.equal(validStagingDatabaseUrl(url), true);
  for (const changed of [url.replace('greenfield_app.', 'postgres.'), url.replace('5432', '6543'), url.replace('/postgres', '/other'), url.replace('aws-0-eu-west-1', 'aws-0-us-east-1'), url.replace('hweoqkbgmzycyznrbvng', 'foreign'), url + '?sslmode=disable', url.replace('example%21', ''), undefined]) assert.equal(validStagingDatabaseUrl(changed), false);
});
test('staging proxy paths and fixed redirects cannot redirect the ordinary login or accept return URLs', () => {
  assert.equal(isStagingPath('/staging/report-cards'), true); assert.equal(isStagingPath('/staging-elsewhere'), false);
  assert.equal(stagingProxyDestination('/staging/report-cards', false), '/staging/login');
  assert.equal(stagingProxyDestination('/staging/login', true), '/staging/report-cards');
  assert.equal(stagingProxyDestination('/staging/login', false), null);
});
test('class selection is restricted to the two fictional scopes with a fixed session and term', () => {
  assert.ok(stagingSelector('primary5')); assert.ok(stagingSelector('creche'));
  for (const value of [id, '../other', 'PRIMARY5', null, ['primary5']]) assert.equal(stagingSelector(value), null);
});
test('form decoder validates all seven actions, preserving operation keys and exact optimistic versions', () => {
  for (const action of ['create', 'submit', 'return', 'reopen', 'approve', 'publish', 'revoke']) {
    const fields: Record<string, string> = { action, operationKey: 'intent:' + action };
    if (action === 'create') Object.assign(fields, { studentId: id, enrollmentId: id, classId: id, sessionId: id, termId: id });
    else Object.assign(fields, { reportId: id, expectedVersion: '3' });
    if (action === 'return' || action === 'revoke') fields.reason = 'Correct fictional test report';
    if (action === 'revoke') fields.releaseId = id;
    const f = form(fields); f.append('$ACTION_ID_framework', 'metadata');
    const parsed = parseStagingCommandForm(f); assert.ok(parsed); assert.equal(parsed.action, action); assert.equal(parsed.operationKey, fields.operationKey);
    if (parsed.action !== 'create') assert.equal(parsed.expectedVersion, 3);
  }
});
test('form decoder denies duplicate fields, foreign authority, files and malformed versions', () => {
  const fields = { action: 'submit', operationKey: 'retry', reportId: id, expectedVersion: '3' };
  const duplicate = form(fields); duplicate.append('reportId', id); assert.equal(parseStagingCommandForm(duplicate), null);
  const prototype = form(fields); prototype.append('__proto__', 'unexpected'); assert.equal(parseStagingCommandForm(prototype), null);
  const upload = form(fields); upload.append('reason', new Blob(['payload']), 'test.txt'); assert.equal(parseStagingCommandForm(upload), null);
  for (const key of ['schoolId', 'role', 'authUserId', 'membershipId', 'verifiedIdentity']) assert.equal(parseStagingCommandForm(form({ ...fields, [key]: id })), null);
  for (const value of ['0', '-1', '3.0', '3e0', ' 3', '9007199254740992']) assert.equal(parseStagingCommandForm(form({ ...fields, expectedVersion: value })), null);
});
