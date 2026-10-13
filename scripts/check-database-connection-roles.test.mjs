import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionRisk } from './check-database-connection-roles.mjs';

const app = {configured:true,database:'postgres',role:'greenfield_app',bypassRls:false,superuser:false};
const migration = {configured:true,database:'postgres',role:'postgres',bypassRls:true,superuser:false};

test('rejects bypass-RLS application role',()=>{
  assert.equal(connectionRisk({...app,bypassRls:true},migration),'APP_ROLE_BYPASSES_RLS');
});
test('rejects superuser application role',()=>{
  assert.equal(connectionRisk({...app,superuser:true},migration),'APP_ROLE_BYPASSES_RLS');
});
test('flags shared migration role',()=>{
  assert.equal(connectionRisk({...app,role:'postgres'},migration),'APP_SHARES_MIGRATION_ROLE');
});
test('distinct restricted role still requires privilege review',()=>{
  assert.equal(connectionRisk(app,migration),'IDENTITIES_DISTINCT_REVIEW_GRANTS');
});
test('fails closed on missing credentials or query errors',()=>{
  assert.equal(connectionRisk({configured:false},migration),'APP_URL_MISSING');
  assert.equal(connectionRisk(app,{configured:false}),'MIGRATION_URL_MISSING');
  assert.equal(connectionRisk({...app,error:'failed'},migration),'CONNECTION_CHECK_FAILED');
});
