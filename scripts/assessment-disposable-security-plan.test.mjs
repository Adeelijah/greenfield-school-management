import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureSecurityPlan } from './lib/assessment-disposable-security-plan.mjs';
const schema='rc_it_0123456789abcdef',school='11111111-1111-4111-8111-111111111111';
const plan=()=>fixtureSecurityPlan(schema,school);
test('security builder rejects arbitrary schema and SQL-injected school identities',()=>{
 assert.throws(()=>fixtureSecurityPlan('public',school));
 for(const value of ['',null,school+"';DROP SCHEMA public"]) assert.throws(()=>fixtureSecurityPlan(schema,value));
});
test('all 27 fixture relations and the gate get forced RLS and a restrictive school clamp',()=>{
 const p=plan();assert.equal(p.targets.length,28);assert.equal(new Set(p.targets).size,28);
 for(const name of p.targets){const target='"'+schema+'"."'+name+'"';assert.ok(p.statements.includes('ALTER TABLE '+target+' FORCE ROW LEVEL SECURITY'));assert.ok(p.statements.some(s=>s.startsWith('CREATE POLICY fixture_service_school ON '+target+' AS RESTRICTIVE FOR ALL')));}
});
test('identity and school rows use scoped membership and school ID rather than missing school columns',()=>{
 const sql=plan().statements.join('\n');
 assert.ok(sql.includes('m.user_id="school_users".id AND m.school_id=\''+school+"'::uuid"));
 assert.ok(sql.includes('ON "'+schema+'"."schools" FOR SELECT'));
 assert.ok(sql.includes('USING (id=\''+school+"'::uuid)"));
 for(const text of ['current_setting','set_config','auth.uid','SECURITY DEFINER']) assert.equal(sql.includes(text),false);
});
test('locking reads get column-scoped UPDATE and mutation guards before discovery triggers',()=>{
 const p=plan();
 for(const name of p.targets){assert.ok(p.statements.some(s=>s.startsWith('GRANT UPDATE (id) ON "'+schema+'"."'+name+'" TO "'+p.roles.reader+'"')));assert.ok(p.statements.some(s=>s.startsWith('CREATE TRIGGER aaa_fixture_service_write_guard BEFORE INSERT OR UPDATE OR DELETE ON "'+schema+'"."'+name+'" FOR EACH STATEMENT')));}
 assert.ok(p.statements.join('\n').includes("RAISE EXCEPTION 'fixture reader cannot mutate rows' USING ERRCODE='42501'"));
});
test('writer transitions cannot update report identity, placement or school columns',()=>{
 const p=plan();
 for(const key of ['id','school_id','student_id','enrollment_id','class_id','session_id','term_id','assessment_scope_id','created_at']) assert.equal(p.reportUpdates.includes(key),false);
 assert.equal(p.statements.some(s=>s.startsWith('GRANT UPDATE (id) ON "'+schema+'"."report_cards" TO "'+p.roles.writer+'"')),false);
 assert.equal(p.statements.some(s=>/^GRANT UPDATE ON/.test(s)),false);
});
test('only report records receive INSERT and no role receives DELETE, TRUNCATE, schema CREATE or claims access',()=>{
 const p=plan(),grants=p.statements.filter(s=>s.startsWith('GRANT '));
 assert.equal(grants.filter(s=>s.startsWith('GRANT INSERT ON')).length,5);
 for(const s of grants)for(const forbidden of ['GRANT DELETE','GRANT TRUNCATE','GRANT CREATE','fixture_source_write_claims','GRANT ALL'])assert.equal(s.includes(forbidden),false);
});
test('immutable report rows keep false update checks and no transition policy',()=>{
 const p=plan();assert.equal(p.appendOnly.length,4);
 for(const name of p.appendOnly){assert.ok(p.statements.some(s=>s.startsWith('CREATE POLICY fixture_service_lock ON "'+schema+'"."'+name+'"')&&s.endsWith('WITH CHECK (false)')));assert.equal(p.statements.some(s=>s.startsWith('CREATE POLICY fixture_report_transition ON "'+schema+'"."'+name+'"')),false);}
});
test('plan removes PUBLIC access, keeps setup-owner explicit, and never administers roles or live schemas',()=>{
 const sql=plan().statements.join('\n');
 for(const kind of ['TABLES','FUNCTIONS','SEQUENCES'])assert.ok(sql.includes('REVOKE ALL ON ALL '+kind+' IN SCHEMA "'+schema+'" FROM PUBLIC,'));
 assert.ok(sql.includes('FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true)'));
 for(const word of ['CREATE ROLE','ALTER ROLE','DROP ROLE','public.','DISABLE ROW LEVEL SECURITY','BYPASSRLS']) assert.equal(sql.includes(word),false);
});
