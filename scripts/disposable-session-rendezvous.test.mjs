import test from 'node:test';
import assert from 'node:assert/strict';
import { disposableSessionRendezvous } from './lib/disposable-session-rendezvous.mjs';
const role='rc_it_0123456789abcdef_writer';
test('two independent restricted backends must arrive before either workload starts',async()=>{
 const gate=disposableSessionRendezvous(role);let started=false;
 const first=gate.arrive(101,role).then(()=>{started=true;});await Promise.resolve();assert.equal(started,false);
 await Promise.all([first,gate.arrive(102,role)]);assert.equal(started,true);
});
test('the same PostgreSQL backend cannot masquerade as concurrent sessions',async()=>{
 const gate=disposableSessionRendezvous(role),first=gate.arrive(101,role);
 const results=await Promise.allSettled([first,gate.arrive(101,role)]);
 assert.equal(results.every(r=>r.status==='rejected'),true);
});
test('a privileged or unexpected current role rejects both pending participants',async()=>{
 const gate=disposableSessionRendezvous(role),first=gate.arrive(101,role);
 const results=await Promise.allSettled([first,gate.arrive(102,'postgres')]);assert.equal(results.every(r=>r.status==='rejected'),true);
});
test('invalid process identifiers and unsafe role/timeout configuration are rejected',async()=>{
 for(const value of ['postgres','public',role+';DROP ROLE postgres'])assert.throws(()=>disposableSessionRendezvous(value));
 for(const timeout of [0,-1,30001,1.5])assert.throws(()=>disposableSessionRendezvous(role,timeout));
 for(const pid of [0,-1,1.5,NaN]){const gate=disposableSessionRendezvous(role);await assert.rejects(gate.arrive(pid,role));}
});
test('missing peer times out instead of hanging the integration harness',async()=>{
 const gate=disposableSessionRendezvous(role,10);await assert.rejects(gate.arrive(101,role),/Timed out/);
});
test('explicit cancellation releases an already waiting participant',async()=>{
 const gate=disposableSessionRendezvous(role),first=gate.arrive(101,role);gate.cancel();await assert.rejects(first,/cancelled/);
 const unused=disposableSessionRendezvous(role);unused.cancel();await assert.rejects(unused.arrive(102,role),/closed/);
});
test('a third participant cannot reuse a completed rendezvous',async()=>{
 const gate=disposableSessionRendezvous(role);await Promise.all([gate.arrive(101,role),gate.arrive(102,role)]);await assert.rejects(gate.arrive(103,role),/closed/);
});
