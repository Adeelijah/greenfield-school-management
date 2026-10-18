'use client';

import { useState } from 'react';
import {
  validateClassStructure,
  type AcademicLevel,
  type ClassStructure,
} from './class-structure';
import './class-structure.css';

import { GreenfieldDropdown } from '../greenfield-dropdown';
import { previewStructure } from '../students/lifecycle-fixtures';
import '../students/students.css';

export function ClassStructureEditor({ initial = previewStructure(), onApply }: { initial?: ClassStructure; onApply?: (structure: ClassStructure) => void }) {
  const [structure, setStructure] = useState<ClassStructure>(initial);
  const [newStage, setNewStage] = useState<AcademicLevel['stage']>('primary');
  const [newName, setNewName] = useState('');
  const [feedback, setFeedback] = useState('');

  const validation = validateClassStructure(structure);

  function updateLevels(levels: readonly AcademicLevel[]) {
    setStructure(previous => ({
      ...previous,
      levels: levels.map((level, order) => ({ ...level, order })),
    }));
    setFeedback('Progression changed. Review the final Primary level selection.');
  }

  function addLevel() {
    const name = newName.trim();
    if (!name) return;

    const level: AcademicLevel = {
      id: crypto.randomUUID(),
      name,
      stage: newStage,
      order: structure.levels.length,
      sections: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    };

    const stageOrder = { creche: 0, nursery: 1, primary: 2 };
    const insertion = structure.levels.findIndex(existing => stageOrder[existing.stage] > stageOrder[newStage]);
    const levels = [...structure.levels];
    levels.splice(insertion < 0 ? levels.length : insertion, 0, level);
    updateLevels(levels);
    setNewName('');
  }

  function renameLevel(id: string, name: string) {
    setStructure(previous => ({
      ...previous,
      levels: previous.levels.map(level =>
        level.id === id ? { ...level, name } : level
      ),
    }));
    setFeedback('');
  }

  function updateSections(id: string, sections: AcademicLevel['sections']) {
    setStructure(previous => ({ ...previous, levels: previous.levels.map(level =>
      level.id === id ? { ...level, sections } : level
    ) }));
    setFeedback('');
  }

  function addSection(level: AcademicLevel) {
    const used = new Set(level.sections.map(section => section.name.trim().toLowerCase()));
    let index = 0;
    while (used.has(index < 26 ? String.fromCharCode(65 + index).toLowerCase() : `section ${index + 1}`)) index++;
    const name = index < 26 ? String.fromCharCode(65 + index) : `Section ${index + 1}`;
    updateSections(level.id, [...level.sections, { id: crypto.randomUUID(), name }]);
  }

  function moveLevel(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= structure.levels.length) return;

    const levels = [...structure.levels];
    [levels[index], levels[destination]] =
      [levels[destination], levels[index]];

    updateLevels(levels);
  }

  function removeLevel(id: string) {
    updateLevels(structure.levels.filter(level => level.id !== id));
  }

  function review() {
    const result = validateClassStructure(structure);

    setFeedback(
      result.valid
        ? 'Configuration is valid. Saving is disabled in development preview.'
        : 'Please correct the configuration errors.'
    );
  }

  return (
    <main className="class-structure-page">
      <header className="class-structure-header">
        <div>
          <span className="class-structure-eyebrow">Academic settings</span>
          <h1>Class structure</h1>
          <p>
            Configure the academic levels your school offers and the order
            students progress through them.
          </p>
        </div>
        <span className="class-structure-pill">Development preview</span>
      </header>

      <div className="class-structure-notice">
        This is a fictional school configuration. Changes are temporary and
        will reset when the page reloads.
      </div>

      <section className="class-structure-panel">
        <div className="class-structure-section-head">
          <div>
            <h2>Academic progression</h2>
            <p>Arrange levels from the earliest to the final class.</p>
          </div>
          <span className="class-structure-count">
            {structure.levels.length} levels
          </span>
        </div>

        <div className="class-structure-list">
          {structure.levels.map((level, index) => (
            <div className="class-structure-item" key={level.id}>
              <span className="class-structure-order">{index + 1}</span>

              <div className="class-structure-name">
                <label htmlFor={`level-${level.id}`}>
                  Academic level
                </label>
                <input
                  id={`level-${level.id}`}
                  value={level.name}
                  maxLength={80}
                  onChange={event =>
                    renameLevel(level.id, event.target.value)
                  }
                />
              </div>

              <div className="class-structure-sections">
                <span>Sections for {level.name}</span>
                {level.sections.map(section => (
                  <div className="class-structure-section-row" key={section.id}>
                    <input aria-label={`Section name in ${level.name}`} value={section.name} maxLength={80} onChange={event => updateSections(level.id, level.sections.map(item => item.id === section.id ? { ...item, name: event.target.value } : item))} />
                    <button type="button" aria-label={`Remove section ${section.name} from ${level.name}`} onClick={() => updateSections(level.id, level.sections.filter(item => item.id !== section.id))}>Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => addSection(level)}>Add section</button>
              </div>

              {structure.finalLevelId === level.id && (
                <span className="class-structure-final">Final class</span>
              )}

              <div className="class-structure-row-actions">
                <button
                  type="button"
                  aria-label={`Move ${level.name} up`}
                  disabled={index === 0}
                  onClick={() => moveLevel(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${level.name} down`}
                  disabled={index === structure.levels.length - 1}
                  onClick={() => moveLevel(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${level.name}`}
                  className="class-structure-remove"
                  onClick={() => removeLevel(level.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="class-structure-add">
          <GreenfieldDropdown label="Stage for new level" value={newStage} options={[{ value: 'creche', label: 'Creche' }, { value: 'nursery', label: 'Nursery' }, { value: 'primary', label: 'Primary' }]} onChange={value => setNewStage(value as AcademicLevel['stage'])} />
          <div>
            <label htmlFor="new-academic-level">Add academic level</label>
            <input
              id="new-academic-level"
              placeholder="e.g. Primary 6"
              value={newName}
              maxLength={80}
              onChange={event => setNewName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') addLevel();
              }}
            />
          </div>
          <button type="button" onClick={addLevel} disabled={!newName.trim()}>
            Add level
          </button>
        </div>
      </section>

      <section className="class-structure-panel">
        <div className="class-structure-section-head">
          <div>
            <h2>Graduation settings</h2>
            <p>
              Standard graduation is available only after completing
              the final academic level.
            </p>
          </div>
        </div>

        <div className="class-structure-setting">
          <GreenfieldDropdown
            label="Final academic level"
            value={structure.finalLevelId}
            options={[{ value: '', label: 'Select final Primary level' }, ...structure.levels.filter(level => level.stage === 'primary' && /^Primary [56]$/i.test(level.name.trim())).map(level => ({ value: level.id, label: level.name }))]}
            onChange={finalLevelId => { setStructure(previous => ({ ...previous, finalLevelId })); setFeedback('Final level changed. It must be last in the progression.'); }}
          />
          <p>
            The final Primary level must be last in the progression. Reorder or remove later levels explicitly.
            Students leaving earlier use School Transfer / Early Exit.
          </p>
        </div>
      </section>

      <section className="class-structure-panel">
        <div className="class-structure-section-head">
          <div>
            <h2>Configuration review</h2>
            <p>Validate the structure before it can eventually be saved.</p>
          </div>
        </div>

        {!validation.valid && (
          <ul className="class-structure-errors" role="alert">
            {validation.errors.map(error => <li key={error}>{error}</li>)}
          </ul>
        )}

        <div className="class-structure-footer">
          <button type="button" onClick={review}>
            Validate configuration
          </button>
          {onApply && <button type="button" disabled={!validation.valid} onClick={() => { if (validateClassStructure(structure).valid) { onApply(structure); setFeedback('Configuration applied to this preview session only. Nothing was saved.'); } }}>Use configuration in this preview</button>}
          <button type="button" disabled>
            Save school settings (unavailable)
          </button>
        </div>

        {feedback && (
          <p className="class-structure-feedback" role="status">
            {feedback}
          </p>
        )}
      </section>
    </main>
  );
}
