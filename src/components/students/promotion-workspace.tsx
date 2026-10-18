'use client';

import { useState } from 'react';
import type { PromotionAction } from './promotion-validation';
import { GreenfieldDropdown } from '@/components/greenfield-dropdown';
import { nextAcademicLevel, type ClassStructure } from '../academics/class-structure';
import { validateAcademicDecision, type AcademicDecision } from './academic-progression';
import { previewStructure, previewPupils, type PreviewPupil } from './lifecycle-fixtures';
import './students.css';

type PromotionStudent = PreviewPupil;
type PromotionDecision = AcademicDecision;
function suggestedDecision(student: PromotionStudent, structure: ClassStructure): PromotionDecision {
  const action = student.id === 'tunde' ? 'repeat' : student.levelId === structure.finalLevelId ? 'graduate' : 'promote';
  return { studentId: student.id, action, levelId: action === 'repeat' ? student.levelId : action === 'graduate' ? '' : nextAcademicLevel(structure, student.levelId)?.id ?? '', sectionId: '' };
}
type DecisionMap = Record<string, PromotionDecision>;

export function PromotionWorkspace({ structure = previewStructure() }: { structure?: ClassStructure }) {
  const students = previewPupils(structure);
  const [selected, setSelected] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [destinationSession, setDestinationSession] = useState('2027/2028');
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');

  const selectedStudents = students.filter(student => selected.includes(student.id));

  function decisionFor(student: PromotionStudent): PromotionDecision {
    return decisions[student.id] ?? suggestedDecision(student, structure);
  }

  function updateDecision(student: PromotionStudent, action: PromotionAction, sectionId = '') {
    const levelId = action === 'graduate' ? '' : action === 'repeat' ? student.levelId : nextAcademicLevel(structure, student.levelId)?.id ?? '';
    setDecisions(previous => ({ ...previous, [student.id]: { studentId: student.id, action, levelId, sectionId } }));
    setReview(false);
    setError(action !== decisionFor(student).action ? 'Decision changed. Choose a destination section again for promotion or repetition.' : '');
  }

  function reviewSelection() {
    if (selectedStudents.length === 0) {
      setError('Select at least one student.');
      return;
    }
    for (const student of selectedStudents) {
      const message = validateAcademicDecision(structure, student, decisionFor(student), destinationSession);
      if (message) {
        setError(`${student.name}: ${message}`);
        return;
      }
    }
    setError('');
    setReview(true);
  }

  return (
    <main className="promotion-workspace">
      <div className="page-heading">
        <div>
          <h1>Student promotions</h1>
          <p>Prepare next-session placements, repeats and graduations.</p>
        </div>
        <span className="students-chip">Development preview</span>
      </div>

      <div className="promotion-notice">
        Fictional students only. No promotion, graduation or enrollment will be saved.
      </div>

      <section className="card">
        <div className="students-section-head">
          <div>
            <h2>Destination session</h2>
            <p>Choose the session receiving the new placements.</p>
          </div>
        </div>
        <div className="promotion-session">
          <GreenfieldDropdown
            label="Academic session"
            value={destinationSession}
            options={[
              { value: '2027/2028', label: '2027/2028' },
              { value: '2026/2027', label: '2026/2027 (Current)' },
            ]}
            onChange={value => {
              setDestinationSession(value);
              setReview(false);
              setError('');
            }}
          />
        </div>
      </section>

      {!review ? (
        <section className="card">
          <div className="students-section-head">
            <div>
              <h2>Select students</h2>
              <p>{selected.length} of {students.length} selected</p>
            </div>
            <button
              type="button"
              className="students-link"
              onClick={() => {
                setSelected(selected.length === students.length ? [] : students.map(student => student.id));
                setError('');
              }}
            >
              {selected.length === students.length ? 'Clear selection' : 'Select all'}
            </button>
          </div>

          <div className="promotion-list">
            {students.map(student => {
              const decision = decisionFor(student);
              const checked = selected.includes(student.id);

              return (
                <article className="promotion-item" key={student.id}>
                  <label className="promotion-student">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={event => {
                        setSelected(previous => event.target.checked
                          ? [...previous, student.id]
                          : previous.filter(id => id !== student.id));
                        setError('');
                      }}
                    />
                    <span>
                      <strong>{student.name}</strong>
                      <small>{student.admissionNumber} | {student.currentClass}</small>
                    </span>
                  </label>

                  {checked && (
                    <div className="promotion-controls">
                      <GreenfieldDropdown
                        label="Decision"
                        value={decision.action}
                        options={[
                          { value: 'promote', label: 'Promote' },
                          { value: 'repeat', label: 'Repeat class' },
                          { value: 'graduate', label: 'Graduate (final Primary level only)' },
                        ]}
                        onChange={value => updateDecision(student, value as PromotionAction)}
                      />
                      {decision.action !== 'graduate' && (
                        <>
                          <p>Destination level: <strong>{structure.levels.find(level => level.id === decision.levelId)?.name ?? 'No next level configured'}</strong></p>
                          <GreenfieldDropdown
                            label="Destination section"
                            value={decision.sectionId}
                            options={[
                              { value: '', label: 'Select section' },
                              ...(structure.levels.find(level => level.id === decision.levelId)?.sections ?? []).map(section => ({ value: section.id, label: `Section ${section.name}` })),
                            ]}
                            onChange={value => updateDecision(student, decision.action, value)}
                          />
                        </>
                      )}
                    </div>
                  )}
                  {student.enrolledSessions.includes(destinationSession) && (
                    <small className="promotion-warning">Existing destination enrollment - cannot process</small>
                  )}
                </article>
              );
            })}
          </div>
          {error && <p className="class-assignment-error" role="alert">{error}</p>}
          <div className="class-assignment-actions">
            <button type="button" onClick={reviewSelection}>Review selections</button>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="students-section-head">
            <div>
              <h2>Review promotions</h2>
              <p>{selectedStudents.length} students | Destination: {destinationSession}</p>
            </div>
            <span className="students-chip">Preview only</span>
          </div>
          <div className="promotion-list">
            {selectedStudents.map(student => {
              const decision = decisionFor(student);
              return (
                <article className="promotion-item" key={student.id}>
                  <strong>{student.name}</strong>
                  <p>{student.currentClass} to {decision.action === 'graduate' ? 'Graduation' : `${structure.levels.find(level => level.id === decision.levelId)?.name} - Section ${decision.sectionId.toUpperCase()}`}</p>
                  <small>{decision.action === 'repeat' ? 'Repeat class' : decision.action === 'promote' ? 'Promotion' : 'Graduation'}</small>
                </article>
              );
            })}
          </div>
          <p className="class-assignment-confirmation-notice">
            Review only. Changes have not been saved.
          </p>
          <div className="class-assignment-actions">
            <button type="button" onClick={() => setReview(false)}>Back to selection</button>
            <button type="button" disabled>Confirm promotions (unavailable)</button>
          </div>
        </section>
      )}
    </main>
  );
}