'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { StagingAttendanceRegister } from './staging-attendance-register';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import { saveAssessmentSubjectScores } from '@/app/staging/assessments/actions';
import { buildScoreSave } from '@/lib/accounts/staging-score-save';
import type { SubjectScoreCommand } from '@/lib/academics/assessment-score-command';
import { validateScoreEditorDraft } from '@/lib/accounts/staging-operations';
import type { AssessmentEditorView } from '@/lib/accounts/staging-operations';
import type { StagingDashboardData } from '@/lib/accounts/staging-dashboard';
import './staging-academic-pages.css';
import './staging-operations-pages.css';
function ScoreEditor({subject,editor,onBusyChange}:{subject:AssessmentEditorView['subjects'][number];editor:AssessmentEditorView;onBusyChange:(busy:boolean)=>void}){
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(subject.pupils.flatMap(p=>subject.components.map(c=>[p.id+':'+c.id,p.values[c.id]??''])))),[message,setMessage]=useState('');
 const router=useRouter(),[saving,setSaving]=useState(false),[locked,setLocked]=useState(false),[reason,setReason]=useState(''),[retry,setRetry]=useState<SubjectScoreCommand|null>(null),[refreshing,startRefresh]=useTransition();
 useEffect(()=>()=>onBusyChange(false),[onBusyChange]);
 const active=useRef(false);
 const busy=saving||refreshing;
 function reload(){if(active.current)return;setLocked(true);onBusyChange(true);startRefresh(()=>router.refresh());}
 async function save(){
  if(active.current||refreshing||(!retry&&locked)||!editor.canSave)return;
  const validation=validateScoreEditorDraft(subject,values);if(!retry&&!validation.ok){setMessage(validation.message);return;}
  const command=retry??buildScoreSave(editor,subject,values,reason,crypto.randomUUID());
  if(!command){setMessage('Enter a correction or save reason and check every score.');return;}
  active.current=true;setSaving(true);setLocked(true);onBusyChange(true);setRetry(command);setMessage('Saving scores…');
  try{
   const result=await saveAssessmentSubjectScores(command);
   if(result.ok){setRetry(null);setMessage('Scores saved at revision '+result.revision+'. Reload current values before another edit. Review and finalization are still separate.');}
   else if(result.code==='unavailable'){setMessage('The save could not be confirmed. Retry the exact same save before making further edits.');}
   else{setRetry(null);setMessage(result.code==='conflict'?'Scores or configuration changed. Reload current values before editing.':result.code==='forbidden'?'Current score access was denied. Reload to check your access.':'The score grid was rejected. Reload and check the configured values.');}
  }catch{setMessage('The save could not be confirmed. Retry the exact same save before making further edits.');}
  finally{active.current=false;setSaving(false);}
 }
 function set(key:string,value:string){setValues(previous=>({...previous,[key]:value}));setMessage('');}
 return <section className="account-panel operations-panel"><header><h2>{subject.name}</h2><p>{subject.mode==='numeric'?'Numeric scores':'Descriptive observations'} · pinned configuration version {subject.configVersion}</p></header><details className="operations-config"><summary>View configured components and grading</summary>{subject.components.map(c=><p key={c.id}>{c.label}: maximum {c.maximum}, weight {c.weight}%{c.required?' · Required':''}</p>)}{subject.mode==='numeric'?subject.bands.map((b,i)=><p key={i}>{b.label}: {b.min} to {b.max}{i<subject.bands.length-1?' (upper bound excluded)':' (upper bound included)'}</p>):subject.observations.map(o=><p key={o.value}>{o.label}</p>)}</details>
 <div className="operations-draft-list">{subject.pupils.map(p=><article className="operations-score-pupil" key={p.id}><h3>{p.name}</h3><div className="operations-score-inputs">{subject.components.map(c=>{const key=p.id+':'+c.id;return subject.mode==='observational'?<GreenfieldDropdown key={key} label={p.name+' · '+c.label} value={values[key]??''} options={[{value:'',label:'Choose observation'},...subject.observations]} disabled={!editor.canSave||locked||busy} onChange={value=>set(key,value)} />:<label key={key}>{c.label}<span>Maximum {c.maximum} · {c.weight}%</span><input aria-label={p.name+' · '+c.label} disabled={!editor.canSave||locked||busy} type="number" inputMode="decimal" min={0} max={c.maximum} step="0.0001" value={values[key]??''} onChange={e=>set(key,e.target.value)} /></label>;})}</div></article>)}</div>
 <label className="attendance-reason">Save / correction reason<textarea value={reason} maxLength={2000} disabled={!editor.canSave||locked||busy} onChange={e=>setReason(e.target.value)} placeholder="Explain this score save or correction" /></label>
 <div className="operations-actions"><button disabled={busy||locked} onClick={()=>{const r=validateScoreEditorDraft(subject,values);setMessage(r.ok?'Values pass range and completeness checks.':r.message);}}>Check values</button><button className="account-primary" disabled={!editor.canSave||busy||(locked&&!retry)} onClick={()=>void save()} aria-busy={saving}>{saving?'Saving scores…':retry?'Retry same save':'Save scores'}</button>{locked&&!saving&&<button disabled={busy} onClick={reload}>{refreshing?'Reloading scores…':retry?'Reload without confirming save':'Reload current scores'}</button>}<button disabled>Submit review · not enabled</button><button disabled>Finalize · not enabled</button></div>{!editor.canSave&&<p className="account-footnote">Score saving is disabled in this session.</p>}{message&&<p className="operations-message" role="status" aria-live="polite">{message}</p>}</section>;
}
export function StagingOperationsPages({view,data,editor,classKey}:{view:'attendance'|'assessments';data:StagingDashboardData|null;editor:AssessmentEditorView|null;classKey:string}){
 const router=useRouter(),[pending,startTransition]=useTransition(),[attendanceBusy,setAttendanceBusy]=useState(false),[subjectId,setSubjectId]=useState(editor?.subjects[0]?.id??'');
 if(!data)return<section className="account-panel account-planned"><h2>Class records unavailable</h2><p>Current access or the staging connection could not be verified. No sample data has been substituted.</p></section>;
 const subject=editor?.subjects.find(s=>s.id===subjectId)??editor?.subjects[0];
 return <div className="operations-workspace"><p className="account-notice">{view==='attendance'?'Fictional staging attendance. Saved registers retain earlier versions and correction reasons.':'Fictional staging scores. Saved corrections retain their reason and previous values. Saving invalidates the current source; teacher review and independent finalization remain separate.'}</p><div className="operations-selectors"><GreenfieldDropdown label="Available class" value={classKey} options={data.classes.map(c=>({value:c.key,label:c.label}))} disabled={pending||attendanceBusy} onChange={value=>startTransition(()=>router.push('/staging/'+view+'?class='+value))} />{view==='assessments'&&editor&&<GreenfieldDropdown label="Subject / learning area" value={subject?.id??''} options={editor.subjects.map(s=>({value:s.id,label:s.name}))} disabled={pending||attendanceBusy} onChange={setSubjectId} />}</div>{pending&&<p role="status">Loading verified class data…</p>}
 {view==='attendance'?<StagingAttendanceRegister key={classKey} data={data} classKey={classKey} onBusyChange={setAttendanceBusy} />:!editor||!subject?<section className="account-panel account-planned"><h2>Assessment source unavailable</h2><p>The complete current source or subject permission could not be verified. No scores or configurations were guessed. Partial/incomplete sources are not supported by this first read boundary.</p></section>:<><p className="account-footnote">Verified current relational source · revision {editor.revision}. This view does not attest teacher review or finalization. Published reports retain their original immutable snapshots.</p><ScoreEditor key={subject.id+':'+editor.revision+':'+(editor.readToken??'')} subject={subject} editor={editor} onBusyChange={setAttendanceBusy} /></>}
 </div>;
}
