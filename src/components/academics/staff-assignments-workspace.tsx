'use client';

import { useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import { validateTeacherClassAssignment, type TeacherClassAssignment } from '@/lib/academics/assignments';
import { attendanceClassOptions, attendanceSessionOptions } from '@/components/attendance/attendance-fixtures';
import { academicOperationTeacherAssignments, academicOperationTeacherMemberships, academicOperationTeacherNames } from './academic-operations-fixtures';
import './academic-operations.css';

const schoolId = 'fictional-greenfield';
const admin = { id: 'membership-admin', schoolId, role: 'admin' as const, status: 'active' as const };

export function StaffAssignmentsWorkspace() {
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>(academicOperationTeacherAssignments);
  const [teacherId, setTeacherId] = useState(academicOperationTeacherMemberships[0]!.id);
  const [classId, setClassId] = useState(attendanceClassOptions[1]!.id);
  const [sessionId, setSessionId] = useState(attendanceSessionOptions[0]!.id);
  const [feedback, setFeedback] = useState('');

  function addAssignment() {
    const result = validateTeacherClassAssignment({ kind: 'assign', schoolId, teacherMembershipId: teacherId, classId, sessionId }, admin,
      academicOperationTeacherMemberships.find(row => row.id === teacherId) ?? null,
      attendanceClassOptions.find(row => row.id === classId) ?? null,
      attendanceSessionOptions.find(row => row.id === sessionId) ?? null,
      assignments);
    if (!result.ok) { setFeedback(result.message); return; }
    const assignment: TeacherClassAssignment = { ...result.assignment, id: `preview-assignment-${assignments.length + 1}` };
    setAssignments(current => [...current, assignment]);
    setFeedback('Assignment added to this fictional preview only. Nothing was saved.');
  }

  function toggle(assignment: TeacherClassAssignment) {
    const nextStatus = assignment.status === 'active' ? 'inactive' : 'active';
    const result = validateTeacherClassAssignment({ kind: 'set_status', schoolId, assignmentId: assignment.id, status: nextStatus }, admin,
      academicOperationTeacherMemberships.find(row => row.id === assignment.membershipId) ?? null,
      attendanceClassOptions.find(row => row.id === assignment.classId) ?? null,
      attendanceSessionOptions.find(row => row.id === assignment.sessionId) ?? null,
      assignments);
    if (!result.ok) { setFeedback(result.message); return; }
    setAssignments(current => current.map(row => row.id === assignment.id ? { ...row, status: nextStatus } : row));
    setFeedback(`Assignment ${nextStatus} in this preview. Nothing was saved.`);
  }

  return <section className="academic-ops-workspace">
    <header className="academic-ops-header"><div><span>PEOPLE & CLASSES</span><h1>Teacher assignments</h1><p>Connect existing teacher memberships to classes for an academic session.</p></div><span className="academic-ops-preview">Fictional preview</span></header>
    <div className="academic-ops-callout">Teacher identity comes from the school membership list. These preview changes are temporary and will reset when the page reloads.</div>
    <section className="academic-ops-panel">
      <div className="academic-ops-panel-heading"><div><h2>Assign a teacher</h2><p>Class sections remain attached to their academic level.</p></div><UserPlus size={20}/></div>
      <div className="academic-ops-fields">
        <div className="academic-ops-dropdown-field"><GreenfieldDropdown label="Teacher membership" value={teacherId} options={academicOperationTeacherMemberships.map(teacher => ({ value: teacher.id, label: academicOperationTeacherNames[teacher.id] ?? 'Unknown teacher' }))} onChange={setTeacherId}/></div>
        <div className="academic-ops-dropdown-field"><GreenfieldDropdown label="Class" value={classId} options={attendanceClassOptions.map(item => ({ value: item.id, label: classLabel(item.id) }))} onChange={setClassId}/></div>
        <div className="academic-ops-dropdown-field"><GreenfieldDropdown label="Academic session" value={sessionId} options={attendanceSessionOptions.filter(item => item.active).map(item => ({ value: item.id, label: item.id === 'session-2026' ? '2026 / 2027' : item.id }))} onChange={setSessionId}/></div>
        <button type="button" className="academic-ops-primary" onClick={addAssignment}>Add assignment</button>
      </div>
      <p className="academic-ops-feedback" role="status" aria-live="polite">{feedback || 'Only school admins can manage teacher-to-class assignments.'}</p>
    </section>
    <section className="academic-ops-panel">
      <div className="academic-ops-panel-heading"><div><h2>Class coverage</h2><p>{assignments.length} assignment records · active and historical states</p></div></div>
      <div className="academic-ops-table-wrap"><table className="academic-ops-table"><thead><tr><th>Teacher</th><th>Class</th><th>Session</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {assignments.map(assignment => <tr key={assignment.id}><td>{academicOperationTeacherNames[assignment.membershipId]}</td><td>{classLabel(assignment.classId)}</td><td>{assignment.sessionId === 'session-2026' ? '2026 / 2027' : '2025 / 2026'}</td><td><span className={`academic-ops-status ${assignment.status}`}>{assignment.status}</span></td><td><button type="button" className="academic-ops-text-button" onClick={() => toggle(assignment)}>{assignment.status === 'active' ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}
      </tbody></table></div>
      {assignments.length === 0 && <p className="academic-ops-empty">No teacher assignments yet.</p>}
    </section>
    <p className="academic-ops-note"><Check size={16}/> Teachers can view attendance rosters only for their active class and session assignments.</p>
  </section>;
}

function classLabel(classId: string) {
  return attendanceClassOptions.find(item => item.id === classId)?.id === 'class-creche-a' ? 'Creche · Green Room' : 'Primary 5 · Cedar';
}
