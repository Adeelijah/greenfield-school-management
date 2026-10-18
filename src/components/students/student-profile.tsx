'use client';

import type { ClassStructure } from '../academics/class-structure';
import type { StudentDirectoryRecord } from './student-workspace';
import { useState } from 'react';
import { profileEnrollments } from './profile-enrollments';
import { EnrollmentManagement } from './enrollment-management';
import { StudentLifecycle, type StudentLifecyclePreview } from './student-lifecycle';
import './students.css';

export type StudentGuardianPreview = {
  id: string;
  fullName: string;
  relationship: string;
  isPrimary: boolean;
  phone?: string | null;
  email?: string | null;
};

export type StudentEnrollmentPreview = {
  levelId?: string;
  sectionId?: string;
  className: string;
  section: string;
  academicSession: string;
  status: 'active' | 'graduated' | 'withdrawn' | 'completed' | 'planned';
};

export type StudentAcademicHistoryPreview = {
  levelId?: string;
  sectionId?: string;
  id: string;
  className: string;
  section: string;
  academicSession: string;
  status: 'active' | 'graduated' | 'withdrawn' | 'completed' | 'planned';
};

type StudentProfileProps = {
  student: StudentDirectoryRecord;
  onBack: () => void;
  guardians?: StudentGuardianPreview[];
  enrollment?: StudentEnrollmentPreview | null;
  academicHistory?: StudentAcademicHistoryPreview[];
  lifecycle?: StudentLifecyclePreview;
  structure?: ClassStructure;
};

export function StudentProfile({ student, onBack, guardians = [], enrollment = null, academicHistory = [], lifecycle, structure }: StudentProfileProps) {
  const [showEnrollmentManagement, setShowEnrollmentManagement] = useState(false);
  const fullName = `${student.first_name} ${student.last_name}`;
  const initials = `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="students-workspace">
      <div className="page-heading">
        <div>
          <button
            type="button"
            className="students-link student-profile-back"
            onClick={onBack}
          >
            {"\u2190"} Back to students
          </button>
          <div className="student-profile-identity">
            <div className="student-profile-avatar" aria-hidden="true">
              {initials}
            </div>
            <div>
              <h1>{fullName}</h1>
              <p>Student profile | {student.admission_number}</p>
            </div>
          </div>
        </div>
        <span className="students-chip">Preview profile</span>
      </div>

      <section className="card" aria-labelledby="student-profile-heading">
        <div className="students-section-head">
          <div>
            <h2 id="student-profile-heading">Personal information</h2>
            <p>Student details available in this development preview.</p>
          </div>
        </div>

        <dl className="student-profile-grid">
          <div className="student-profile-field">
            <dt>Full name</dt>
            <dd>{fullName}</dd>
          </div>
          <div className="student-profile-field">
            <dt>Admission number</dt>
            <dd>{student.admission_number}</dd>
          </div>
          <div className="student-profile-field">
            <dt>Student status</dt>
            <dd>
              <span
                className="student-profile-status"
                data-status={student.status}
              >
                {student.status}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="student-enrollment-heading">
        <div className="students-section-head">
          <div>
            <h2 id="student-enrollment-heading">Current enrollment</h2>
            <p>Class placement and academic session information.</p>
          </div>
        </div>

        {enrollment ? (
          <dl className="student-profile-grid">
            <div className="student-profile-field">
              <dt>Class</dt>
              <dd>{enrollment.className}</dd>
            </div>
            <div className="student-profile-field">
              <dt>Section</dt>
              <dd>{enrollment.section}</dd>
            </div>
            <div className="student-profile-field">
              <dt>Academic session</dt>
              <dd>{enrollment.academicSession}</dd>
            </div>
            <div className="student-profile-field">
              <dt>Enrollment status</dt>
              <dd>
                <span
                  className="student-profile-status"
                  data-status={enrollment.status}
                >
                  {enrollment.status}
                </span>
              </dd>
            </div>
          </dl>
        ) : (
          <div className="students-empty">
            <h3>No enrollment information available</h3>
            <p>Class and session details have not been supplied for this profile.</p>
          </div>
        )}
      </section>

            <div className="student-enrollment-action">
        <button
          type="button"
          className="student-enrollment-action-button"
          onClick={() => setShowEnrollmentManagement(value => !value)}
          aria-expanded={showEnrollmentManagement}
          aria-controls="student-enrollment-management-panel"
        >
          {showEnrollmentManagement ? 'Hide enrollments' : 'View enrollments'}
        </button>
      </div>

      {showEnrollmentManagement && (
        <div id="student-enrollment-management-panel">
          <EnrollmentManagement
            studentName={fullName}
            admissionNumber={student.admission_number}
            {...profileEnrollments(student.id, enrollment, academicHistory, structure)}
          />
        </div>
      )}
      {lifecycle ? <StudentLifecycle data={lifecycle} /> : <section className="card students-empty"><h2>Academic lifecycle</h2><p>No progression or departure information supplied.</p></section>}

      <section className="card" aria-labelledby="student-history-heading">
        <div className="students-section-head">
          <div>
            <h2 id="student-history-heading">Academic history</h2>
            <p>Academic placements by session, including completed years and planned enrollments.</p>
          </div>
          <span className="students-chip">
            {academicHistory.length} {academicHistory.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {academicHistory.length > 0 ? (
          <div className="student-history-list">
            {academicHistory.map(record => (
              <div className="student-history-item" key={record.id}>
                <div className="student-history-content">
                  <strong>{record.academicSession}</strong>
                  <p>{record.className} - Section {record.section}</p>
                </div>
                <span
                  className="student-profile-status"
                  data-status={record.status}
                >
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="students-empty">
            <h3>No academic history available</h3>
            <p>Previous class and session records have not been supplied for this profile.</p>
          </div>
        )}
      </section>
      <section className="card" aria-labelledby="student-guardians-heading">
        <div className="students-section-head">
          <div>
            <h2 id="student-guardians-heading">Guardians</h2>
            <p>Parent and guardian relationships and contact details.</p>
          </div>
        </div>

        {guardians.length > 0 ? (
          <div className="student-profile-guardians">
            {guardians.map(guardian => (
              <div className="student-profile-field" key={guardian.id}>
                <div className="student-profile-guardian-heading">
                  <strong>{guardian.fullName}</strong>
                  {guardian.isPrimary && (
                    <span className="students-chip">Primary guardian</span>
                  )}
                </div>
                <dl className="student-profile-grid">
                  <div>
                    <dt>Relationship</dt>
                    <dd>{guardian.relationship}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{guardian.phone || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{guardian.email || 'Not provided'}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <div className="students-empty">
            <h3>No guardian information available</h3>
            <p>Guardian relationships have not been supplied for this profile.</p>
          </div>
        )}
      </section>
    </div>
  );
}
