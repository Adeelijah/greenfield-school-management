import test from 'node:test';
import assert from 'node:assert/strict';
import {financePostingFixturePlan} from './lib/finance-posting-fixture.mjs';
const schema='fi_it_0123456789abcdef',plan=financePostingFixturePlan(schema);

test('finance posting plan accepts only its generated namespace and exposes one private routine',()=>{
 for(const bad of ['public','fi_it_short','fi_it_0123456789abcdef;','staging'])assert.throws(()=>financePostingFixturePlan(bad));
 assert.deepEqual(Object.values(plan.roles),['owner','worker','login'].map(s=>schema+'_'+s));
 const workerGrants=plan.statements.filter(s=>s.startsWith('GRANT')&&s.includes(plan.roles.worker));
 assert.equal(workerGrants.length,2);assert.match(workerGrants[0],/^GRANT USAGE ON SCHEMA/);assert.match(workerGrants[1],/^GRANT EXECUTE ON FUNCTION .*post_finance/);
 assert.match(plan.post,/SECURITY DEFINER SET search_path=pg_catalog/);
});
test('all fixture mutations take the same gate and the complete actor is resolved before the invoice and replay',()=>{
 const gate=plan.post.indexOf('PERFORM pg_catalog.pg_advisory_xact_lock'),actor=plan.post.indexOf('WHERE u.auth_user_id=verified_auth');
 assert.ok(gate>0&&gate<actor&&actor<plan.post.indexOf('INTO invoice')&&plan.post.indexOf('INTO invoice')<plan.post.indexOf('INTO previous'));
 assert.match(plan.post,/count\(\*\).*m.status='active'\)<>1/);
 assert.match(plan.post,/i.school_id=actor.school_id AND i.id=v_invoice FOR UPDATE/);
 assert.match(plan.post,/v_action='reverse_payment' AND actor.role<>'admin'/);
 assert.equal(plan.statements.filter(s=>s.includes('FOR EACH STATEMENT EXECUTE FUNCTION')&&s.includes('lock_finance_discovery')).length,plan.relations.length);
});
test('posting has closed JSON, bounded integer money and exact historical replay under the right role and isolation',()=>{
 assert.match(plan.post,/session_user.*current_setting\('role'\).*current_setting\('transaction_isolation'\)<>'read committed'/);
 assert.match(plan.post,/NOT \(cmd \?& v_keys\) OR cmd-v_keys<>'\{\}'::jsonb/);
 assert.match(plan.post,/::numeric\*100\)::bigint/);
 assert.ok(plan.post.indexOf('previous.command IS DISTINCT FROM cmd')<plan.post.indexOf('invoice.version<>v_expected'));
 assert.match(plan.post,/p.school_id=actor.school_id AND p.method=v_method AND p.reference=v_reference/);
});
test('forced RLS covers every generated relation and only the private owner receives narrowly scoped writes',()=>{
 assert.equal(plan.statements.filter(s=>s.endsWith('FORCE ROW LEVEL SECURITY')).length,plan.relations.length);
 assert.ok(plan.statements.some(s=>s.includes('check_finance_storage')&&s.endsWith('SECURITY DEFINER')));
 assert.equal(plan.statements.filter(s=>s.startsWith('GRANT UPDATE')).length,1);
 assert.match(plan.statements.find(s=>s.startsWith('GRANT UPDATE')),/^GRANT UPDATE\(version\).*finance_invoices/);
 assert.ok(!plan.statements.some(s=>s.startsWith('GRANT DELETE')||s.includes('BYPASSRLS')));
});
