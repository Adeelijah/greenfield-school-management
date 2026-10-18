import type { StudentExitKind, StudentExitReason } from './student-exit-validation';
import './student-lifecycle.css';

export type StudentLifecycleDeparture = {
  id: string;
  kind: StudentExitKind;
  reason: StudentExitReason;
  effectiveDate: string;
  destinationSchool?: string;
  guardianRequestConfirmed: boolean;
  notes?: string;
};

export type StudentLifecyclePreview = {
  schoolName: string;
  currentLevel: string;
  nextLevel: string | null;
  finalLevel: string;
  isFinalLevel: boolean;
  departures: StudentLifecycleDeparture[];
};

const reasonLabels: Record<StudentExitReason, string> = {
  parent_request: 'Parent or guardian decision',
  secondary_school: 'Transition to secondary school',
  relocation: 'Relocation',
  other: 'Other',
};

export function StudentLifecycle({ data }: { data: StudentLifecyclePreview }) {
  return (
    <section className="card student-lifecycle" aria-labelledby="student-lifecycle-heading">
      <div className="students-section-head">
        <div>
          <h2 id="student-lifecycle-heading">Academic lifecycle</h2>
          <p>School-specific progression and departure information.</p>
        </div>
        <span className="students-chip">Preview only</span>
      </div>

      <div className="student-lifecycle-grid">
        <div>
          <span>School</span>
          <strong>{data.schoolName}</strong>
        </div>
        <div>
          <span>Current academic level</span>
          <strong>{data.currentLevel}</strong>
        </div>
        <div>
          <span>Next configured level</span>
          <strong>{data.nextLevel ?? 'No next level'}</strong>
        </div>
        <div>
          <span>School&apos;s final level</span>
          <strong>{data.finalLevel}</strong>
        </div>
      </div>

      <div className="student-lifecycle-note">
        {data.isFinalLevel
          ? 'This is the school-configured final level. Standard graduation may be considered after the required academic checks.'
          : 'This student has not reached the school-configured final level. Leaving before that level is handled as a transfer or early exit, not standard graduation.'}
      </div>

      <div className="student-lifecycle-departures">
        <h3>Transfer & early-exit history</h3>
        {data.departures.length === 0 ? (
          <p className="student-lifecycle-muted">
            No departure records supplied for this preview profile.
          </p>
        ) : (
          data.departures.map(record => (
            <article className="student-lifecycle-departure" key={record.id}>
              <div className="student-lifecycle-departure-head">
                <strong>{record.kind === 'transfer' ? 'School transfer' : 'Early exit'}</strong>
                <span>{record.effectiveDate}</span>
              </div>
              <p>Reason: {reasonLabels[record.reason]}</p>
              {record.destinationSchool && (
                <p>Destination: {record.destinationSchool}</p>
              )}
              <p>
                Guardian request reviewed: {record.guardianRequestConfirmed ? 'Yes' : 'No'}
              </p>
              {record.notes && <p>Notes: {record.notes}</p>}
              <small>Preview record only — no student status change applied.</small>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
