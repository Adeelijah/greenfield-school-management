'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CalendarDays, ChartColumn, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, Receipt, Settings, ShieldCheck, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { moduleGroups, slugFor } from '@/lib/modules';

const icons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard, Students: Users, Admissions: FileText, Guardians: Users, Staff: Users,
  Classes: GraduationCap, Subjects: BookOpen, Attendance: ClipboardCheck, Assessments: BookOpen,
  Results: FileText, 'Fee Structures': Wallet, Invoices: FileText, Payments: Wallet, Receipts: Receipt,
  'Academic Reports': ChartColumn, 'Attendance Reports': ChartColumn, 'Financial Reports': ChartColumn,
  'School Settings': Settings, 'Academic Calendar': CalendarDays, 'Users & Permissions': ShieldCheck
};
export function AppShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  return <div className="app"><aside className="sidebar" aria-label="Main navigation">
    <div className="brand"><span className="crest"><GraduationCap size={24}/></span><div className="brand-copy"><strong>Greenfield Academy</strong><br/><small>Nurturing Brighter Futures</small></div></div>
    <nav>{moduleGroups.map(g=><div key={g.title}><div className="nav-label">{g.title}</div>
      {g.items.map(name=>{const href=name==='Dashboard'?'/':'/modules/'+slugFor(name);const Icon=icons[name]||FileText;return <Link key={name} href={href} aria-current={pathname===href?'page':undefined} aria-label={name} title={name} className={'nav-item '+(pathname===href?'active':'')}><Icon size={18}/><span>{name}</span></Link>})}
    </div>)}</nav></aside>
    <div className="workspace"><header className="topbar"><span>2026/2027 Academic Session · First Term</span><strong>School Administrator</strong></header><main className="content">{children}</main></div>
  </div>;
}
