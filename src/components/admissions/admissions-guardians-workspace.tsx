'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, FilePlus2, HeartHandshake, Search, UsersRound } from 'lucide-react';
import { GreenfieldDatePicker } from '@/components/greenfield-date-picker';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import { executeAdmissionCommand, type AdmissionCommand, type AdmissionOutcome, type AdmissionPreviewState, type GuardianRelationship } from '@/lib/admissions/admissions';
import { admissionsAdmin, admissionsClasses, newAdmissionsPreviewState } from './admissions-fixtures';
import './admissions-guardians.css';
import '../students/students.css';

type Workspace = 'admissions' | 'guardians';
const statusOptions = [
  { value: 'all', label: 'All applications' }, { value: 'draft', label: 'Draft' }, { value: 'submitted', label: 'Submitted' },
  { value: 'reviewing', label: 'In review' }, { value: 'approved', label: 'Approved' }, { value: 'waitlisted', label: 'Waitlisted' }, { value: 'rejected', label: 'Rejected' },
];
const relationshipOptions = [
  { value: 'parent', label: 'Parent' }, { value: 'legal_guardian', label: 'Legal guardian' }, { value: 'other', label: 'Other caregiver' },
];

export function AdmissionsGuardiansWorkspace() {
  const [view, setView] = useState<Workspace>('admissions');
  const [state, setState] = useState<AdmissionPreviewState>(newAdmissionsPreviewState);
  const [feedback, setFeedback] = useState('Changes are temporary and stay in this fictional preview.');
  const counter = useRef(0);
  const operationId = () => `offline-operation-${++counter.current}`;

  function run(command: AdmissionCommand) {
    const result = executeAdmissionCommand(state, { actor: admissionsAdmin, occurredAt: '2026-08-18T10:00:00.000Z' }, command);
    if (!result.ok) { setFeedback(result.message); return false; }
    setState(result.state);
    setFeedback(result.replayed ? 'This preview operation was already applied.' : 'Preview updated locally. Nothing was saved.');
    return true;
  }

  return <main className="admissions-root">
    <div className="admissions-kicker"><span>GREENFIELD SCHOOL MANAGEMENT</span><span>Fictional records · memory only</span></div>
    <header className="admissions-heading"><div><span>STUDENT SERVICES</span><h1>Admissions & guardians</h1><p>Review new applicants and keep family contacts connected to students.</p></div><span className="admissions-preview-pill">Offline preview</span></header>
    <nav className="admissions-tabs" aria-label="Admissions and guardian workspaces">
      <button type="button" aria-current={view === 'admissions' ? 'page' : undefined} onClick={() => setView('admissions')}><FilePlus2 size={16}/> Admissions</button>
      <button type="button" aria-current={view === 'guardians' ? 'page' : undefined} onClick={() => setView('guardians')}><UsersRound size={16}/> Guardians</button>
    </nav>
    {view === 'admissions' ? <AdmissionsPanel state={state} run={run} feedback={feedback} nextOperationId={operationId}/> : <GuardiansPanel state={state} run={run} feedback={feedback} nextOperationId={operationId}/>}
  </main>;
}

function AdmissionsPanel({ state, run, feedback, nextOperationId }: { state: AdmissionPreviewState; run: (command: AdmissionCommand) => boolean; feedback: string; nextOperationId: () => string }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState('app-ibrahim');
  const [note, setNote] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [levelId, setLevelId] = useState('level-nursery-1');
  const [classId, setClassId] = useState('class-level-nursery-1-green');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [relationship, setRelationship] = useState<GuardianRelationship>('parent');
  const [admissionNumber, setAdmissionNumber] = useState('GF/27/016');
  const [sessionId, setSessionId] = useState('session-2026');

  const filtered = useMemo(() => state.applicants.filter(applicant => applicant.schoolId === state.schoolId).filter(applicant => {
    const text = `${applicant.firstName} ${applicant.lastName} ${applicant.id}`.toLocaleLowerCase();
    return (status === 'all' || applicant.status === status) && text.includes(query.trim().toLocaleLowerCase());
  }), [state.applicants, state.schoolId, status, query]);
  const selected = state.applicants.find(item => item.id === selectedId && item.schoolId === state.schoolId) ?? filtered[0];
  const currentClass = selected ? state.classes.find(item => item.id === selected.proposedClassId) : undefined;
  const selectedGuardians = selected?.guardianIds.map(id => state.guardians.find(item => item.id === id && item.schoolId === state.schoolId)).filter((item): item is NonNullable<typeof item> => !!item) ?? [];
  const classesForLevel = admissionsClasses.filter(item => item.levelId === levelId && item.active);

  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const opId = nextOperationId();
    const result = run({ kind: 'register_applicant', operationId: opId, applicantId: `application-${opId}`, input: {
      firstName, lastName, dateOfBirth, requestedLevelId: levelId, proposedClassId: classId,
      guardian: { fullName: guardianName, phone: guardianPhone, email: guardianEmail, relationship, isPrimary: true, isEmergency: true },
    } });
    if (result) { setSelectedId(`application-${opId}`); setQuery(''); setStatus('all'); setFirstName(''); setLastName(''); setDateOfBirth(''); setGuardianName(''); setGuardianPhone(''); setGuardianEmail(''); }
  }

  function moveToReview() {
    if (!selected) return;
    const nextStatus = selected.status === 'draft' ? 'submitted' : 'reviewing';
    run({ kind: 'set_review_status', operationId: nextOperationId(), applicantId: selected.id, expectedVersion: selected.version, status: nextStatus, note: note.trim() });
    setNote('');
  }
  function decide(outcome: AdmissionOutcome) {
    if (!selected) return;
    if (run({ kind: 'decide_admission', operationId: nextOperationId(), applicantId: selected.id, expectedVersion: selected.version, outcome, note })) setNote('');
  }

  return <div className="admissions-content">
    <div className="admissions-callout"><Check size={17}/><span>Academic levels follow this school’s Creche → Nursery → Primary progression. The configured final level is Primary {state.finalPrimaryYear}; class sections are selected separately.</span></div>
    <div className="admissions-stats" aria-label="Application counts">{(['submitted', 'reviewing', 'approved', 'waitlisted'] as const).map(value => <article key={value}><span>{value === 'reviewing' ? 'In review' : value}</span><strong>{state.applicants.filter(item => item.schoolId === state.schoolId && item.status === value).length}</strong></article>)}</div>
    <section className="admissions-panel admissions-new-applicant"><div className="admissions-panel-title"><div><h2>Register an applicant</h2><p>Application and guardian details stay in memory in this preview.</p></div><FilePlus2 size={20}/></div>
      <form onSubmit={register} className="admissions-form-grid">
        <label>First name<input value={firstName} onChange={event => setFirstName(event.target.value)} maxLength={100} required autoComplete="off"/></label>
        <label>Last name<input value={lastName} onChange={event => setLastName(event.target.value)} maxLength={100} required autoComplete="off"/></label>
        <div className="admissions-field"><span>Date of birth</span><GreenfieldDatePicker label="Applicant date of birth" value={dateOfBirth} onChange={setDateOfBirth}/></div>
        <div className="admissions-field"><GreenfieldDropdown label="Requested level" value={levelId} options={state.structure.levels.map(level => ({ value: level.id, label: level.name }))} onChange={value => { setLevelId(value); const first = state.classes.find(item => item.levelId === value); if (first) setClassId(first.id); }}/></div>
        <div className="admissions-field"><GreenfieldDropdown label="Proposed class" value={classId} options={classesForLevel.map(item => ({ value: item.id, label: item.name }))} onChange={setClassId}/></div>
        <label>Guardian name<input value={guardianName} onChange={event => setGuardianName(event.target.value)} maxLength={180} required autoComplete="off"/></label>
        <label>Guardian phone<input value={guardianPhone} onChange={event => setGuardianPhone(event.target.value)} maxLength={32} autoComplete="tel" inputMode="tel"/></label>
        <label>Guardian email<input type="email" value={guardianEmail} onChange={event => setGuardianEmail(event.target.value)} maxLength={254} autoComplete="email"/></label>
        <div className="admissions-field"><GreenfieldDropdown label="Guardian relationship" value={relationship} options={relationshipOptions} onChange={value => setRelationship(value as GuardianRelationship)}/></div>
        <button className="admissions-primary" type="submit">Submit application</button>
      </form>
    </section>
    <div className="admissions-two-column">
      <section className="admissions-panel admissions-directory"><div className="admissions-panel-title"><div><h2>Applicant directory</h2><p>{filtered.length} matching application{filtered.length === 1 ? '' : 's'}</p></div></div>
        <div className="admissions-directory-tools"><label className="admissions-search"><Search size={16}/><input aria-label="Search applicants" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or application"/></label><div className="admissions-field"><GreenfieldDropdown label="Status filter" value={status} options={statusOptions} onChange={setStatus}/></div></div>
        <div className="admissions-applicant-list">{filtered.map(applicant => <button type="button" key={applicant.id} className={`admissions-applicant-row${selected?.id === applicant.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(applicant.id)}><span><strong>{applicant.firstName} {applicant.lastName}</strong><small>{levelName(state, applicant.requestedLevelId)} · {applicant.id}</small></span><span className={`admissions-status ${applicant.status}`}>{statusLabel(applicant.status)}</span></button>)}
          {!filtered.length && <div className="admissions-empty"><Search size={20}/><strong>No applications found</strong><span>Adjust the search or choose another status.</span></div>}</div>
      </section>
      <section className="admissions-panel admissions-detail" aria-label="Applicant details">
        {!selected ? <div className="admissions-empty"><FilePlus2 size={20}/><strong>Select an application</strong><span>Applicant details and review history will appear here.</span></div> : <>
          <div className="admissions-panel-title"><div><span className="admissions-eyebrow">APPLICATION DETAILS</span><h2>{selected.firstName} {selected.lastName}</h2><p>{selected.id} · {selected.status === 'draft' ? 'Draft application' : `Submitted ${selected.submittedAt.slice(0, 10)}`}</p></div><span className={`admissions-status ${selected.status}`}>{statusLabel(selected.status)}</span></div>
          <div className="admissions-detail-grid"><div><span>Date of birth</span><strong>{selected.dateOfBirth || 'Not provided'}</strong></div><div><span>Requested level</span><strong>{levelName(state, selected.requestedLevelId)}</strong></div><div><span>Proposed class</span><strong>{currentClass?.name ?? 'Unavailable placement'}</strong></div></div>
          <div className="admissions-guardian-summary"><h3>Guardian information</h3>{selectedGuardians.length ? selectedGuardians.map((guardian, index) => { const rel = selected.guardianRelationships.find(item => item.guardianId === guardian.id); return <div className="admissions-contact-row" key={guardian.id}><span><strong>{guardian.fullName}</strong><small>{guardian.phone || guardian.email} · {relationshipLabel(rel?.relationship ?? 'other')}</small></span>{rel?.isPrimary && <span className="admissions-status approved">Primary</span>}{index === 0 && <span className="admissions-status">Emergency</span>}</div>; }) : <p className="admissions-empty-line">No guardian information is attached.</p>}</div>
          <div className="admissions-history"><h3>Notes & decision history</h3>{selected.decisionHistory.map((item, index) => <div className="admissions-history-row" key={`${item.createdAt}-${index}`}><span className="admissions-history-dot"/><div><strong>{item.from ? `${statusLabel(item.from)} → ${statusLabel(item.to)}` : statusLabel(item.to)}</strong><p>{item.note || 'No note added.'}</p><small>{item.createdAt.slice(0, 10)} · Admin review</small></div></div>)}</div>
          {selected.status === 'reviewing' && <div className="admissions-decision-box"><label>Admission note<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={3} placeholder="Record the reason for this decision"/></label><div className="admissions-actions"><button className="admissions-primary" type="button" onClick={() => decide('approved')}>Approve</button><button className="admissions-secondary" type="button" onClick={() => decide('waitlisted')}>Waitlist</button><button className="admissions-danger" type="button" onClick={() => decide('rejected')}>Reject</button></div></div>}
          {(selected.status === 'submitted' || selected.status === 'draft' || selected.status === 'waitlisted') && <button className="admissions-primary" type="button" onClick={moveToReview}>{selected.status === 'draft' ? 'Submit application' : selected.status === 'waitlisted' ? 'Reopen review' : 'Begin review'}</button>}
          {selected.status === 'approved' && !selected.studentId && <div className="admissions-onboard"><h3>Onboard approved applicant</h3><p>Creates one student, one session enrollment, and carries the reviewed guardian links forward.</p><div className="admissions-form-grid"><label>Admission number<input value={admissionNumber} onChange={event => setAdmissionNumber(event.target.value)} maxLength={50}/></label><div className="admissions-field"><GreenfieldDropdown label="Academic session" value={sessionId} options={state.sessions.filter(item => item.active && item.schoolId === state.schoolId).map(item => ({ value: item.id, label: item.label }))} onChange={setSessionId}/></div><div className="admissions-field"><GreenfieldDropdown label="Reviewed class" value={selected.proposedClassId} options={state.classes.filter(item => item.id === selected.proposedClassId && item.schoolId === state.schoolId).map(item => ({ value: item.id, label: item.name }))} onChange={() => undefined} disabled/></div><button className="admissions-primary" type="button" onClick={() => run({ kind: 'onboard_approved_applicant', operationId: nextOperationId(), applicantId: selected.id, expectedVersion: selected.version, admissionNumber, classId: selected.proposedClassId, sessionId })}>Create student record</button></div></div>}
          {selected.studentId && <p className="admissions-success-note"><Check size={16}/> Onboarded as {selected.studentId}. A duplicate submission will not create another record.</p>}
        </>}
      </section>
    </div>
    <p className="admissions-feedback" role="status" aria-live="polite">{feedback}</p>
  </div>;
}

function GuardiansPanel({ state, run, feedback, nextOperationId }: { state: AdmissionPreviewState; run: (command: AdmissionCommand) => boolean; feedback: string; nextOperationId: () => string }) {
  const [query, setQuery] = useState('');
  const [guardianId, setGuardianId] = useState(state.guardians[0]?.id ?? '');
  const [studentId, setStudentId] = useState(state.students[0]?.id ?? '');
  const [relationship, setRelationship] = useState<GuardianRelationship>('parent');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [fullName, setFullName] = useState(state.guardians[0]?.fullName ?? '');
  const [phone, setPhone] = useState(state.guardians[0]?.phone ?? '');
  const [email, setEmail] = useState(state.guardians[0]?.email ?? '');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const selected = state.guardians.find(item => item.id === guardianId);
  const visible = state.guardians.filter(item => item.schoolId === state.schoolId && `${item.fullName} ${item.phone} ${item.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const linkedStudents = selected ? state.guardianLinks.filter(item => item.active && item.guardianId === selected.id && item.schoolId === state.schoolId).map(link => ({ link, student: state.students.find(student => student.id === link.studentId && student.schoolId === state.schoolId) })).filter((item): item is { link: typeof state.guardianLinks[number]; student: NonNullable<typeof item.student> } => !!item.student) : [];
  const relatedApplicants = selected ? state.applicants.filter(item => item.schoolId === state.schoolId && item.guardianIds.includes(selected.id)) : [];
  const activeStudent = state.students.find(item => item.id === studentId && item.schoolId === state.schoolId);
  const activeRelation = state.guardianLinks.find(item => item.active && item.schoolId === state.schoolId && item.studentId === studentId && item.guardianId === guardianId);

  function selectGuardian(id: string) {
    setGuardianId(id);
    const item = state.guardians.find(row => row.id === id);
    if (item) { setFullName(item.fullName); setPhone(item.phone); setEmail(item.email); }
    const relation = state.guardianLinks.find(row => row.active && row.schoolId === state.schoolId && row.studentId === studentId && row.guardianId === id);
    if (relation) { setRelationship(relation.relationship); setIsPrimary(relation.isPrimary); setIsEmergency(relation.isEmergency); }
    else { setIsPrimary(false); setIsEmergency(false); }
  }
  function updateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    run({ kind: 'update_guardian_contact', operationId: nextOperationId(), guardianId: selected.id, expectedVersion: selected.version, fullName, phone, email });
  }
  function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const op = nextOperationId();
    if (run({ kind: 'create_guardian', operationId: op, guardianId: `guardian-${op}`, fullName: newName, phone: newPhone, email: newEmail })) { setNewName(''); setNewPhone(''); setNewEmail(''); }
  }
  function saveRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !activeStudent) return;
    run({ kind: 'link_guardian', operationId: nextOperationId(), studentId: activeStudent.id, expectedStudentVersion: activeStudent.version, guardianId: selected.id, relationship, isPrimary, isEmergency });
  }

  return <div className="guardians-content">
    <div className="admissions-callout"><HeartHandshake size={18}/><span>Guardian records are school-scoped. A guardian may support multiple siblings, and a student may have multiple active guardians.</span></div>
    <div className="guardians-layout">
      <section className="admissions-panel guardians-directory"><div className="admissions-panel-title"><div><h2>Guardian directory</h2><p>{visible.length} contact{visible.length === 1 ? '' : 's'}</p></div></div><label className="admissions-search"><Search size={16}/><input aria-label="Search guardians" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, phone or email"/></label><div className="guardian-list">{visible.map(item => { const count = state.guardianLinks.filter(link => link.active && link.schoolId === state.schoolId && link.guardianId === item.id).length; return <button type="button" key={item.id} className={`guardian-list-row${guardianId === item.id ? ' is-selected' : ''}`} onClick={() => selectGuardian(item.id)}><span><strong>{item.fullName}</strong><small>{item.phone || item.email}</small></span><small>{count} student{count === 1 ? '' : 's'}</small></button>; })}{!visible.length && <div className="admissions-empty"><UsersRound size={20}/><strong>No guardians found</strong><span>Try a different search term.</span></div>}</div></section>
      <div className="guardians-main">
        {selected && <section className="admissions-panel"><div className="admissions-panel-title"><div><span className="admissions-eyebrow">GUARDIAN PROFILE</span><h2>{selected.fullName}</h2><p>{linkedStudents.length} linked student{linkedStudents.length === 1 ? '' : 's'} · school scoped</p></div><HeartHandshake size={20}/></div>
          <div className="guardian-contact-summary"><span><small>Phone</small><strong>{selected.phone || 'Not provided'}</strong></span><span><small>Email</small><strong>{selected.email || 'Not provided'}</strong></span></div>
          <h3 className="guardian-subheading">Linked students & relationship history</h3>
          <div className="guardian-links-list">{linkedStudents.length ? linkedStudents.map(({ link, student }) => <article key={link.id}><span><strong>{student.firstName} {student.lastName}</strong><small>{student.admissionNumber} · {relationshipLabel(link.relationship)}</small></span><span className="guardian-badges">{link.isPrimary && <em>Primary</em>}{link.isEmergency && <em>Emergency</em>}</span></article>) : <p className="admissions-empty-line">No student links yet. Connect this guardian below.</p>}</div>
          {relatedApplicants.length > 0 && <div className="guardian-links-list"><h3 className="guardian-subheading">Applicant relationships</h3>{relatedApplicants.map(applicant => <article key={applicant.id}><span><strong>{applicant.firstName} {applicant.lastName}</strong><small>{applicant.id} · {statusLabel(applicant.status)}</small></span><span className={`admissions-status ${applicant.status}`}>{statusLabel(applicant.status)}</span></article>)}</div>}
          {state.relationshipHistory.filter(item => item.guardianId === selected.id).map(item => <p className="guardian-history-item" key={`${item.linkId}-${item.endedByOperationId}`}>Previous relationship: {relationshipLabel(item.relationship)} · {item.isPrimary ? 'Primary' : 'Additional'} · retained in preview history</p>)}
          <form className="guardian-contact-form" onSubmit={updateContact}><h3>Update contact</h3><label>Full name<input value={fullName} onChange={event => setFullName(event.target.value)} required maxLength={180}/></label><label>Phone<input value={phone} onChange={event => setPhone(event.target.value)} maxLength={32} inputMode="tel"/></label><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254}/></label><button className="admissions-secondary" type="submit">Save contact details</button></form>
        </section>}
        <section className="admissions-panel"><div className="admissions-panel-title"><div><h2>Link guardian to a student</h2><p>Change relationship details without losing prior relationship history.</p></div></div><form className="guardian-link-form" onSubmit={saveRelationship}>
          <div className="admissions-field"><GreenfieldDropdown label="Guardian" value={guardianId} options={state.guardians.filter(item => item.schoolId === state.schoolId).map(item => ({ value: item.id, label: item.fullName }))} onChange={selectGuardian}/></div>
          <div className="admissions-field"><GreenfieldDropdown label="Student" value={studentId} options={state.students.filter(item => item.schoolId === state.schoolId).map(item => ({ value: item.id, label: `${item.firstName} ${item.lastName}` }))} onChange={value => { setStudentId(value); const relation = state.guardianLinks.find(row => row.active && row.schoolId === state.schoolId && row.studentId === value && row.guardianId === guardianId); setRelationship(relation?.relationship ?? 'parent'); setIsPrimary(relation?.isPrimary ?? false); setIsEmergency(relation?.isEmergency ?? false); }}/></div>
          <div className="admissions-field"><GreenfieldDropdown label="Relationship" value={relationship} options={relationshipOptions} onChange={value => setRelationship(value as GuardianRelationship)}/></div>
          <label className="guardian-check"><input type="checkbox" checked={isPrimary} onChange={event => setIsPrimary(event.target.checked)}/> Primary guardian</label>
          <label className="guardian-check"><input type="checkbox" checked={isEmergency} onChange={event => setIsEmergency(event.target.checked)}/> Emergency contact</label>
          <button className="admissions-primary" type="submit" disabled={!selected || !activeStudent}>Save relationship</button>
          {activeRelation && <p className="guardian-current-note">Current relationship: {relationshipLabel(activeRelation.relationship)}{activeRelation.isPrimary ? ' · Primary' : ''}{activeRelation.isEmergency ? ' · Emergency contact' : ''}</p>}
        </form></section>
        <section className="admissions-panel"><div className="admissions-panel-title"><div><h2>Add guardian contact</h2><p>Duplicate phone or email details in this school are rejected.</p></div></div><form className="guardian-create-form" onSubmit={createContact}><label>Full name<input value={newName} onChange={event => setNewName(event.target.value)} required maxLength={180}/></label><label>Phone<input value={newPhone} onChange={event => setNewPhone(event.target.value)} maxLength={32} inputMode="tel"/></label><label>Email<input type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} maxLength={254}/></label><button className="admissions-secondary" type="submit">Add guardian</button></form></section>
      </div>
    </div>
    <p className="admissions-feedback" role="status" aria-live="polite">{feedback}</p>
  </div>;
}

function levelName(state: AdmissionPreviewState, id: string) { return state.structure.levels.find(item => item.id === id)?.name ?? 'Unknown level'; }
function statusLabel(status: string) { return status === 'reviewing' ? 'In review' : status.charAt(0).toUpperCase() + status.slice(1); }
function relationshipLabel(value: GuardianRelationship) { return value === 'legal_guardian' ? 'Legal guardian' : value === 'parent' ? 'Parent' : 'Other caregiver'; }
