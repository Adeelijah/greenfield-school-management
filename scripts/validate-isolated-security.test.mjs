import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { securityStatements } from './validate-isolated-security.mjs';

const source = readFileSync('docs/security/09_consolidated_read_only_review.sql', 'utf8');

test('security review has 35 recognized statements including seven policies', () => {
  const statements = securityStatements(source);
  assert.equal(statements.length, 35);
  assert.equal(statements.filter(s => s.startsWith('CREATE POLICY')).length, 7);
  assert.equal(statements.filter(s => s.includes('FORCE ROW LEVEL SECURITY')).length, 12);
});

test('rejects unexpected security SQL', () => {
  assert.throws(() => securityStatements(source + '\nDROP TABLE public.schools;'), /Unexpected security/);
});
