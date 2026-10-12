'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Settings, UserRound } from 'lucide-react';
export function WorkspaceHeader(){
 const [session,setSession]=useState('2026/2027');
 const [term,setTerm]=useState('First Term');
 const [profileOpen,setProfileOpen]=useState(false);
 const profileRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!profileOpen)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setProfileOpen(false)};const pointer=(e:PointerEvent)=>{if(profileRef.current&&!profileRef.current.contains(e.target as Node))setProfileOpen(false)};document.addEventListener('keydown',key);document.addEventListener('pointerdown',pointer);return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',pointer)}},[profileOpen]);
 return <header className="topbar">
  <div className="academic-context" aria-label="Academic context">
   <label className="context-field"><span>Session</span><select aria-label="Academic session" value={session} onChange={e=>setSession(e.target.value)}><option>2026/2027</option><option>2025/2026</option></select></label>
   <span className="context-divider" aria-hidden="true"/>
   <label className="context-field"><span>Term</span><select aria-label="Academic term" value={term} onChange={e=>setTerm(e.target.value)}><option>First Term</option><option>Second Term</option><option>Third Term</option></select></label>
  </div>
  <div className="profile-control" ref={profileRef}><button type="button" className="profile-trigger" aria-expanded={profileOpen} aria-haspopup="menu" onClick={()=>setProfileOpen(v=>!v)}><span className="profile-avatar"><UserRound size={18}/></span><span className="profile-copy"><strong>School Administrator</strong><small>Administrator</small></span><ChevronDown size={15} className="profile-chevron"/></button>
   {profileOpen&&<div className="profile-dropdown" role="menu"><div className="profile-dropdown-heading">Demo administrator account</div><Link role="menuitem" href="/modules/school-settings" onClick={()=>setProfileOpen(false)}><Settings size={16}/>School Settings</Link><p>Account management and sign-out will be available when authentication is implemented.</p></div>}
  </div>
 </header>
}
