'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {GreenfieldDropdown} from '@/components/greenfield-dropdown';
import {loadAttendanceRegister,saveAttendanceRegister} from '@/app/staging/attendance/actions';
import {validateAttendanceDraft} from '@/lib/accounts/staging-operations';
import type {StagingDashboardData} from '@/lib/accounts/staging-dashboard';
import type {AttendanceHistory} from '@/lib/attendance/attendance-postgres-history';
import type {AttendanceCommand} from '@/lib/attendance/staging-attendance-command';
const options=[{value:'',label:'Choose a mark'},{value:'present',label:'Present'},{value:'absent',label:'Absent'},{value:'late',label:'Late'},{value:'excused',label:'Excused'}];
function todayInLagos(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(type=>parts.find(p=>p.type===type)?.value??'').join('-');}
function AttendanceEditor({pupils,classKey,date,today,onBusyChange}:{onBusyChange:(busy:boolean)=>void;pupils:StagingDashboardData['records'];classKey:string;date:string;today:string}){
 const [loading,setLoading]=useState(true),[pending,setPending]=useState(false),[available,setAvailable]=useState(false),[canSave,setCanSave]=useState(false);
 const [register,setRegister]=useState<AttendanceHistory|null>(null),[marks,setMarks]=useState<Record<string,string>>({}),[reason,setReason]=useState(''),[message,setMessage]=useState('');
 const [retry,setRetry]=useState<AttendanceCommand|null>(null),[reload,setReload]=useState(0);const busy=useRef(false);
 useEffect(()=>{let active=true;loadAttendanceRegister({classKey,date}).then(result=>{if(!active)return;if(result.ok){setRegister(result.register);setMarks(result.register?.marks??{});setCanSave(result.canSave===true);setAvailable(true);}else setMessage(result.code==='forbidden'?'Current attendance access could not be verified.':'Saved attendance could not be loaded. Reload, or contact your administrator.');setLoading(false);}).catch(()=>{if(active){setLoading(false);setMessage('Saved attendance is unavailable. Reload to try again.');}});return()=>{active=false;};},[classKey,date,reload]);
 useEffect(()=>{onBusyChange(loading||pending);},[loading,pending,onBusyChange]);
 const matchesRoster=!register||(Object.keys(register.marks).length===pupils.length&&pupils.every(p=>Object.hasOwn(register.marks,p.id)));
 const editable=available&&matchesRoster&&canSave&&!loading&&!pending&&!retry;
 async function save(){
  if(busy.current||loading||!available||!canSave||!matchesRoster)return;
  const checked=validateAttendanceDraft(date,pupils.map(p=>p.id),marks,today);
  if(!retry&&!checked.ok){setMessage(checked.message);return;}
  if(!retry&&register&&!reason.trim()){setMessage('Enter a reason for this correction.');return;}
  const command:AttendanceCommand=retry??{action:'save_register',classKey:classKey as AttendanceCommand['classKey'],date,expectedVersion:register?.version??0,operationKey:crypto.randomUUID(),reason:register?reason.trim():null,marks:{...marks} as AttendanceCommand['marks']};
  busy.current=true;setPending(true);setRetry(command);setMessage('Saving attendance… Keep this page open.');
  try{
   const result=await saveAttendanceRegister(command);
   if(result.ok){
    // Keep edits locked until a fresh authorized read confirms the saved baseline.
    const fresh=await loadAttendanceRegister({classKey,date});
    if(fresh.ok&&fresh.register&&fresh.register.version>=result.version){setRegister(fresh.register);setMarks(fresh.register?.marks??{});setCanSave(fresh.canSave===true);setReason('');setRetry(null);setMessage(`Attendance ${result.kind==='replay'?'already saved':'saved'} · version ${result.version}.`);}
    else{setAvailable(false);setRetry(null);setMessage('Attendance was saved, but the latest register could not be loaded. Reload before making another correction.');}
   }else if(result.code==='unavailable'){setMessage('The save result could not be confirmed. Retry the same save, or reload to check the saved register.');}
   else{setRetry(null);setAvailable(false);setMessage(result.code==='conflict'?'The register changed. Reload before making a correction.':result.code==='forbidden'?'Your current attendance access could not be verified.':'The date, active roster or correction could not be accepted. Reload the register and check the marks.');}
  }catch{setMessage('The save result could not be confirmed. Retry the same save, or reload to check the saved register.');}
  finally{busy.current=false;setPending(false);}
 }
 function reloadRegister(){if(busy.current)return;setLoading(true);setAvailable(false);setRetry(null);setMessage('');setReload(n=>n+1);}
 return <div aria-busy={loading||pending}>
 {loading?<div className="attendance-loading" role="status"><span className="account-sr-only">Loading saved attendance…</span>{pupils.map(p=><article key={p.enrollmentId} aria-hidden="true"><div><span /><span /></div><span /></article>)}</div>:<>
 <p className="account-footnote">{register?`Saved register · version ${register.version}`:available?'No saved register for this date.':'Saved register not loaded.'}{available&&!canSave?' · Read-only mode':''}</p>
 {register&&!matchesRoster&&<p role="status">This historical register has a different pupil roster. It can be read, but cannot be overwritten from the current roster.</p>}
 <button type="button" disabled={!editable||!pupils.length} onClick={()=>{setMarks(Object.fromEntries(pupils.map(p=>[p.id,'present'])));setMessage('');}}>Mark all present</button>
 <div className="operations-draft-list attendance-current-marks">{pupils.map(p=><article key={p.enrollmentId}><div><h3>{p.name}</h3><p>{p.id.slice(0,8)}</p></div><GreenfieldDropdown label={'Attendance for '+p.name} value={marks[p.id]??''} disabled={!editable} options={options} onChange={value=>{setMarks(previous=>({...previous,[p.id]:value}));setMessage('');}} /></article>)}</div>
 {!pupils.length&&<p className="account-empty">No active pupils in this class.</p>}
 {register&&<label className="attendance-reason">Reason for correction<textarea value={reason} maxLength={2000} disabled={!editable} onChange={e=>setReason(e.target.value)} placeholder="Explain why the saved marks need changing" /></label>}
 <div className="operations-actions"><button type="button" className="account-primary" disabled={pending||loading||!canSave||!available||!matchesRoster||!pupils.length} onClick={save}>{pending?'Saving attendance…':retry?'Retry same save':register?'Save correction':'Save attendance'}</button><button type="button" disabled={pending||loading} onClick={reloadRegister}>Reload saved register</button></div>
 {register&&<details className="operations-config"><summary>Saved history · {register.history.length} {register.history.length===1?'version':'versions'}</summary>{register.history.slice().reverse().map(h=><section key={h.version} className="attendance-history"><h3>Version {h.version}</h3><p>{new Date(h.recordedAt).toLocaleString('en-GB',{timeZone:'Africa/Lagos'})} · {h.reason??'Initial register'}</p><ul>{Object.entries(h.marks).map(([id,status])=><li key={id}>{pupils.find(p=>p.id===id)?.name??'Historical pupil '+id.slice(0,8)}: {status}</li>)}</ul></section>)}</details>}
 </>}
 {message&&<p className="operations-message" role="status" aria-live="polite">{message}</p>}
 </div>;
}
export function StagingAttendanceRegister({data,classKey,onBusyChange}:{data:StagingDashboardData;classKey:string;onBusyChange:(busy:boolean)=>void}){
 const today=todayInLagos(),[date,setDate]=useState(today),[working,setWorking]=useState(true);
 const setBusy=useCallback((busy:boolean)=>{setWorking(busy);onBusyChange(busy);},[onBusyChange]);
 useEffect(()=>()=>onBusyChange(false),[onBusyChange]);const pupils=data.records.filter(r=>r.classKey===classKey);
 return <section className="account-panel operations-panel"><header><h2>Class attendance</h2><p>Saved registers use the current verified class assignment. Corrections retain the earlier marks and their reasons.</p></header><div className="operations-toolbar"><label>Attendance date<input type="date" disabled={working} value={date} max={today} onChange={e=>setDate(e.target.value)} /></label></div><AttendanceEditor key={classKey+':'+date} pupils={pupils} classKey={classKey} date={date} today={today} onBusyChange={setBusy} /></section>;
}
