import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentWriteGuardDDL } from './lib/assessment-disposable-write-guards.mjs';
const schema = 'rc_it_0123456789abcdef';
test('write guard builder refuses arbitrary schemas before emitting SQL', () => {
 for (const name of ['public', 'rc_it_bad', 'rc_it_0123456789abcdef;DROP SCHEMA public']) assert.throws(() => assessmentWriteGuardDDL(name));
});
test('all covered source tables acquire a statement lock before child row locks', () => {
 const plan = assessmentWriteGuardDDL(schema);
 for (const name of [...plan.targets, 'assessment_scopes']) {
  assert.ok(plan.statements.some(s => s.includes('BEFORE INSERT OR UPDATE OR DELETE ON "' + schema + '"."' + name + '" FOR EACH STATEMENT')));
  assert.ok(plan.statements.some(s => s.includes('BEFORE TRUNCATE ON "' + schema + '"."' + name + '" FOR EACH STATEMENT')));
 }
 assert.match(plan.readGate, /WHERE id=1 FOR SHARE$/);
});
test('source revision claims deduplicate all row writes in one transaction and preserve enrollment fan-out', () => {
 const plan = assessmentWriteGuardDDL(schema); const sql = plan.statements.join('\n');
 assert.match(sql, /PRIMARY KEY\(transaction_id,scope_id\)/); assert.match(sql, /pg_current_xact_id\(\)::text,target/);
 assert.match(sql, /ON CONFLICT DO NOTHING RETURNING scope_id/);
 assert.ok(sql.includes("s.class_id=(before_row->>'class_id')::uuid"));
 assert.ok(sql.includes("s.class_id=(after_row->>'class_id')::uuid"));
 assert.equal(sql.includes("s.term_id=(after_row->>'term_id')"), false);
});
test('guard functions use fixture-qualified relations and do not change roles or production policy', () => {
 const sql = assessmentWriteGuardDDL(schema).statements.join('\n');
 assert.ok(sql.includes('SET search_path=pg_catalog')); assert.equal(sql.includes('SECURITY DEFINER'), false);
 for (const forbidden of ['public.', 'CREATE ROLE', 'ALTER ROLE', 'GRANT ', 'DISABLE TRIGGER']) assert.equal(sql.includes(forbidden), false);
});
