'use client';

import { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Search } from 'lucide-react';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import { deriveActiveAttendanceRoster, validateAttendanceCommand, type AttendanceContext, type AttendanceStatus } from '@/lib/attendance/attendance';
import { attendanceClassOptions, attendanceFixtureEnrollments, attendanceFixtureStudents, attendanceFixtureTeacherAssignments, attendanceSessionOptions, fictionalSchoolId } from './attendance-fixtures';
import './attendance.css';
import '../students/students.css';

const statuses: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' }, { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' }, { value: 'excused', label: 'Excused' },
];
const previewContext: AttendanceContext = {
  actor: { id: 'fictional-admin', schoolId: fictionalSchoolId, role: 'admin', status: 'active' },
  assignments: attendanceFixtureTeacherAssignments,
};

export function AttendanceWorkspace() {
  const [classId, setClassId] = useState<string>(attendanceClassOptions[1]!.id);
  const [sessionId, setSessionId] = useState<string>(attendanceSessionOptions[0]!.id);
  const [date, setDate] = useState('2026-10-18');
  const [query, setQuery] = useState('');
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({
    'student-amina': 'present', 'student-kofi': 'present', 'student-nia': 'absent', 'student-tomi': 'late',
  });
  const [message, setMessage] = useState('');
  const rosterResult = useMemo(() => deriveActiveAttendanceRoster(fictionalSchoolId, classId, sessionId, attendanceFixtureStudents, attendanceFixtureEnrollments), [classId, sessionId]);
  const roster = rosterResult.ok ? rosterResult.roster : [];
  const visibleRoster = roster.filter(student => student.displayName.toLowerCase().includes(query.trim().toLowerCase()) || student.admissionNumber.toLowerCase().includes(query.trim().toLowerCase()));
  const counts = statuses.map(status => ({ ...status, count: roster.filter(student => marks[student.studentId] === status.value).length }));

  function changeMark(studentId: string, status: AttendanceStatus) {
    setMarks(current => ({ ...current, [studentId]: status }));
    setMessage('Preview changed locally. Nothing has been saved.');
  }

  function validateRegister() {
    if (!rosterResult.ok) { setMessage(rosterResult.message); return; }
    const result = validateAttendanceCommand({
      schoolId: fictionalSchoolId, classId, sessionId, date,
      marks: roster.filter(student => marks[student.studentId]).map(student => ({ studentId: student.studentId, status: marks[student.studentId]! })),
    }, previewContext, rosterResult.roster);
    setMessage(result.ok ? `Register is valid for ${roster.length} active fictional enrollments. It was not saved.` : result.message);
  }

  return <main className="attendance-workspace">
    <header className="attendance-heading"><div><span className="attendance-eyebrow">ACADEMIC OPERATIONS</span><h1>Daily attendance</h1><p>Take a class register from active enrollment and review attendance at a glance.</p></div><span className="attendance-preview-badge">Fictional preview · not saved</span></header>
    <section className="attendance-summary" aria-label="Attendance summary">
      <article><span>Active students</span><strong>{roster.length}</strong><small>In selected class and session</small></article>
      {counts.map(item => <article key={item.value}><span>{item.label}</span><strong>{item.count}</strong><small>{roster.length ? Math.round(item.count / roster.length * 100) : 0}% of class</small></article>)}
    </section>
    <section className="attendance-card">
      <div className="attendance-card-heading"><div><h2>Class register</h2><p>Roster includes active enrollments only. Completed, withdrawn, and graduated enrollments are excluded.</p></div><span className="attendance-class-chip">{sessionLabel(sessionId)}</span></div>
      <div className="attendance-toolbar">
        <div className="attendance-dropdown-field"><GreenfieldDropdown label="Class" value={classId} options={attendanceClassOptions.map(option => ({ value: option.id, label: classLabel(option.id) }))} onChange={setClassId}/></div>
        <div className="attendance-dropdown-field"><GreenfieldDropdown label="Academic session" value={sessionId} options={attendanceSessionOptions.map(option => ({ value: option.id, label: `${sessionLabel(option.id)}${option.active ? '' : ' · inactive'}`, disabled: !option.active }))} onChange={setSessionId}/></div>
        <label>Date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        <label className="attendance-search"><span>Find student</span><span className="attendance-search-box"><Search size={16} aria-hidden="true"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search this class" /></span></label>
      </div>
      <div className="attendance-register">
        <div className="attendance-register-head"><span>Student</span><span>Attendance status</span></div>
        {!rosterResult.ok ? <p className="attendance-empty" role="alert">{rosterResult.message}</p> : visibleRoster.length ? visibleRoster.map(student => <div className="attendance-register-row" key={student.studentId}>
          <div className="attendance-person"><span className="attendance-avatar">{student.displayName.split(' ').map(word => word[0]).join('')}</span><span><strong>{student.displayName}</strong><small>{student.admissionNumber}</small></span></div>
          <div className="attendance-status-options" role="group" aria-label={`Attendance for ${student.displayName}`}>
            {statuses.map(status => <button key={status.value} type="button" aria-pressed={marks[student.studentId] === status.value} className={marks[student.studentId] === status.value ? `is-selected ${status.value}` : ''} onClick={() => changeMark(student.studentId, status.value)}>{status.label}</button>)}
          </div>
        </div>) : <p className="attendance-empty">{roster.length ? 'No active students match your search.' : 'No active students are enrolled in this class and session.'}</p>}
      </div>
      <footer className="attendance-footer"><p role="status" aria-live="polite">{message || 'Preview only. Changes stay in this page and are not submitted or stored.'}</p><button type="button" className="attendance-validate" onClick={validateRegister}><Check size={16}/> Validate register</button></footer>
    </section>
    <p className="attendance-note"><ClipboardCheck size={16}/> Teachers need an active assignment to this class and session. School admins can review registers; bursars have no attendance access.</p>
  </main>;
}

function classLabel(classId: string) { return classId === 'class-creche-a' ? 'Creche · Green Room' : 'Primary 5 · Cedar'; }
function sessionLabel(sessionId: string) { return sessionId === 'session-2026' ? '2026 / 2027 session' : '2025 / 2026 session'; }
