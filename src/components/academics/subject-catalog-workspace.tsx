'use client';

import { useState } from 'react';
import { BookOpenCheck, Plus } from 'lucide-react';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import { validateSubjectCatalogChange, validateSubjectClassAssignment, validateSubjectLevelAssignment, validateTeacherSubjectAssignment, type Subject, type SubjectClassAssignment, type SubjectLevelAssignment, type TeacherSubjectAssignment } from '@/lib/academics/subjects';
import { attendanceClassOptions, attendanceSessionOptions } from '@/components/attendance/attendance-fixtures';
import { academicOperationClassSubjects, academicOperationLevelSubjects, academicOperationLevels, academicOperationSubjects, academicOperationTeacherAssignments, academicOperationTeacherMemberships, academicOperationTeacherNames, academicOperationTeacherSubjects } from './academic-operations-fixtures';
import './academic-operations.css';

const schoolId = 'fictional-greenfield';
const admin = { id: 'membership-admin', schoolId, role: 'admin' as const, status: 'active' as const };

export function SubjectCatalogWorkspace() {
  const [subjects, setSubjects] = useState<Subject[]>(academicOperationSubjects);
  const [levelAssignments, setLevelAssignments] = useState<SubjectLevelAssignment[]>(academicOperationLevelSubjects);
  const [classAssignments, setClassAssignments] = useState<SubjectClassAssignment[]>(academicOperationClassSubjects);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherSubjectAssignment[]>(academicOperationTeacherSubjects);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState(academicOperationSubjects[0]!.id);
  const [levelId, setLevelId] = useState<string>(academicOperationLevels[2]!.id);
  const [classId, setClassId] = useState(attendanceClassOptions[1]!.id);
  const [teacherId, setTeacherId] = useState(academicOperationTeacherMemberships[0]!.id);
  const [feedback, setFeedback] = useState('');

  function addSubject() {
    const result = validateSubjectCatalogChange({ schoolId, code, name, active: true }, admin, subjects);
    if (!result.ok) { setFeedback(result.message); return; }
    const item: Subject = { ...result.value, id: `preview-subject-${subjects.length + 1}` };
    setSubjects(current => [...current, item]);
    setSubjectId(item.id);
    setCode(''); setName('');
    setFeedback('Subject added to this fictional catalog only. Nothing was saved.');
  }

  function toggleSubject(subject: Subject) {
    const result = validateSubjectCatalogChange({ schoolId, subjectId: subject.id, code: subject.code, name: subject.name, active: !subject.active }, admin, subjects);
    if (!result.ok) { setFeedback(result.message); return; }
    setSubjects(current => current.map(row => row.id === subject.id ? { ...row, active: !row.active } : row));
    setFeedback(`Subject ${subject.active ? 'deactivated' : 'activated'} in preview only.`);
  }

  function assignToLevel() {
    const current = levelAssignments.find(row => row.subjectId === subjectId && row.levelId === levelId);
    const result = validateSubjectLevelAssignment({ schoolId, subjectId, levelId, status: 'active' }, admin,
      subjects.find(row => row.id === subjectId) ?? null,
      academicOperationLevels.find(row => row.id === levelId) ?? null,
      levelAssignments);
    if (!result.ok) { setFeedback(result.message); return; }
    if (current) setLevelAssignments(rows => rows.map(row => row.id === current.id ? { ...row, status: 'active' } : row));
    else setLevelAssignments(rows => [...rows, { ...result.value, id: `preview-level-subject-${rows.length + 1}` }]);
    setFeedback('Subject linked to the academic level in this preview only.');
  }

  function assignToClass() {
    const current = classAssignments.find(row => row.subjectId === subjectId && row.classId === classId);
    const result = validateSubjectClassAssignment({ schoolId, subjectId, classId, status: 'active' }, admin,
      subjects.find(row => row.id === subjectId) ?? null,
      attendanceClassOptions.find(row => row.id === classId) ?? null,
      classAssignments, levelAssignments);
    if (!result.ok) { setFeedback(result.message); return; }
    if (current) setClassAssignments(rows => rows.map(row => row.id === current.id ? { ...row, status: 'active' } : row));
    else setClassAssignments(rows => [...rows, { ...result.value, id: `preview-class-subject-${rows.length + 1}` }]);
    setFeedback('Subject linked to the class in this preview only.');
  }

  function toggleLevelAssignment(row: SubjectLevelAssignment) {
    const status = row.status === 'active' ? 'inactive' : 'active';
    const result = validateSubjectLevelAssignment({ schoolId, subjectId: row.subjectId, levelId: row.levelId, status }, admin,
      subjects.find(item => item.id === row.subjectId) ?? null,
      academicOperationLevels.find(item => item.id === row.levelId) ?? null,
      levelAssignments);
    if (!result.ok) { setFeedback(result.message); return; }
    setLevelAssignments(current => current.map(item => item.id === row.id ? { ...item, status } : item));
    setFeedback(`Level subject assignment ${status} in preview.`);
  }

  function toggleClassAssignment(row: SubjectClassAssignment) {
    const status = row.status === 'active' ? 'inactive' : 'active';
    const result = validateSubjectClassAssignment({ schoolId, subjectId: row.subjectId, classId: row.classId, status }, admin,
      subjects.find(item => item.id === row.subjectId) ?? null,
      attendanceClassOptions.find(item => item.id === row.classId) ?? null,
      classAssignments, levelAssignments);
    if (!result.ok) { setFeedback(result.message); return; }
    setClassAssignments(current => current.map(item => item.id === row.id ? { ...item, status } : item));
    setFeedback(`Class subject assignment ${status} in preview.`);
  }

  function assignTeacherToSubject() {
    const current = teacherAssignments.find(row => row.membershipId === teacherId && row.subjectId === subjectId && row.classId === classId && row.sessionId === attendanceSessionOptions[0]!.id);
    const result = validateTeacherSubjectAssignment({ schoolId, membershipId: teacherId, subjectId, classId, sessionId: attendanceSessionOptions[0]!.id, status: 'active' }, admin,
      academicOperationTeacherMemberships.find(row => row.id === teacherId) ?? null,
      subjects.find(row => row.id === subjectId) ?? null,
      attendanceClassOptions.find(row => row.id === classId) ?? null,
      attendanceSessionOptions[0] ?? null,
      academicOperationTeacherAssignments, classAssignments, levelAssignments, teacherAssignments);
    if (!result.ok) { setFeedback(result.message); return; }
    if (current) setTeacherAssignments(rows => rows.map(row => row.id === current.id ? { ...row, status: 'active' } : row));
    else setTeacherAssignments(rows => [...rows, { ...result.value, id: `preview-teacher-subject-${rows.length + 1}` }]);
    setFeedback('Teacher linked to the subject, class, and session in preview only.');
  }

  function toggleTeacherSubject(row: TeacherSubjectAssignment) {
    const status = row.status === 'active' ? 'inactive' : 'active';
    const result = validateTeacherSubjectAssignment({ schoolId, membershipId: row.membershipId, subjectId: row.subjectId, classId: row.classId, sessionId: row.sessionId, status }, admin,
      academicOperationTeacherMemberships.find(item => item.id === row.membershipId) ?? null,
      subjects.find(item => item.id === row.subjectId) ?? null,
      attendanceClassOptions.find(item => item.id === row.classId) ?? null,
      attendanceSessionOptions.find(item => item.id === row.sessionId) ?? null,
      academicOperationTeacherAssignments, classAssignments, levelAssignments, teacherAssignments);
    if (!result.ok) { setFeedback(result.message); return; }
    setTeacherAssignments(current => current.map(item => item.id === row.id ? { ...item, status } : item));
    setFeedback(`Teacher subject assignment ${status} in preview.`);
  }

  return <section className="academic-ops-workspace">
    <header className="academic-ops-header"><div><span>ACADEMIC SETTINGS</span><h1>Subjects</h1><p>Manage a school subject catalog and link subjects to levels, classes, and assigned teachers.</p></div><span className="academic-ops-preview">Fictional preview</span></header>
    <div className="academic-ops-callout">Academic levels and class sections are separate. A subject may be offered school-wide at a level or assigned to an individual class.</div>
    <section className="academic-ops-panel"><div className="academic-ops-panel-heading"><div><h2>School subject catalog</h2><p>Only active subjects can be linked to classes and teachers.</p></div><BookOpenCheck size={20}/></div>
      <div className="academic-ops-subject-form"><label>Subject code<input value={code} onChange={event => setCode(event.target.value)} maxLength={24} placeholder="e.g. ART"/></label><label>Subject name<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="e.g. Creative Arts"/></label><button type="button" className="academic-ops-primary" onClick={addSubject}><Plus size={15}/> Add subject</button></div>
      <div className="academic-ops-chip-list">{subjects.map(subject => <article className="academic-ops-subject-chip" key={subject.id}><span><strong>{subject.name}</strong><small>{subject.code}</small></span><span className={`academic-ops-status ${subject.active ? 'active' : 'inactive'}`}>{subject.active ? 'Active' : 'Inactive'}</span><button type="button" className="academic-ops-text-button" onClick={() => toggleSubject(subject)}>{subject.active ? 'Deactivate' : 'Activate'}</button></article>)}</div>
    </section>
    <section className="academic-ops-panel"><div className="academic-ops-panel-heading"><div><h2>Subject scope</h2><p>Assign the selected subject at a level or at a specific class.</p></div></div>
      <div className="academic-ops-fields academic-ops-fields-four"><div className="academic-ops-dropdown-field"><GreenfieldDropdown label="Subject" value={subjectId} options={subjects.filter(item => item.active).map(item => ({ value: item.id, label: item.name }))} onChange={setSubjectId}/></div><div className="academic-ops-dropdown-field"><GreenfieldDropdown label="Academic level" value={levelId} options={academicOperationLevels.filter(item => item.active).map(item => ({ value: item.id, label: item.name }))} onChange={setLevelId}/></div><div className="academic-ops-dropdown-field"><GreenfieldDropdown label="Class" value={classId} options={attendanceClassOptions.map(item => ({ value: item.id, label: classLabel(item.id) }))} onChange={setClassId}/></div><span className="academic-ops-action-stack"><button type="button" className="academic-ops-secondary" onClick={assignToLevel}>Assign to level</button><button type="button" className="academic-ops-secondary" onClick={assignToClass}>Assign to class</button></span></div>
      <div className="academic-ops-assignment-lists"><div><h3>Level assignments</h3>{levelAssignments.map(row => <AssignmentRow key={row.id} title={subjectName(subjects, row.subjectId)} detail={levelName(row.levelId)} status={row.status} onToggle={() => toggleLevelAssignment(row)}/>)}</div><div><h3>Class assignments</h3>{classAssignments.map(row => <AssignmentRow key={row.id} title={subjectName(subjects, row.subjectId)} detail={classLabel(row.classId)} status={row.status} onToggle={() => toggleClassAssignment(row)}/>)}</div></div>
    </section>
    <section className="academic-ops-panel"><div className="academic-ops-panel-heading"><div><h2>Teacher subject coverage</h2><p>Requires both an active class/session assignment and an active subject link.</p></div></div>
      <div className="academic-ops-fields academic-ops-fields-four"><div className="academic-ops-dropdown-field"><GreenfieldDropdown label="Teacher" value={teacherId} options={academicOperationTeacherMemberships.map(item => ({ value: item.id, label: academicOperationTeacherNames[item.id] ?? 'Unknown teacher' }))} onChange={setTeacherId}/></div><div className="academic-ops-dropdown-field"><GreenfieldDropdown label="Subject" value={subjectId} options={subjects.filter(item => item.active).map(item => ({ value: item.id, label: item.name }))} onChange={setSubjectId}/></div><div className="academic-ops-dropdown-field"><GreenfieldDropdown label="Class" value={classId} options={attendanceClassOptions.map(item => ({ value: item.id, label: classLabel(item.id) }))} onChange={setClassId}/></div><button type="button" className="academic-ops-primary" onClick={assignTeacherToSubject}>Assign teacher</button></div>
      <div className="academic-ops-assignment-list">{teacherAssignments.map(row => <AssignmentRow key={row.id} title={`${academicOperationTeacherNames[row.membershipId]} · ${subjectName(subjects, row.subjectId)}`} detail={`${classLabel(row.classId)} · 2026 / 2027`} status={row.status} onToggle={() => toggleTeacherSubject(row)}/>)}</div>
    </section>
    <p className="academic-ops-feedback" role="status" aria-live="polite">{feedback || 'Preview only. Catalog, assignments, and status changes are not saved.'}</p>
  </section>;
}

function AssignmentRow({ title, detail, status, onToggle }: { title: string; detail: string; status: 'active' | 'inactive'; onToggle: () => void }) {
  return <div className="academic-ops-assignment-row"><span><strong>{title}</strong><small>{detail}</small></span><span className={`academic-ops-status ${status}`}>{status}</span><button type="button" className="academic-ops-text-button" onClick={onToggle}>{status === 'active' ? 'Deactivate' : 'Reactivate'}</button></div>;
}
function subjectName(subjects: readonly Subject[], id: string) { return subjects.find(item => item.id === id)?.name ?? 'Unknown subject'; }
function levelName(id: string) { return academicOperationLevels.find(item => item.id === id)?.name ?? 'Unknown level'; }
function classLabel(id: string) { return attendanceClassOptions.find(item => item.id === id)?.id === 'class-creche-a' ? 'Creche · Green Room' : 'Primary 5 · Cedar'; }
