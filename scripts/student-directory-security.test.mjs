import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(
  'src/server/students/service.ts',
  'utf8'
);

const repository = readFileSync(
  'src/server/students/repository.ts',
  'utf8'
);

test('directory service requires verified school access', () => {
  assert.match(service, /requireSchoolAccess\(\)/);
});

test('directory service rejects unauthorized roles', () => {
  assert.match(service, /access\.role !== 'admin'/);
  assert.match(service, /access\.role !== 'teacher'/);
});

test('directory service passes verified school identity', () => {
  assert.match(service, /schoolId:\s*access\.schoolId/);
  assert.match(service, /role:\s*access\.role/);
});

test('repository restricts queries to the selected school', () => {
  assert.match(
    repository,
    /eq\(students\.schoolId,\s*access\.schoolId\)/
  );
});

test('directory does not select sensitive birth dates', () => {
  assert.doesNotMatch(
    repository,
    /dateOfBirth:\s*students\.dateOfBirth/
  );
});

test('repository remains server-only', () => {
  assert.match(repository, /import 'server-only'/);
  assert.match(service, /import 'server-only'/);
});