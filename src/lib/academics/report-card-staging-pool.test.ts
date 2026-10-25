import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { createStagingPoolManager } from './report-card-staging-pool.ts';
function fixture() { let closes=0; return { get closes(){return closes;}, async end(){closes++;} }; }
function gate(){let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return{promise,release};}
test('same configuration reuses transport while each callback executes independently',async()=>{
 const manager=createStagingPoolManager<ReturnType<typeof fixture>>(), pool=fixture();let creates=0,calls=0;
 for(let i=0;i<3;i++)assert.equal(await manager.run('a',()=>{creates++;return pool;},async(p,reused)=>{assert.equal(p,pool);assert.equal(reused,i>0);return ++calls;}),i+1);
 assert.equal(creates,1);assert.equal(pool.closes,0);await manager.retire();assert.equal(pool.closes,1);
});
test('configuration rotation drains idle pool once and does not retain retired entries',async()=>{
 const manager=createStagingPoolManager<ReturnType<typeof fixture>>(),a=fixture(),b=fixture();
 await manager.run('a',()=>a,async()=>{});await manager.run('b',()=>b,async(_,reused)=>assert.equal(reused,false));assert.equal(a.closes,1);assert.equal(b.closes,0);
 await manager.retire();await manager.retire();assert.equal(b.closes,1);
});
test('rotation and explicit retirement leave active transactions open until final borrower ends',async()=>{
 const manager=createStagingPoolManager<ReturnType<typeof fixture>>(),a=fixture(),b=fixture(),g=gate();
 const first=manager.run('a',()=>a,async()=>{await g.promise;});
 await manager.run('b',()=>b,async()=>{});assert.equal(a.closes,0);await manager.retire();assert.equal(b.closes,1);assert.equal(a.closes,0);
 g.release();await first;assert.equal(a.closes,1);
});
test('failure retires shared pool without closing another active borrower',async()=>{
 const manager=createStagingPoolManager<ReturnType<typeof fixture>>(),a=fixture(),b=fixture(),g=gate();
 const active=manager.run('a',()=>a,async()=>g.promise);const error=Error('failure');
 await assert.rejects(manager.run('a',()=>{throw Error('unexpected create');},async()=>{throw error;}),e=>e===error);assert.equal(a.closes,0);
 await manager.run('a',()=>b,async(_,reused)=>assert.equal(reused,false));g.release();await active;assert.equal(a.closes,1);assert.equal(b.closes,0);await manager.retire();
});
test('late failure from retired configuration cannot retire newer pool',async()=>{
 const manager=createStagingPoolManager<ReturnType<typeof fixture>>(),a=fixture(),b=fixture(),g=gate();
 const old=manager.run('a',()=>a,async()=>{await g.promise;throw Error('old');});
 await manager.run('b',()=>b,async()=>{});g.release();await assert.rejects(old,/old/);
 await manager.run('b',()=>{throw Error('new pool was lost');},async(_,reused)=>assert.equal(reused,true));await manager.retire();
});
test('cleanup failure preserves original error and failed factory preserves existing pool',async()=>{
 const manager=createStagingPoolManager<{end():Promise<void>}>(),error=Error('original');const pool={async end(){throw Error('cleanup');}};
 await manager.run('a',()=>pool,async()=>{});await assert.rejects(manager.run('b',()=>{throw Error('factory');},async()=>{}),/factory/);
 await manager.run('a',()=>{throw Error('lost');},async(_,reused)=>assert.equal(reused,true));
 await assert.rejects(manager.run('a',()=>pool,async()=>{throw error;}),e=>e===error);await manager.retire();
});
