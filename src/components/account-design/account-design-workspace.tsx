'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { signOutOfStaging } from '@/app/staging/login/actions';
import { StagingPendingButton, StagingLinkProgress } from '@/components/academics/staging-pending';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import { academicPageHref } from '@/lib/accounts/staging-academic-pages';
import type { AcademicPage } from '@/lib/accounts/staging-academic-pages';
import { StagingOperationsPages } from './staging-operations-pages';
import type { AssessmentEditorView } from '@/lib/accounts/staging-operations';
import { StagingAcademicPages } from './staging-academic-pages';
import type { StagingDashboardData } from '@/lib/accounts/staging-dashboard';
import './account-dropdown.css';
import './account-design.css';

type Role = 'admin' | 'teacher' | 'bursar';
const names: Record<Role, string> = { admin: 'Administrator', teacher: 'Teacher', bursar: 'Bursar' };
const menus: Record<Role, string[]> = {
  admin: ['Overview', 'Students', 'Admissions', 'Academics', 'Attendance', 'Report cards', 'Finance', 'Settings'],
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
const money = (n: number | null) => n === null ? 'Not connected' : '₦' + n.toLocaleString('en-NG');
function Glyph({ kind = 0 }: { kind?: number }) {
  const paths = ['M3 10 12 3l9 7v11h-6v-7H9v7H3Z', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87', 'M6 3h12v18H6ZM9 8h6M9 12h6M9 16h4', 'M3 5h8v15H3ZM13 5h8v15h-8M11 7h2M11 18h2', 'M4 20V10h4v10M10 20V4h4v16M16 20V7h4v13', 'M3 6h18v14H3ZM3 10h18M7 15h3'];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind % paths.length]} /></svg>;
}
function Badge({ children, warning = false }: { children: string; warning?: boolean }) { return <span className={'account-badge' + (warning ? ' warning' : '')}>{children}</span>; }

export function AccountDesignWorkspace({ initialRole = 'admin', preview: isPreview = true, liveData = null, academicView, assessmentEditor = null, initialClass = 'all' }: { initialRole?: Role; preview?: boolean; liveData?: StagingDashboardData | null; academicView?: AcademicPage; assessmentEditor?: AssessmentEditorView | null; initialClass?: string }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [page, setPage] = useState(academicView === 'students' ? 'Students' : academicView === 'classes' ? 'My classes' : academicView === 'reports' ? 'Report cards' : academicView === 'attendance' ? 'Attendance' : academicView === 'assessments' ? initialRole === 'admin' ? 'Academics' : 'Assessments' : 'Overview');
  const [search, setSearch] = useState('');
  const [klass, setKlass] = useState('All classes');
  const [filter, setFilter] = useState('All statuses');
  const [notice, setNotice] = useState('');
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const options = (labels: string[]) => labels.map(label => ({ value: label, label }));
  function switchPreview(value: string) {
    if (value !== 'admin' && value !== 'teacher' && value !== 'bursar') return;
    setRole(value); setPage('Overview'); setSearch(''); setKlass('All classes'); setFilter('All statuses'); setNotice('');
  }
  const accountSelector = <GreenfieldDropdown label="Preview account" value={role} options={[{ value: 'admin', label: 'Admin' }, { value: 'teacher', label: 'Teacher' }, { value: 'bursar', label: 'Bursar' }]} onChange={switchPreview} />;
  const preview = (label: string) => setNotice(`${label} is ${isPreview ? 'a design preview' : 'not connected on this dashboard yet'}. No record has been changed.`);
  function closeMenu() { if (mobileMenu.current) mobileMenu.current.open = false; }
  const nav = <nav aria-label={`${names[role]} navigation`}>{menus[role].map((item, i) => {
    const href = !isPreview && academicPageHref(item, role);
    return href ? <Link key={item} href={href} prefetch={false} aria-current={page === item ? 'page' : undefined} onClick={closeMenu}><Glyph kind={i} />{item}<StagingLinkProgress /></Link>
      : <button key={item} type="button" aria-current={page === item ? 'page' : undefined} onClick={() => { setPage(item); setNotice(''); closeMenu(); }}><Glyph kind={i} />{item}</button>;
  })}</nav>;

  const isTeacher = role === 'teacher', finance = role === 'bursar';
  const title = finance ? 'Finance overview' : isTeacher ? 'My teaching overview' : 'School overview';
  const sampleMetrics = finance ? [[money(4850000), 'Collected this term'], [money(1250000), 'Outstanding fees'], ['126', 'Paid invoices'], ['18', 'Overdue invoices']] : isTeacher ? [['2', 'Assigned classes'], ['48', 'Pupils'], ['94%', 'Attendance'], ['5', 'Reports to submit']] : [['248', 'Students'], ['18', 'Teachers'], ['92%', 'Attendance'], ['6', 'Pending reviews']];
  const sampleRecords = students.map((s, index) => ({ ...s, klass: isTeacher ? index === 5 ? 'Creche A' : 'Primary 5 A' : s.klass,
    attendance: index % 3 === 1 ? 'Absent' : 'Present', reportStatus: ['Draft', 'Awaiting review', 'Returned'][index % 3]!,
    method: index % 2 ? 'Cash' : 'Bank transfer', amount: [45000, 60000, 35000, 50000, 25000, 40000][index]!, receipt: `RCP-00${index + 1}` }));
  const records = isPreview ? sampleRecords : liveData?.records ?? [];
  const metrics = isPreview ? sampleMetrics : liveData?.metrics ?? (finance ? [['—', 'Collected this term'], ['—', 'Outstanding fees'], ['—', 'Paid invoices'], ['—', 'Overdue invoices']] : [['—', 'Pupils unavailable'], ['—', 'Classes unavailable'], ['—', 'Review counts unavailable'], ['—', 'Published reports unavailable']]);
  const rows = records.filter(s => `${s.id} ${s.name} ${finance ? s.receipt : ''}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (klass === 'All classes' || s.klass === klass) && (filter === 'All statuses' || (isTeacher || (!isPreview && !finance) ? s.reportStatus : finance ? s.method : s.status) === filter));

  const sampleTasks = finance ? ['Sample pupil 007 · ₦120,000 overdue', 'Sample pupil 008 · ₦85,000 due soon', 'Sample pupil 009 · ₦60,000 overdue', 'Sample pupil 010 · ₦75,000 due soon'] : isTeacher ? ["Mark today's attendance", 'Complete English scores', 'Correct 2 returned reports', 'Submit reports for review'] : ['Admission application', 'Transfer request', 'Report card review', 'Fee waiver request'];
  const sampleActivity = finance ? ['Payment recorded', 'Receipt issued', 'Invoice created', 'Partial payment recorded'] : isTeacher ? ['Attendance saved', 'Assessment scores updated', 'Report returned for correction', 'Report submitted'] : ['New admission submitted', 'Fee payment recorded', 'Report submitted for review', 'Teacher added'];
  const tasks = isPreview ? sampleTasks : liveData?.tasks ?? [];
  const activity = isPreview ? sampleActivity : [];
  return <div className="account-design">
    <div className="account-preview-bar"><span><strong>{isPreview ? 'Design preview' : 'Staging dashboard'}</strong> · {isPreview ? 'Sample data' : 'Fictional staging records'}</span><div className="account-desktop-preview-tools">{isPreview && accountSelector}{(isPreview || role !== 'bursar') && <Link href="/staging/report-cards" prefetch={false}>Open working staging reports<StagingLinkProgress /></Link>}</div></div>
    <aside className="account-sidebar"><div className="account-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 28V16C3 16 2 6 3 3c10 0 15 5 13 13C14 7 21 2 29 2c1 12-3 19-11 19v7z" /></svg><div><strong>Greenfield</strong><span>Primary School</span></div></div><p className="account-workspace-label">{names[role]} workspace</p>{nav}<p className="account-sidebar-note">First term · 2026/27<br />Primary 5 school</p></aside>
    <div className="account-body"><header className="account-topbar">
      <details className="account-mobile-nav" ref={mobileMenu} onKeyDown={event => { if (event.key === 'Escape' && !(event.target as HTMLElement).closest('[role="listbox"]') && mobileMenu.current) { mobileMenu.current.open = false; mobileMenu.current.querySelector('summary')?.focus(); } }}>
        <summary aria-label="Open account menu"><span aria-hidden="true">☰</span><span className="account-sr-only">Account menu</span></summary>
        <div className="account-mobile-menu"><strong>{names[role]} design navigation</strong>{nav}<div className="account-mobile-preview-tools">{isPreview && accountSelector}{(isPreview || role !== 'bursar') && <Link href="/staging/report-cards" prefetch={false}>Working staging reports<StagingLinkProgress /></Link>}<form action={signOutOfStaging}><StagingPendingButton label="Sign out" pendingLabel="Signing out…" /></form></div></div>
      </details>
      <div className="account-mobile-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 28V16C3 16 2 6 3 3c10 0 15 5 13 13C14 7 21 2 29 2c1 12-3 19-11 19v7z" /></svg>Greenfield</div>
      {academicView !== 'attendance' && academicView !== 'assessments' && <label className="account-search"><span className="account-sr-only">{isPreview ? 'Search sample pupils' : 'Search staging pupils'}</span><Glyph kind={1} /><input type="search" placeholder={academicView === 'classes' ? 'Search classes…' : finance ? 'Search pupil or payment…' : 'Search pupils…'} value={search} onChange={e => setSearch(e.target.value)} /></label>}<span className="account-profile"><span className="account-avatar" aria-label={names[role]}>{role[0].toUpperCase()}</span><span className="account-profile-name">{names[role]}</span></span><form className="account-desktop-signout" action={signOutOfStaging}><StagingPendingButton label="Sign out" pendingLabel="Signing out…" /></form></header>
      <main className="account-main"><div className="account-heading"><div><h1>{page === 'Overview' ? title : page}</h1><p className="account-heading-description">{finance ? 'School fees, payments and outstanding balances.' : isTeacher ? 'Your assigned classes, attendance and report tasks.' : 'Key information and activity at a glance.'}</p></div><span className="account-term">First term · 2026/27</span></div>
        {!isPreview && <p className="account-notice" role="status">{liveData ? liveData.scope : finance ? 'Finance data is not connected yet. No financial totals or payments are displayed.' : 'Verified class data is unavailable. No sample records or zero totals have been substituted.'}</p>}
        {notice && <div className="account-notice" role="status"><p>{notice}</p><button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}
        {!isPreview && academicView && (academicView === 'attendance' || academicView === 'assessments') && ['Attendance','Academics','Assessments'].includes(page) ? <StagingOperationsPages view={academicView} data={liveData} editor={assessmentEditor} classKey={initialClass} /> : !isPreview && academicView && ['Students','My classes','Report cards'].includes(page) ? <StagingAcademicPages view={academicView} data={liveData} initialClass={initialClass} search={search} onSearchChange={setSearch} /> : page !== 'Overview' ? <section className="account-panel account-planned"><Glyph kind={menus[role].indexOf(page)} /><h2>{page} workspace</h2><p>This section is planned. The approved navigation and layout are ready; its records and actions are not connected in this design preview.</p>{page === 'Report cards' && <Link href="/staging/report-cards" prefetch={false}>Open the working staging report workflow<StagingLinkProgress /></Link>}<button onClick={() => setPage('Overview')}>Back to overview</button></section> : <>
        <section className="account-metrics" aria-label={isPreview ? "Sample overview figures" : "Available staging overview figures"}>{metrics.map(([value, label], i) => <article className="account-panel account-metric" key={label}><span className={'account-metric-icon tone-' + i}><Glyph kind={i + 1} /></span><div><strong>{value}</strong><p>{label}</p></div></article>)}</section>
        <div className="account-columns"><section className="account-panel account-table-panel"><div className="account-panel-heading"><div><h2>{finance ? 'Recent payments' : isTeacher ? 'My pupils' : 'Students'}</h2><p>{isPreview ? finance ? 'Sample fee payments for layout review.' : 'Sample enrollment and status information.' : 'Available verified staging records.'}</p></div>{!isPreview && role === 'admin' ? <Link className="academic-button-link" href="/staging/students" prefetch={false}>View all students<StagingLinkProgress /></Link> : <button className={role === 'admin' ? '' : 'account-primary'} onClick={() => role === 'admin' ? setPage('Students') : preview(finance ? 'Record payment' : 'Mark attendance')}>{finance ? 'Record payment' : isTeacher ? 'Mark attendance' : 'View all students'}</button>}</div>
        <div className="account-filters"><label className="account-filter-search"><span className="account-sr-only">Search sample records</span><input type="search" placeholder={finance ? 'Search pupil or receipt…' : 'Search pupils…'} value={search} onChange={e => setSearch(e.target.value)} /></label>
          <GreenfieldDropdown label="Class" value={klass} onChange={setKlass} options={options(['All classes', ...new Set(records.map(s => s.klass))])} />
          <GreenfieldDropdown label={isTeacher || (!isPreview && !finance) ? 'Report status' : finance ? 'Payment method' : 'Status'} value={filter} onChange={setFilter} options={options(['All statuses', ...(!isPreview && !finance ? ['Not created', 'Draft', 'Awaiting review', 'Returned', 'Approved', 'Published'] : isTeacher ? ['Draft', 'Awaiting review', 'Returned'] : finance ? ['Cash', 'Bank transfer'] : ['Active', 'Needs attention', 'Inactive'])])} />
        </div>
        <div className="account-table-scroll" role="region" aria-label="Sample account records" tabIndex={0}><table><caption className="account-sr-only">Fictional {finance ? 'payments' : 'pupils'} for design review</caption><thead><tr><th scope="col">{finance ? 'Receipt no.' : isPreview ? 'Admission no.' : 'Student reference'}</th><th scope="col">Pupil name</th><th scope="col">Class</th><th scope="col">{finance ? 'Amount' : isTeacher ? 'Attendance' : isPreview ? 'Status' : 'Report status'}</th><th scope="col">{finance ? 'Method' : isTeacher ? 'Report status' : 'Balance'}</th></tr></thead><tbody>{rows.map(s => <tr key={s.id}><td>{finance ? s.receipt : isPreview ? s.id : s.id.slice(0, 8)}</td><th scope="row">{s.name}</th><td>{s.klass}</td><td>{finance ? money(s.amount) : <Badge warning={isTeacher ? s.attendance === 'Absent' : s.status !== 'Active'}>{isTeacher ? s.attendance : isPreview ? s.status : s.reportStatus}</Badge>}</td><td>{finance ? s.method : isTeacher ? <Badge warning={s.reportStatus !== 'Draft'}>{s.reportStatus}</Badge> : money(s.balance)}</td></tr>)}</tbody></table></div>
        <div className="account-mobile-records" aria-label={finance ? 'Sample payments' : 'Sample pupils'}>{rows.map(s => <article className="account-record-card" key={s.id}><div className="account-record-heading"><span className="account-record-avatar" aria-hidden="true">S</span><div><h3>{s.name}</h3><p>{finance ? s.receipt : isPreview ? s.id : s.id.slice(0, 8)} · {s.klass}</p></div></div><div className="account-record-facts">{finance ? <><strong>{money(s.amount)}</strong><Badge>{s.method}</Badge></> : isTeacher ? <><Badge warning={s.attendance === 'Absent'}>{s.attendance}</Badge><Badge warning={s.reportStatus !== 'Draft'}>{s.reportStatus === 'Draft' ? 'Draft report' : s.reportStatus}</Badge></> : <><Badge warning={s.status !== 'Active'}>{isPreview ? s.status : s.reportStatus}</Badge><span>Balance: {money(s.balance)}</span></>}</div></article>)}</div>
        {rows.length === 0 && <p className="account-empty" role="status">No records are available for this view or filter.</p>}
        <footer className="account-table-footer">Showing {rows.length} of {records.length} {isPreview ? 'sample' : 'staging'} records <span>Page 1 of 1</span></footer></section>
        <aside className="account-side-panels"><section className="account-panel"><div className="account-panel-heading"><h2>{finance ? 'Outstanding balances' : isTeacher ? 'Tasks to complete' : 'Pending approvals'}</h2></div>{!isPreview && tasks.length > 0 && <p className="account-empty"><Link href="/staging/report-cards" prefetch={false}>Open report workspace<StagingLinkProgress /></Link></p>}{!isPreview && tasks.length === 0 && <p className="account-empty">Tasks are not connected.</p>}{tasks.map((task, i) => !isPreview ? <Link className="account-task" href="/staging/reports" prefetch={false} key={task}><span className={'account-task-icon tone-' + i}><Glyph kind={i+2} /></span><span>{task}<small>Open available report tasks</small></span><StagingLinkProgress /></Link> : <button className="account-task" key={task} onClick={() => preview(task)}><span className={'account-task-icon tone-' + i}><Glyph kind={i+2} /></span><span>{task}<small>{isPreview ? finance ? 'Sample fee invoice' : 'Sample task · First term' : 'Verified report status · First term'}</small></span><span aria-hidden="true">›</span></button>)}</section><section className="account-panel"><div className="account-panel-heading"><h2>Recent activity</h2></div>{!isPreview && <p className="account-empty">Activity history is not connected.</p>}{activity.map((a, i) => <div className="account-activity" key={a}><span className="account-activity-dot" /><span>{a}<small>Sample event · {i+1} hours ago</small></span></div>)}</section></aside></div></>}
        <p className="account-footnote">{isPreview ? 'Design preview only. Switching the preview account changes sample content, not your signed-in role or permissions.' : 'Your workspace matches your verified staff membership. Only available verified staging classes are included. Attendance, finance and activity integrations are pending.'}</p>
      </main>
    </div>
  </div>;
}
