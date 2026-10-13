import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guard = readFileSync(new URL('../src/db/connection-guard.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/db/client.ts', import.meta.url), 'utf8');
const design = readFileSync(new URL('../docs/security/11_restricted_application_role_review.sql', import.meta.url), 'utf8');

test('direct database client invokes fail-closed guard before connecting', () => {
  assert.match(client, /assertRestrictedDatabaseConfiguration\(url, process\.env\.MIGRATION_DATABASE_URL, process\.env\.GREENFIELD_VERIFIED_DB_ROLE\)/);
  assert.ok(client.indexOf('assertRestrictedDatabaseConfiguration(url') < client.indexOf('client ??= postgres(url'));
});

test('same migration and application URL is refused', () => {
  assert.match(guard, /applicationUrl === migrationUrl/);
  assert.match(guard, /credentials must differ/);
});

test('privileged postgres and supabase admin usernames are refused', () => {
  assert.match(guard, /\^postgres/);
  assert.match(guard, /\^supabase_admin/);
});

test('explicit reviewed role acknowledgement is required', () => {
  assert.match(guard, /verifiedRole !== 'greenfield_app'/);
  assert.match(guard, /username !== 'greenfield_app'/);
});

test('role design grants no tenant table access yet', () => {
  assert.match(design, /DO NOT EXECUTE/);
  assert.match(design, /Intentionally NO SELECT\/INSERT\/UPDATE\/DELETE/);
});
