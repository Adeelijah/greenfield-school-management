'use client';

import { useState } from 'react';
import { ClassAssignmentForm } from './class-assignment-form';
import type { ClassAssignmentSelection } from './class-assignment-form';
import { ClassAssignmentConfirmation } from './class-assignment-confirmation';

export type EnrollmentStatus = 'active' | 'graduated' | 'withdrawn' | 'completed' | 'planned';

export type EnrollmentClassOption = {
  id: string;
  name: string;
  section: string;
};

export type EnrollmentSessionOption = {
  id: string;
  label: string;
  isCurrent: boolean;
};

export type StudentEnrollmentRecord = {
  id: string;
  studentId: string;
  classId: string;
  sessionId: string;
  status: EnrollmentStatus;
};

export type EnrollmentManagementProps = {
  studentName: string;
  admissionNumber: string;
  classes: EnrollmentClassOption[];
  sessions: EnrollmentSessionOption[];
  enrollments: StudentEnrollmentRecord[];
};

export function EnrollmentManagement({
  studentName,
  admissionNumber,
  classes,
  sessions,
  enrollments,
}: EnrollmentManagementProps) {
  const [reviewSelection, setReviewSelection] = useState<ClassAssignmentSelection | null>(null);
  const sessionById = new Map(sessions.map(session => [session.id, session]));
  const classById = new Map(classes.map(schoolClass => [schoolClass.id, schoolClass]));

  const rows = enrollments
    .map(enrollment => ({
      ...enrollment,
      session: sessionById.get(enrollment.sessionId),
      schoolClass: classById.get(enrollment.classId),
    }))
    .sort((a, b) =>
      (b.session?.label ?? '').localeCompare(a.session?.label ?? '')
    );

  return (
    <section className="enrollment-management" aria-labelledby="enrollment-management-heading">
      <div className="students-section-head">
        <div>
          <h2 id="enrollment-management-heading">Enrollment management</h2>
          <p>Class assignments and academic session records.</p>
        </div>
        <span className="students-chip">
          {rows.length} {rows.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      <p className="enrollment-management-student">
        {studentName} | {admissionNumber}
      </p>

      {rows.length === 0 ? (
        <div className="students-empty">
          <h3>No enrollment records</h3>
          <p>No class assignments have been supplied for this student.</p>
        </div>
      ) : (
        <div className="enrollment-management-list">
          {rows.map(row => (
            <article className="enrollment-management-item" key={row.id}>
              <div>
                <strong>{row.session?.label ?? 'Unknown session'}</strong>
                <p>
                  {row.schoolClass
                    ? `${row.schoolClass.name} - Section ${row.schoolClass.section}`
                    : 'Class information unavailable'}
                </p>
                {row.session?.isCurrent && (
                  <small>Current academic session</small>
                )}
              </div>
              <span
                className="student-profile-status"
                data-status={row.status}
              >
                {row.status}
              </span>
            </article>
          ))}
        </div>
      )}
      <div className="enrollment-assignment-section">
        <div hidden={reviewSelection !== null}>
          <ClassAssignmentForm
            key={admissionNumber}
            classes={classes}
            sessions={sessions}
            enrollments={enrollments}
            onReview={setReviewSelection}
          />
        </div>

        {reviewSelection && (
          <ClassAssignmentConfirmation
            studentName={studentName}
            admissionNumber={admissionNumber}
            selectedClass={reviewSelection.selectedClass}
            selectedSession={reviewSelection.selectedSession}
            onBack={() => setReviewSelection(null)}
          />
        )}
      </div>    </section>
  );
}
