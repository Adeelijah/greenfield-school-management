'use client';
import { useState } from 'react';
import './students.css';
import { studentRegistrationSchema } from '@/lib/students/registration';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import { GreenfieldDatePicker } from '@/components/greenfield-date-picker';
import type { ClassStructure } from '../academics/class-structure';
import type { StudentLifecyclePreview } from './student-lifecycle';
import {
  StudentProfile,
  type StudentGuardianPreview,
  type StudentEnrollmentPreview,
  type StudentAcademicHistoryPreview,
} from './student-profile';

type Status = 'all' | 'active' | 'graduated' | 'withdrawn';

export type StudentDirectoryRecord = {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'graduated' | 'withdrawn';
};

export function StudentWorkspace({
  canRegister,
  students = [],
  dataMode = 'disconnected',
  profilePreview = {},
}: {
  canRegister: boolean;
  students?: StudentDirectoryRecord[];
  dataMode?: 'preview' | 'disconnected';
  profilePreview?: Record<string, {
    guardians?: StudentGuardianPreview[];
    enrollment?: StudentEnrollmentPreview;
    academicHistory?: StudentAcademicHistoryPreview[];
    lifecycle?: StudentLifecyclePreview;
    structure?: ClassStructure;
  }>;
}) {
  const [open,setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDirectoryRecord | null>(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof typeof registration, string>>
  >({});

  function validateRegistration() {
    const result = studentRegistrationSchema.safeParse(registration);

    if (result.success) {
      setFieldErrors({});
      setValidationMessage('Details are valid. Registration is not enabled yet.');
      return;
    }

    const errors: Partial<Record<keyof typeof registration, string>> = {};

    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof typeof registration;
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    }

    setFieldErrors(errors);
    setValidationMessage('Please correct the highlighted fields.');
  }
  const [registration, setRegistration] = useState({
    admissionNumber: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
  });

  function updateRegistration(field: keyof typeof registration, value: string) {
    setRegistration(previous => ({
      ...previous,
      [field]: value,
    }));
  }
  const [query,setQuery] = useState('');
  const [status,setStatus] = useState<Status>('all');
  const filteredStudents = students.filter(student => {
    const matchesStatus = status === 'all' || student.status === status;
    const searchText = `${student.first_name} ${student.last_name} ${student.admission_number}`.toLowerCase();
    return matchesStatus && searchText.includes(query.trim().toLowerCase());
  });

  if (selectedStudent) {
    return (
      <StudentProfile
        student={selectedStudent}
        onBack={() => setSelectedStudent(null)}
        guardians={dataMode === 'preview' ? profilePreview[selectedStudent.id]?.guardians : undefined}
        enrollment={dataMode === 'preview' ? profilePreview[selectedStudent.id]?.enrollment : undefined}
        academicHistory={dataMode === 'preview' ? profilePreview[selectedStudent.id]?.academicHistory : undefined}
        structure={dataMode === 'preview' ? profilePreview[selectedStudent.id]?.structure : undefined}
        lifecycle={dataMode === 'preview' ? profilePreview[selectedStudent.id]?.lifecycle : undefined}
      />
    );
  }

  return <div className="students-workspace">
    <div className="page-heading">
      <div><h1>Students</h1><p>Manage pupil records, enrolment and class assignments.</p></div>
      {canRegister && <button type="button" className="primary" aria-expanded={open} aria-controls="student-registration" onClick={()=>setOpen(!open)}>{open?'Close form':'Add student'}</button>}
    </div>
    {canRegister && open && <section className="card" id="student-registration" aria-labelledby="student-form-heading">
      <div className="students-section-head"><div><h2 id="student-form-heading">Register a student</h2><p>Prepare details for when secure registration becomes available.</p></div><button type="button" className="students-link" onClick={()=>setOpen(false)}>Cancel</button></div>
      <div className="students-fields">
        <label>Admission number<input type="text" maxLength={50} autoComplete="off" value={registration.admissionNumber} onChange={e => updateRegistration("admissionNumber", e.target.value)} placeholder="e.g. GF/2026/001"/>{fieldErrors.admissionNumber && <span className="students-field-error" role="alert">{fieldErrors.admissionNumber}</span>}</label>
        <label>First name<input type="text" maxLength={100} autoComplete="given-name" value={registration.firstName} onChange={e => updateRegistration("firstName", e.target.value)}/>{fieldErrors.firstName && <span className="students-field-error" role="alert">{fieldErrors.firstName}</span>}</label>
        <label>Last name<input type="text" maxLength={100} autoComplete="family-name" value={registration.lastName} onChange={e => updateRegistration("lastName", e.target.value)}/>{fieldErrors.lastName && <span className="students-field-error" role="alert">{fieldErrors.lastName}</span>}</label>
        <label>Date of birth (optional)<GreenfieldDatePicker label="Date of birth" value={registration.dateOfBirth} onChange={value => updateRegistration("dateOfBirth", value)}/>{fieldErrors.dateOfBirth && <span className="students-field-error" role="alert">{fieldErrors.dateOfBirth}</span>}</label>
      </div>
      <div className="students-form-foot">
        <p role="status" aria-live="polite">
          {validationMessage || 'Registration is not enabled. No information entered here is saved or submitted.'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="students-link" onClick={validateRegistration}>
            Validate details
          </button>
          <button className="primary" type="button" disabled>
  Save student (unavailable)
</button>
        </div>
      </div>    </section>}
    <section className="card" aria-labelledby="students-directory-heading">
      <div className="students-section-head">
  <div>
    <h2 id="students-directory-heading">Student directory</h2>
    <p>
      {dataMode === 'preview'
        ? 'Browse fictional student records and test directory filters.'
        : 'Records will appear once secure data access is connected.'}
    </p>
  </div>
  <span className="students-chip">
    {dataMode === 'preview' ? 'Preview records' : 'Not connected'}
  </span>
</div>
      <div className="students-toolbar">
        <label className="students-search"><span className="students-visually-hidden">Search students</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name or admission number"/></label>
        <GreenfieldDropdown
  className="students-status-dropdown"
  label="Status"
  value={status}
  onChange={value => setStatus(value as Status)}
  options={[
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'graduated', label: 'Graduated' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ]}
/>
      </div>
      {filteredStudents.length > 0 ? (
        <div className="students-table-wrap">
          <table className="students-table">
            <thead>
              <tr>
                <th>Admission number</th>
                <th>Student name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.id}>
                  <td>{student.admission_number}</td>
                  <td>
                    <button
                      type="button"
                      className="students-link"
                      onClick={() => setSelectedStudent(student)}
                      aria-label={`View profile for ${student.first_name} ${student.last_name}`}
                    >
                      {student.first_name} {student.last_name}
                    </button>
                  </td>
                  <td>{student.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="students-empty">
          <h3>
            {dataMode === 'disconnected'
              ? 'Directory not connected yet'
              : students.length > 0
                ? 'No matching students'
                : 'No preview students'}
          </h3>
          <p>
            {dataMode === 'disconnected'
              ? 'Secure student data access has not been enabled yet.'
              : students.length > 0
                ? 'Try another search or status filter.'
                : 'No fictional student records are available in this preview.'}
          </p>
          {(query || status !== 'all') && (
            <button type="button" className="students-link" onClick={() => { setQuery(''); setStatus('all'); }}>
              Clear filters
            </button>
          )}
        </div>
      )}    </section>
  </div>;
}
