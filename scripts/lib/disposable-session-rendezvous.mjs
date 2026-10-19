// Offline synchronization helper. No SQL, credentials, connections or environment.
export function disposableSessionRendezvous(expectedRole, timeoutMs=5000) {
 if(!/^rc_it_[a-f0-9]{16}_(reader|writer)$/.test(expectedRole)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('Invalid disposable rendezvous configuration');
 const pids=new Set();let settled=false,timer=null,resolve,reject;
 const ready=new Promise((yes,no)=>{resolve=yes;reject=no;});
 // Cancellation may precede either arrival; callers still receive ready rejections.
 ready.catch(()=>{});
 const fail=error=>{
  if(settled)return;settled=true;if(timer!==null)clearTimeout(timer);reject(error);
 };
 return {
  arrive(pid,currentRole){
   if(settled)return Promise.reject(Error('Disposable rendezvous already closed'));
   if(!Number.isSafeInteger(pid)||pid<1||currentRole!==expectedRole){fail(Error('Invalid restricted session evidence'));return ready;}
   if(pids.has(pid)){fail(Error('Concurrent tests require distinct PostgreSQL backends'));return ready;}
   pids.add(pid);
   if(pids.size===2){settled=true;if(timer!==null)clearTimeout(timer);resolve();}
   else timer=setTimeout(()=>fail(Error('Timed out waiting for independent restricted session')),timeoutMs);
   return ready;
  },
  cancel(){fail(Error('Disposable session pair cancelled'));},
 };
}
