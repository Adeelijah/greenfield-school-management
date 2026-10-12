'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { BookOpen, CalendarDays, ChartColumn, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, Receipt, Settings, ShieldCheck, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { moduleGroups, slugFor } from '@/lib/modules';
import { WorkspaceHeader } from '@/components/workspace-header';

const icons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard, Students: Users, Admissions: FileText, Guardians: Users, Staff: Users,
  Classes: GraduationCap, Subjects: BookOpen, Attendance: ClipboardCheck, Assessments: BookOpen,
  Results: FileText, 'Fee Structures': Wallet, Invoices: FileText, Payments: Wallet, Receipts: Receipt,
  'Academic Reports': ChartColumn, 'Attendance Reports': ChartColumn, 'Financial Reports': ChartColumn,
  'School Settings': Settings, 'Academic Calendar': CalendarDays, 'Users & Permissions': ShieldCheck
};
export function AppShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const [menuOpen,setMenuOpen]=useState(false);
  useEffect(()=>{setMenuOpen(false)},[pathname]);
  useEffect(()=>{if(!menuOpen)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenuOpen(false)};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[menuOpen]);
  return <div className="app"><button className="mobile-menu-button" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="school-navigation" onClick={()=>setMenuOpen(true)}><Menu size={21}/></button>{menuOpen&&<button className="nav-backdrop" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}/>}<aside id="school-navigation" className={"sidebar"+(menuOpen?" sidebar-open":"")} aria-label="Main navigation"><button className="mobile-close-button" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}><X size={20}/></button>
    <div className="brand"><span className="crest"><GraduationCap size={24}/></span><div className="brand-copy"><strong>Greenfield Academy</strong><br/><small>Nurturing Brighter Futures</small></div></div>
    <nav>{moduleGroups.map(g=><div key={g.title}><div className="nav-label">{g.title}</div>
      {g.items.map(name=>{const href=name==='Dashboard'?'/':'/modules/'+slugFor(name);const Icon=icons[name]||FileText;return <Link key={name} href={href} aria-current={pathname===href?'page':undefined} aria-label={name} title={name} className={'nav-item '+(pathname===href?'active':'')}><Icon size={18}/><span>{name}</span></Link>})}
    </div>)}</nav></aside>
    <div className="workspace"><WorkspaceHeader/><main className="content">{children}</main></div>
  </div>;
}
