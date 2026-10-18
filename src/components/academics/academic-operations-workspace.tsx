'use client';

import { useState } from 'react';
import { AttendanceWorkspace } from '@/components/attendance/attendance-workspace';
import { StaffAssignmentsWorkspace } from './staff-assignments-workspace';
import { SubjectCatalogWorkspace } from './subject-catalog-workspace';
import './academic-operations.css';
import '../students/students.css';

type View = 'assignments' | 'subjects' | 'attendance';

export function AcademicOperationsWorkspace() {
  const [view, setView] = useState<View>('assignments');
  return <main className="academic-ops-page">
    <div className="academic-ops-topnote"><span>Greenfield School Management · Academic operations</span><span>Offline preview · fictional data only</span></div>
    <nav className="academic-ops-tabs" aria-label="Academic operations sections">
      <button type="button" className="academic-ops-tab" aria-current={view === 'assignments' ? 'page' : undefined} onClick={() => setView('assignments')}>Teacher assignments</button>
      <button type="button" className="academic-ops-tab" aria-current={view === 'subjects' ? 'page' : undefined} onClick={() => setView('subjects')}>Subjects</button>
      <button type="button" className="academic-ops-tab" aria-current={view === 'attendance' ? 'page' : undefined} onClick={() => setView('attendance')}>Attendance</button>
    </nav>
    {view === 'assignments' ? <StaffAssignmentsWorkspace /> : view === 'subjects' ? <SubjectCatalogWorkspace /> : <AttendanceWorkspace />}
  </main>;
}
