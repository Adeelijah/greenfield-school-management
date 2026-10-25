'use client';
import { useState } from 'react';
import Link from 'next/link';
import { signOutOfStaging } from '@/app/staging/login/actions';
import { StagingPendingButton, StagingLinkProgress } from '@/components/academics/staging-pending';
import './account-design.css';

type Role = 'admin' | 'teacher' | 'bursar';
const names: Record<Role, string> = { admin: 'Administrator', teacher: 'Teacher', bursar: 'Bursar' };
const menus: Record<Role, string[]> = {
  admin: ['Overview', 'Students', 'Admissions', 'Academics', 'Report cards', 'Finance', 'Settings'],
  teacher: ['Overview', 'My classes', 'Attendance', 'Assessments', 'Report cards', 'Calendar', 'My profile'],
  bursar: ['Overview', 'Fee invoices', 'Payments', 'Receipts', 'Outstanding fees', 'Finance reports', 'My profile'],
};
const students = [
  { id: 'GFPS001', name: 'Sample pupil 001', klass: 'Primary 1 A', status: 'Active', balance: 0 },
  { id: 'GFPS002', name: 'Sample pupil 002', klass: 'Primary 2 A', status: 'Active', balance: 25000 },
  { id: 'GFPS003', name: 'Sample pupil 003', klass: 'Primary 3 A', status: 'Active', balance: 0 },
  { id: 'GFPS004', name: 'Sample pupil 004', klass: 'Primary 4 A', status: 'Needs attention', balance: 40000 },
  { id: 'GFPS005', name: 'Sample pupil 005', klass: 'Primary 5 A', status: 'Active', balance: 0 },
  { id: 'GFPS006', name: 'Sample pupil 006', klass: 'Creche A', status: 'Inactive', balance: 15000 },
];
const money = (n: number) => '₦' + n.toLocaleString('en-NG');
function Glyph({ kind = 0 }: { kind?: number }) {
  const paths = ['M3 10 12 3l9 7v11h-6v-7H9v7H3Z', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87', 'M6 3h12v18H6ZM9 8h6M9 12h6M9 16h4', 'M3 5h8v15H3ZM13 5h8v15h-8M11 7h2M11 18h2', 'M4 20V10h4v10M10 20V4h4v16M16 20V7h4v13', 'M3 6h18v14H3ZM3 10h18M7 15h3'];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind % paths.length]} /></svg>;
}
function Badge({ children, warning = false }: { children: string; warning?: boolean }) { return <span className={'account-badge' + (warning ? ' warning' : '')}>{children}</span>; }

export function AccountDesignWorkspace() {
  const [role, setRole] = useState<Role>('admin');
  const [page, setPage] = useState('Overview');
  const [search, setSearch] = useState('');
  const [klass, setKlass] = useState('All classes');
  const [filter, setFilter] = useState('All statuses');
  const [notice, setNotice] = useState('');
  const preview = (label: string) => setNotice(`${label} is a design preview. No record has been changed. This feature will be connected in a later milestone.`);
  const nav = <nav aria-label={`${names[role]} design navigation`}>{menus[role].map((item, i) => <button key={item} type="button" aria-current={page === item ? 'page' : undefined} onClick={() => { setPage(item); setNotice(''); }}><Glyph kind={i} />{item}</button>)}</nav>;
  const isTeacher = role === 'teacher', finance = role === 'bursar';
  const title = finance ? 'Finance overview' : isTeacher ? 'My teaching overview' : 'School overview';
  const metrics = finance ? [[money(4850000), 'Collected this term'], [money(1250000), 'Outstanding fees'], ['126', 'Paid invoices'], ['18', 'Overdue invoices']] : isTeacher ? [['2', 'Assigned classes'], ['48', 'Pupils'], ['94%', 'Attendance'], ['5', 'Reports to submit']] : [['248', 'Students'], ['18', 'Teachers'], ['92%', 'Attendance'], ['6', 'Pending reviews']];
  const rows = students.map((s, i) => isTeacher ? { ...s, klass: i === 5 ? 'Creche A' : 'Primary 5 A' } : s).filter(s => `${s.id} ${s.name}`.toLowerCase().includes(search.trim().toLowerCase()) && (klass === 'All classes' || s.klass === klass) && (filter === 'All statuses' || s.status === filter));
  const tasks = finance ? ['Sample pupil 007 · ₦120,000 overdue', 'Sample pupil 008 · ₦85,000 due soon', 'Sample pupil 009 · ₦60,000 overdue', 'Sample pupil 010 · ₦75,000 due soon'] : isTeacher ? ["Mark today's attendance", 'Complete English scores', 'Correct 2 returned reports', 'Submit reports for review'] : ['Admission application', 'Transfer request', 'Report card review', 'Fee waiver request'];
  const activity = finance ? ['Payment recorded', 'Receipt issued', 'Invoice created', 'Partial payment recorded'] : isTeacher ? ['Attendance saved', 'Assessment scores updated', 'Report returned for correction', 'Report submitted'] : ['New admission submitted', 'Fee payment recorded', 'Report submitted for review', 'Teacher added'];
  return <div className="account-design">
    <div className="account-preview-bar"><span><strong>Design preview</strong> · Fictional sample data</span><label>Preview account <select value={role} onChange={e => { setRole(e.target.value as Role); setPage('Overview'); setSearch(''); setKlass('All classes'); setFilter('All statuses'); setNotice(''); }}><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="bursar">Bursar</option></select></label><Link href="/staging/report-cards" prefetch={false}>Open working staging reports<StagingLinkProgress /></Link></div>
    <aside className="account-sidebar"><div className="account-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 28V16C3 16 2 6 3 3c10 0 15 5 13 13C14 7 21 2 29 2c1 12-3 19-11 19v7z" /></svg><div><strong>Greenfield</strong><span>Primary School</span></div></div><p className="account-workspace-label">{names[role]} workspace</p>{nav}<p className="account-sidebar-note">First term · 2026/27<br />Primary 5 school</p></aside>
    <div className="account-body"><header className="account-topbar"><label className="account-search"><span className="account-sr-only">Search sample pupils</span><Glyph kind={1} /><input type="search" placeholder={finance ? 'Search sample pupil or payment…' : 'Search sample pupils…'} value={search} onChange={e => setSearch(e.target.value)} /></label><span className="account-profile"><span className="account-avatar">{role[0].toUpperCase()}</span>{names[role]}</span><form action={signOutOfStaging}><StagingPendingButton label="Sign out" pendingLabel="Signing out…" /></form></header>
      <details className="account-mobile-nav"><summary>Menu · {page}</summary>{nav}</details>
      <main className="account-main"><div className="account-heading"><div><h1>{page === 'Overview' ? title : page}</h1><p>{finance ? 'School fees, payments and outstanding balances.' : isTeacher ? 'Your assigned classes, attendance and report tasks.' : 'Key information and activity at a glance.'}</p></div><span className="account-term">First term · 2026/27</span></div>
        {notice && <div className="account-notice" role="status"><p>{notice}</p><button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}
        {page !== 'Overview' ? <section className="account-panel account-planned"><Glyph kind={menus[role].indexOf(page)} /><h2>{page} workspace</h2><p>This section is planned. The approved navigation and layout are ready; its records and actions are not connected in this design preview.</p>{page === 'Report cards' && <Link href="/staging/report-cards" prefetch={false}>Open the working staging report workflow<StagingLinkProgress /></Link>}<button onClick={() => setPage('Overview')}>Back to overview</button></section> : <>
        <section className="account-metrics" aria-label="Sample overview figures">{metrics.map(([value, label], i) => <article className="account-panel account-metric" key={label}><span className={'account-metric-icon tone-' + i}><Glyph kind={i + 1} /></span><div><strong>{value}</strong><p>{label}</p></div></article>)}</section>
        <div className="account-columns"><section className="account-panel account-table-panel"><div className="account-panel-heading"><div><h2>{finance ? 'Recent payments' : isTeacher ? 'My pupils' : 'Students'}</h2><p>{finance ? 'Sample fee payments for layout review.' : 'Sample enrollment and status information.'}</p></div><button className={role === 'admin' ? '' : 'account-primary'} onClick={() => role === 'admin' ? setPage('Students') : preview(finance ? 'Record payment' : 'Mark attendance')}>{finance ? 'Record payment' : isTeacher ? 'Mark attendance' : 'View all students'}</button></div>
        <div className="account-filters"><label><span className="account-sr-only">Search table</span><input type="search" placeholder="Search name or admission number…" value={search} onChange={e => setSearch(e.target.value)} /></label><label><span className="account-sr-only">Class</span><select value={klass} onChange={e => setKlass(e.target.value)}>{['All classes', ...new Set(students.map((s, i) => isTeacher ? i === 5 ? 'Creche A' : 'Primary 5 A' : s.klass))].map(c => <option key={c}>{c}</option>)}</select></label>{!finance && !isTeacher && <label><span className="account-sr-only">Status</span><select value={filter} onChange={e => setFilter(e.target.value)}>{['All statuses', 'Active', 'Needs attention', 'Inactive'].map(s => <option key={s}>{s}</option>)}</select></label>}</div>
        <div className="account-table-scroll" role="region" aria-label="Sample account records" tabIndex={0}><table><caption className="account-sr-only">Fictional {finance ? 'payments' : 'pupils'} for design review</caption><thead><tr><th scope="col">{finance ? 'Receipt no.' : 'Admission no.'}</th><th scope="col">Pupil name</th><th scope="col">Class</th><th scope="col">{finance ? 'Amount' : isTeacher ? 'Attendance' : 'Status'}</th><th scope="col">{finance ? 'Method' : isTeacher ? 'Report status' : 'Balance'}</th></tr></thead><tbody>{rows.map((s, i) => <tr key={s.id}><td>{finance ? `RCP-00${students.findIndex(x => x.id === s.id)+1}` : s.id}</td><th scope="row">{s.name}</th><td>{s.klass}</td><td>{finance ? money([45000, 60000, 35000, 50000, 25000, 40000][students.findIndex(x => x.id === s.id)]!) : <Badge warning={isTeacher ? i % 3 === 1 : s.status !== 'Active'}>{isTeacher ? i % 3 === 1 ? 'Absent' : 'Present' : s.status}</Badge>}</td><td>{finance ? i % 2 ? 'Cash' : 'Bank transfer' : isTeacher ? <Badge warning={i % 3 === 2}>{['Draft', 'Awaiting review', 'Returned'][i % 3]!}</Badge> : money(s.balance)}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="account-empty">No sample records match your search or filters.</p>}</div><footer className="account-table-footer">Showing {rows.length} of 6 sample records <span>Page 1 of 1</span></footer></section>
        <aside className="account-side-panels"><section className="account-panel"><div className="account-panel-heading"><h2>{finance ? 'Outstanding balances' : isTeacher ? 'Tasks to complete' : 'Pending approvals'}</h2></div>{tasks.map((task, i) => <button className="account-task" key={task} onClick={() => preview(task)}><span className={'account-task-icon tone-' + i}><Glyph kind={i+2} /></span><span>{task}<small>{finance ? 'Sample fee invoice' : 'Sample task · First term'}</small></span><span aria-hidden="true">›</span></button>)}</section><section className="account-panel"><div className="account-panel-heading"><h2>Recent activity</h2></div>{activity.map((a, i) => <div className="account-activity" key={a}><span className="account-activity-dot" /><span>{a}<small>Sample event · {i+1} hours ago</small></span></div>)}</section></aside></div></>}
        <p className="account-footnote">Design preview only. Switching the preview account changes sample content, not your signed-in role or permissions.</p>
      </main>
    </div>
  </div>;
}
