'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Settings, UserRound } from 'lucide-react';

type ContextDropdownProps={label:string;value:string;options:readonly string[];onChange:(value:string)=>void};
function ContextDropdown({label,value,options,onChange}:ContextDropdownProps){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const onPointer=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}};document.addEventListener('pointerdown',onPointer);document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('pointerdown',onPointer);document.removeEventListener('keydown',onKey)}},[open]);
 return <div className="context-field" ref={root}>
  <span className="context-label">{label}</span>
  <button ref={trigger} type="button" className="context-select-trigger" aria-label={label+': '+value} aria-expanded={open} aria-haspopup="listbox" onClick={()=>setOpen(x=>!x)}><span>{value}</span><ChevronDown size={14} className={open?'chevron-open':''}/></button>
  {open&&<div className="context-options" role="listbox" aria-label={label}>{options.map(option=><button type="button" role="option" aria-selected={value===option} key={option} className={'context-option'+(value===option?' selected':'')} onClick={()=>{onChange(option);setOpen(false);trigger.current?.focus()}}><span>{option}</span>{value===option&&<Check size={15}/>}</button>)}</div>}
 </div>;
}
export function WorkspaceHeader(){
 const [session,setSession]=useState('2026/2027');
 const [term,setTerm]=useState('First Term');
 const [profileOpen,setProfileOpen]=useState(false);
 const profileRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!profileOpen)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setProfileOpen(false)};const pointer=(e:PointerEvent)=>{if(profileRef.current&&!profileRef.current.contains(e.target as Node))setProfileOpen(false)};document.addEventListener('keydown',key);document.addEventListener('pointerdown',pointer);return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',pointer)}},[profileOpen]);
 return <header className="topbar">
  <div className="academic-context" aria-label="Academic context">
   <ContextDropdown label="Session" value={session} options={['2026/2027','2025/2026']} onChange={setSession}/>
   <span className="context-divider" aria-hidden="true"/>
   <ContextDropdown label="Term" value={term} options={['First Term','Second Term','Third Term']} onChange={setTerm}/>
  </div>
  <div className="profile-control" ref={profileRef}><button type="button" className="profile-trigger" aria-expanded={profileOpen} aria-haspopup="menu" onClick={()=>setProfileOpen(v=>!v)}><span className="profile-avatar"><UserRound size={18}/></span><span className="profile-copy"><strong>School Administrator</strong><small>Administrator</small></span><ChevronDown size={15} className="profile-chevron"/></button>
   {profileOpen&&<div className="profile-dropdown" role="menu"><div className="profile-dropdown-heading">Demo administrator account</div><Link role="menuitem" href="/modules/school-settings" onClick={()=>setProfileOpen(false)}><Settings size={16}/>School Settings</Link><p>Account management and sign-out will be available when authentication is implemented.</p></div>}
  </div>
 </header>;
}
