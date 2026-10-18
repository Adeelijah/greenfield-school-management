'use client';

import type {
  EnrollmentClassOption,
  EnrollmentSessionOption,
} from './enrollment-management';

type ClassAssignmentConfirmationProps = {
  studentName: string;
  admissionNumber: string;
  selectedClass: EnrollmentClassOption;
  selectedSession: EnrollmentSessionOption;
  onBack: () => void;
};

export function ClassAssignmentConfirmation({
  studentName,
  admissionNumber,
  selectedClass,
  selectedSession,
  onBack,
}: ClassAssignmentConfirmationProps) {
  return (
    <section
      className="class-assignment-confirmation"
      aria-labelledby="assignment-confirmation-heading"
    >
      <div className="students-section-head">
        <div>
          <h2 id="assignment-confirmation-heading">
            Review class assignment
          </h2>
          <p>Confirm the student and placement details.</p>
        </div>
        <span className="students-chip">Preview only</span>
      </div>

      <dl className="class-assignment-summary">
        <div>
          <dt>Student</dt>
          <dd>{studentName}</dd>
        </div>

        <div>
          <dt>Admission number</dt>
          <dd>{admissionNumber}</dd>
        </div>

        <div>
          <dt>Academic session</dt>
          <dd>{selectedSession.label}</dd>
        </div>

        <div>
          <dt>Class</dt>
          <dd>
            {selectedClass.name} - Section {selectedClass.section}
          </dd>
        </div>
      </dl>

      <p className="class-assignment-confirmation-notice">
        This is a development preview. No enrollment will be created.
      </p>

      <div className="class-assignment-actions">
        <button type="button" onClick={onBack}>
          Back to selection
        </button>

        <button type="button" disabled>
          Confirm assignment (unavailable)
        </button>
      </div>
    </section>
  );
}