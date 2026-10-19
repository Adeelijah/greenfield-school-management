import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureRolePreflightPlan, inspectFixtureRestrictedRoles } from './lib/assessment-disposable-role-preflight.mjs';
const schema='rc_it_0123456789abcdef';
const fixture=()=>Object.values(fixtureRolePreflightPlan(schema).roles).map(name=>({name,superuser:false,bypassRls:false,createRole:false,createDb:false,replication:false,login:false,inherit:false,memberOf:[],ownsObjects:false}));
test('restricted role planning refuses arbitrary schema or role injection',()=>{
 for(const value of ['public','rc_it_bad',schema+';DROP ROLE postgres']) assert.throws(()=>fixtureRolePreflightPlan(value));
});
test('preflight accepts exact isolated leaf roles without claiming permission enforcement',()=>{
 assert.deepEqual(inspectFixtureRestrictedRoles(schema,fixture()),{ok:true,roles:fixtureRolePreflightPlan(schema).roles});
});
test('missing, duplicate and substituted role rows fail closed',()=>{
 for(const rows of [null,[],fixture().slice(1),[fixture()[0],fixture()[0]],[...fixture(),fixture()[0]]]) assert.equal(inspectFixtureRestrictedRoles(schema,rows).ok,false);
 const rows=fixture();rows[0].name='postgres';assert.equal(inspectFixtureRestrictedRoles(schema,rows).ok,false);
});
test('superuser and bypass-RLS roles cannot count as restricted evidence',()=>{
 for(const flag of ['superuser','bypassRls']) {const rows=fixture();rows[0][flag]=true;assert.deepEqual(inspectFixtureRestrictedRoles(schema,rows),{ok:false,code:'privileged_role'});}
});
test('role administration, database creation, replication, login and inheritance are refused',()=>{
 for(const flag of ['createRole','createDb','replication','login','inherit']) {const rows=fixture();rows[1][flag]=true;assert.equal(inspectFixtureRestrictedRoles(schema,rows).ok,false);}
});
test('outgoing membership is forbidden even when inheritance is disabled',()=>{
 const rows=fixture();rows[0].memberOf=['fixture_owner'];assert.deepEqual(inspectFixtureRestrictedRoles(schema,rows),{ok:false,code:'role_membership'});
});
test('ownership anywhere is refused for both restricted role kinds',()=>{
 for(const index of [0,1]) {const rows=fixture();rows[index].ownsObjects=true;assert.deepEqual(inspectFixtureRestrictedRoles(schema,rows),{ok:false,code:'object_owner'});}
});
test('catalog strings, missing flags and malformed membership evidence fail closed',()=>{
 for(const [key,value] of [['superuser','false'],['bypassRls',undefined],['ownsObjects',null],['memberOf','{}'],['memberOf',[null]]]) {const rows=fixture();rows[0][key]=value;assert.equal(inspectFixtureRestrictedRoles(schema,rows).ok,false);}
});
test('collector is catalog-only, parameterized, and checks ownership and outgoing membership',()=>{
 const plan=fixtureRolePreflightPlan(schema);
 assert.deepEqual(plan.parameters,[schema+'_reader',schema+'_writer']);
 for(const source of ['pg_catalog.pg_roles','pg_catalog.pg_auth_members','pg_catalog.pg_shdepend']) assert.ok(plan.query.includes(source));
 assert.ok(plan.query.includes('WHERE m.member=r.oid'));
 assert.equal(plan.query.includes(schema),false);
 for(const keyword of ['CREATE ROLE','ALTER ROLE','GRANT ','SET ROLE','SECURITY DEFINER']) assert.equal(plan.query.includes(keyword),false);
});
