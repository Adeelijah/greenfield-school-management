import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../drizzle/0000_broad_slayback.sql', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('./lib/provision-first-school-admin.mjs', import.meta.url), 'utf8');

const expected = {
  schools: ['name', 'slug'],
  school_users: ['auth_user_id', 'display_name'],
  memberships: ['school_id', 'user_id', 'role', 'status'],
  audit_events: ['school_id', 'actor_user_id', 'action', 'entity_type', 'entity_id'],
};

test('bootstrap INSERT columns exist in the original migration', () => {
  for (const [table, columns] of Object.entries(expected)) {
    const insert = bootstrap.match(new RegExp('INSERT INTO public\\.' + table + '\\s*\\(([^)]+)\\)', 'i'));
    assert.ok(insert, 'missing bootstrap INSERT: ' + table);
    assert.deepEqual(insert[1].split(',').map(s => s.trim()), columns, 'bootstrap columns for ' + table);
    const tableDefinition = migration.match(new RegExp('CREATE TABLE "' + table + '" \\(([\\s\\S]*?)\\n\\);'));
    assert.ok(tableDefinition, 'missing foundation table: ' + table);
    for (const column of columns) {
      assert.match(tableDefinition[1], new RegExp('"' + column + '"\\s'), table + '.' + column);
    }
  }
});

test('foundation supplies generated IDs for inserted school and school user', () => {
  for (const table of ['schools', 'school_users']) {
    const definition = migration.match(new RegExp('CREATE TABLE "' + table + '" \\(([\\s\\S]*?)\\n\\);'));
    assert.ok(definition);
    assert.match(definition[1], /"id" uuid PRIMARY KEY DEFAULT gen_random_uuid\(\) NOT NULL/);
  }
});

test('database uniqueness protects concurrent duplicate bootstrap attempts', () => {
  assert.match(migration, /CONSTRAINT "schools_slug_unique" UNIQUE\("slug"\)/);
  assert.match(migration, /CONSTRAINT "school_users_auth_user_id_unique" UNIQUE\("auth_user_id"\)/);
  assert.match(migration, /CREATE UNIQUE INDEX "memberships_school_user_unique"/);
});

test('bootstrap inserts admin membership and audit event in same transaction', () => {
  assert.match(bootstrap, /return sql\.begin\(async \(tx\) =>/);
  for (const table of Object.keys(expected)) {
    assert.match(bootstrap, new RegExp('await tx\x60[\\s\\S]*?INSERT INTO public\\.' + table + '|(?:const \\[\\w+\\] = await tx\x60[\\s\\S]*?INSERT INTO public\\.' + table + ')'));
  }
  assert.match(bootstrap, /'admin', 'active'/);
  assert.match(bootstrap, /'school\.bootstrap'/);
});

test('auth FK is absent from original migration and remains a release blocker', () => {
  assert.match(schema, /authUserId: uuid\('auth_user_id'\)\.notNull\(\)\.unique\(\)/);
  assert.doesNotMatch(migration, /REFERENCES "auth"\."users"/);
});
