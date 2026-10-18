'use client';

import { useState } from 'react';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import {
  validateClassAssignment,
} from './class-assignment-validation';
import type {
  EnrollmentClassOption,
  EnrollmentSessionOption,
  StudentEnrollmentRecord,
} from './enrollment-management';
import './students.css';

export type ClassAssignmentSelection = {
  selectedClass: EnrollmentClassOption;
  selectedSession: EnrollmentSessionOption;
};

type ClassAssignmentFormProps = {
  classes: EnrollmentClassOption[];
  sessions: EnrollmentSessionOption[];
  enrollments: StudentEnrollmentRecord[];
  onReview?: (selection: ClassAssignmentSelection) => void;
  initialSelection?: ClassAssignmentSelection | null;
};

export function ClassAssignmentForm({
  classes,
  sessions,
  enrollments,
  onReview,
  initialSelection,
}: ClassAssignmentFormProps) {
  const [sessionId, setSessionId] = useState(initialSelection?.selectedSession.id ?? '');
  const [classId, setClassId] = useState(initialSelection?.selectedClass.id ?? '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function handleValidate() {
    const result = validateClassAssignment(
      { sessionId, classId },
      classes,
      sessions,
      enrollments
    );

    if (!result.valid) {
      setError(result.error);
      setMessage('');
      return;
    }

    setError('');

    const selectedClass = classes.find(item => item.id === classId);
    const selectedSession = sessions.find(item => item.id === sessionId);

    if (onReview && selectedClass && selectedSession) {
      onReview({ selectedClass, selectedSession });
      setMessage('');
      return;
    }

    setMessage(
      'Selection is valid. Saving is unavailable in development preview.'
    );
  }

  return (
    <section
      className="class-assignment-form"
      aria-labelledby="class-assignment-heading"
    >
      <div className="students-section-head">
        <div>
          <h2 id="class-assignment-heading">Assign student to class</h2>
          <p>Select an academic session and class.</p>
        </div>
        <span className="students-chip">Preview only</span>
      </div>

      <div className="class-assignment-fields">
        <GreenfieldDropdown
          label="Academic session"
          value={sessionId}
          options={[
            { value: '', label: 'Select academic session' },
            ...sessions.map(session => ({
              value: session.id,
              label: `${session.label}${session.isCurrent ? ' (Current)' : ''}`,
            })),
          ]}
          onChange={value => {
            setSessionId(value);
            setError('');
            setMessage('');
          }}
        />

        <GreenfieldDropdown
          label="Class"
          value={classId}
          options={[
            { value: '', label: 'Select class' },
            ...classes.map(schoolClass => ({
              value: schoolClass.id,
              label: `${schoolClass.name} - Section ${schoolClass.section}`,
            })),
          ]}
          onChange={value => {
            setClassId(value);
            setError('');
            setMessage('');
          }}
        />
      </div>

      {error && (
        <p className="class-assignment-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="class-assignment-success" role="status">
          {message}
        </p>
      )}

      <div className="class-assignment-actions">
        <button type="button" onClick={handleValidate}>
          Validate selection
        </button>
        <button type="button" disabled>
          Save assignment (unavailable)
        </button>
      </div>
    </section>
  );
}