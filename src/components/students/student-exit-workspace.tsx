'use client';

import { useState } from 'react';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import {
  validateStudentExit,
  type ExitStudent,
  type StudentExitDraft,
  type StudentExitKind,
  type StudentExitReason,
  type StudentExitRecord,
} from './student-exit-validation';
import './students.css';
import './student-exits.css';

import type { ClassStructure } from '../academics/class-structure';
import { previewStructure, previewPupils, previewDepartures } from './lifecycle-fixtures';

const reasons: { value: StudentExitReason; label: string }[] = [
  { value: 'parent_request', label: 'Parent or guardian decision' },
  { value: 'secondary_school', label: 'Moving to secondary school' },
  { value: 'relocation', label: 'Family relocation' },
  { value: 'other', label: 'Other reason' },
];

const emptyDraft: StudentExitDraft = {
  studentId: '',
  kind: 'transfer',
  reason: 'parent_request',
  effectiveDate: '',
  destinationSchool: '',
  notes: '',
  guardianRequestConfirmed: false,
};

export function StudentExitWorkspace({ structure = previewStructure() }: { structure?: ClassStructure }) {
  const students: ExitStudent[] = previewPupils(structure).map(pupil => ({ ...pupil, className: pupil.currentClass }));
  const history: StudentExitRecord[] = previewDepartures(structure);
  const [draft, setDraft] = useState<StudentExitDraft>(emptyDraft);
  const [reviewing, setReviewing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const student = students.find(item => item.id === draft.studentId);

  // Browser-local date; the server is not used to determine eligibility.
  const today = new Date().toLocaleDateString('en-CA');
  const validation = validateStudentExit(student, draft, history, today);

  function update<K extends keyof StudentExitDraft>(
    key: K,
    value: StudentExitDraft[K]
  ) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setErrors([]);
    setReviewing(false);
  }

  function review() {
    const result = validateStudentExit(student, draft, history, today);

    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    setErrors([]);
    setReviewing(true);
  }

  function reset() {
    setDraft(emptyDraft);
    setErrors([]);
    setReviewing(false);
  }

  return (
    <main className="student-exits-page">
      <header className="student-exits-header">
        <div>
          <span className="student-exits-eyebrow">Student management</span>
          <h1>Transfer &amp; Early Exit</h1>
          <p>
            Record departures before the school&apos;s standard graduation level.
          </p>
        </div>
        <span className="student-exits-tag">Development preview</span>
      </header>

      <div className="student-exits-notice">
        Fictional records only. No student status, enrollment, or academic
        history will be changed. Confirmation is disabled.
      </div>

      {!reviewing ? (
        <section className="student-exits-panel">
          <div className="student-exits-panel-heading">
            <h2>Departure details</h2>
            <p>Complete the student&apos;s departure request for review.</p>
          </div>

          <div className="student-exits-fields">
            <div className="student-exits-field">
              <GreenfieldDropdown
                label="Student"
                value={draft.studentId}
                options={[
                  { value: '', label: 'Select student' },
                  ...students.map(item => ({
                    value: item.id,
                    label: `${item.name} · ${item.className}`,
                  })),
                ]}
                onChange={value => update('studentId', value)}
              />
            </div>

            <div className="student-exits-field">
              <GreenfieldDropdown
                label="Departure type"
                value={draft.kind}
                options={[
                  { value: 'transfer', label: 'School Transfer' },
                  { value: 'early_exit', label: 'Early Exit' },
                ]}
                onChange={value =>
                  update('kind', value as StudentExitKind)
                }
              />
            </div>

            <div className="student-exits-field">
              <GreenfieldDropdown
                label="Reason"
                value={draft.reason}
                options={reasons}
                onChange={value =>
                  update('reason', value as StudentExitReason)
                }
              />
            </div>
            <label className="student-exits-field">
              <span>Effective date</span>
              <input
                type="date"
                value={draft.effectiveDate}
                max={today}
                onChange={event =>
                  update('effectiveDate', event.target.value)
                }
              />
            </label>

            {draft.kind === 'transfer' && (
              <label className="student-exits-field student-exits-wide">
                <span>Destination school</span>
                <input
                  value={draft.destinationSchool}
                  maxLength={180}
                  placeholder="Name of receiving school"
                  onChange={event =>
                    update('destinationSchool', event.target.value)
                  }
                />
              </label>
            )}

            <label className="student-exits-field student-exits-wide">
              <span>Administrative notes (optional)</span>
              <textarea
                value={draft.notes}
                maxLength={1000}
                rows={4}
                placeholder="Relevant context about the departure"
                onChange={event => update('notes', event.target.value)}
              />
            </label>
          </div>

          <label className="student-exits-check">
            <input
              type="checkbox"
              checked={draft.guardianRequestConfirmed}
              onChange={event =>
                update('guardianRequestConfirmed', event.target.checked)
              }
            />
            <span>
              I confirm that the parent or guardian request has been reviewed.
            </span>
          </label>

          {errors.length > 0 && (
            <ul className="student-exits-errors" role="alert">
              {errors.map(error => <li key={error}>{error}</li>)}
            </ul>
          )}

          <div className="student-exits-actions">
            <button type="button" onClick={review}>
              Review departure
            </button>
            <button type="button" className="secondary" onClick={reset}>
              Clear form
            </button>
          </div>
        </section>
      ) : (
        <section className="student-exits-panel">
          <div className="student-exits-panel-heading">
            <h2>Review departure</h2>
            <p>Verify the details before the final administrative action.</p>
          </div>

          <dl className="student-exits-summary">
            <div><dt>Student</dt><dd>{student?.name}</dd></div>
            <div><dt>Admission number</dt><dd>{student?.admissionNumber}</dd></div>
            <div><dt>Current class</dt><dd>{student?.className}</dd></div>
            <div>
              <dt>Departure type</dt>
              <dd>{draft.kind === 'transfer' ? 'School Transfer' : 'Early Exit'}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{reasons.find(item => item.value === draft.reason)?.label}</dd>
            </div>
            <div><dt>Effective date</dt><dd>{draft.effectiveDate}</dd></div>
            {draft.kind === 'transfer' && (
              <div>
                <dt>Destination school</dt>
                <dd>{draft.destinationSchool}</dd>
              </div>
            )}
            <div><dt>Notes</dt><dd>{draft.notes || 'None provided'}</dd></div>
            <div><dt>Guardian request</dt><dd>Reviewed</dd></div>
          </dl>

          <div className="student-exits-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setReviewing(false)}
            >
              Back to edit
            </button>
            <button type="button" disabled>
              Confirm departure (disabled)
            </button>
          </div>
        </section>
      )}

      <section className="student-exits-panel">
        <div className="student-exits-panel-heading">
          <h2>Departure history</h2>
          <p>Illustrative records. No new records are saved in preview mode.</p>
        </div>

        <div className="student-exits-history">
          {history.map(record => (
            <article key={record.id} className="student-exits-history-item">
              <div>
                <strong>{record.studentName}</strong>
                <p>{record.className} · {record.effectiveDate}</p>
              </div>
              <span className="student-exits-tag">
                {record.kind === 'transfer' ? 'Transferred' : 'Early Exit'}
              </span>
            </article>
          ))}
        </div>
      </section>

      {!validation.valid && reviewing && (
        <p role="alert">The departure requires another validation review.</p>
      )}
    </main>
  );
}
