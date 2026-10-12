'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, FilePlus2, GraduationCap, Receipt, UserPlus } from 'lucide-react';
const actions=[{name:'New admission',href:'/modules/admissions',Icon:UserPlus},{name:'Student records',href:'/modules/students',Icon:GraduationCap},{name:'Invoices',href:'/modules/invoices',Icon:FilePlus2},{name:'Record payment',href:'/modules/payments',Icon:Receipt}];
export function QuickActions(){
 const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};const pointer=(e:PointerEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener('keydown',key);document.addEventListener('pointerdown',pointer);return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',pointer)}},[open]);
 return <div className="quick-actions" ref={ref}><button className="primary quick-action-trigger" type="button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(x=>!x)}>Quick Actions <ChevronDown size={15}/></button>{open&&<div className="quick-actions-menu" role="menu" aria-label="Quick actions">{actions.map(({name,href,Icon})=><Link key={name} role="menuitem" href={href} onClick={()=>setOpen(false)}><Icon size={17}/>{name}</Link>)}</div>}</div>
}
