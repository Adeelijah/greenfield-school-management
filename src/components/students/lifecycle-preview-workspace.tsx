'use client';

import { useState } from 'react';
import { GreenfieldDropdown } from '../greenfield-dropdown';
import type { ClassStructure } from '../academics/class-structure';
import { ClassStructureEditor } from '../academics/class-structure-editor';
import { StudentWorkspace } from './student-workspace';
import { PromotionWorkspace } from './promotion-workspace';
import { StudentExitWorkspace } from './student-exit-workspace';
import { previewStructure, previewPupils, profilePreviewFor } from './lifecycle-fixtures';
import './students.css';

export function LifecyclePreviewWorkspace() {
  const [finalLevel, setFinalLevel] = useState<5 | 6>(5);
  const [view, setView] = useState('students');
  const [configurations, setConfigurations] = useState<Record<string, ClassStructure>>({});
  const structure = configurations[String(finalLevel)] ?? previewStructure(finalLevel);
  const pupils = previewPupils(structure);
  return <>
    <section className="card lifecycle-preview-toolbar" aria-label="Fictional preview settings">
      <p>Development preview only. Fictional school records; all save and confirmation actions are disabled. Switching schools clears temporary selections.</p>
      <div className="promotion-controls">
        <GreenfieldDropdown label="Fictional school" value={String(finalLevel)} options={[{ value: '5', label: 'School A — Primary 5 final' }, { value: '6', label: 'School B — Primary 6 final' }]} onChange={value => setFinalLevel(value === '6' ? 6 : 5)} />
        <GreenfieldDropdown label="Preview workflow" value={view} options={[{ value: 'students', label: 'Student directory and profiles' }, { value: 'promotions', label: 'Promotions, repeats and graduation' }, { value: 'exits', label: 'Transfers and early exits' }, { value: 'structure', label: 'Class structure settings' }]} onChange={setView} />
      </div>
    </section>
    <div key={`${structure.schoolId}:${view}`}>
      {view === 'students' && <StudentWorkspace canRegister dataMode="preview" students={pupils.map(pupil => ({ id: pupil.id, admission_number: pupil.admissionNumber, first_name: pupil.name.split(' ')[0], last_name: pupil.name.split(' ').slice(1).join(' '), status: pupil.status }))} profilePreview={Object.fromEntries(pupils.map(pupil => [pupil.id, profilePreviewFor(structure, pupil)]))} />}
      {view === 'promotions' && <PromotionWorkspace structure={structure} />}
      {view === 'exits' && <StudentExitWorkspace structure={structure} />}
      {view === 'structure' && <ClassStructureEditor initial={structure} onApply={updated => setConfigurations(previous => ({ ...previous, [String(finalLevel)]: updated }))} />}
    </div>
  </>;
}
