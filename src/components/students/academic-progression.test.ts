import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-expect-error Node 22 direct type stripping.
import { validateAcademicDecision } from './academic-progression.ts';
// @ts-expect-error Node 22 direct type stripping.
import { previewStructure, previewPupils, profilePreviewFor, previewDepartures } from './lifecycle-fixtures.ts';
// @ts-expect-error Node 22 direct type stripping.
import { validateClassStructure, nextAcademicLevel } from '../academics/class-structure.ts';
// @ts-expect-error Node 22 direct type stripping.
import { validateStudentExit } from './student-exit-validation.ts';

for (const final of [5, 6] as const) {
  const structure = previewStructure(final);
  const pupils = previewPupils(structure);
  const ada = pupils[0];
  const decision = { studentId: ada.id, action: 'promote' as const, levelId: 'primary-4', sectionId: 'b' };
  test(`Primary ${final} school supports stages, next level and independent sections`, () => {
    assert.equal(validateClassStructure(structure).valid, true);
    assert.equal(nextAcademicLevel(structure, 'creche')?.id, 'nursery-1');
    assert.equal(nextAcademicLevel(structure, 'primary-3')?.id, 'primary-4');
    assert.equal(validateAcademicDecision(structure, ada, decision, '2027/2028'), null);
    assert.equal(validateAcademicDecision(structure, ada, { ...decision, sectionId: 'a' }, '2027/2028'), null);
    assert.match(validateAcademicDecision(structure, ada, { ...decision, sectionId: 'unknown' }, '2027/2028')!, /section/);
    assert.match(validateAcademicDecision(structure, ada, { ...decision, levelId: 'primary-5' }, '2027/2028')!, /Primary 4/);
  });
  test(`Primary ${final} graduation is restricted to configured final level`, () => {
    const graduate = { studentId: pupils[2].id, action: 'graduate' as const, levelId: '', sectionId: '' };
    assert.equal(validateAcademicDecision(structure, pupils[2], graduate, '2027/2028'), null);
    assert.match(validateAcademicDecision(structure, ada, { ...graduate, studentId: ada.id }, '2027/2028')!, /final Primary/);
    assert.match(validateAcademicDecision(structure, pupils[2], { ...graduate, sectionId: 'a' }, '2027/2028')!, /must not assign/);
  });
  test(`Primary ${final} repeat, sessions, status, tenant and duplicate guards`, () => {
    assert.equal(validateAcademicDecision(structure, ada, { ...decision, action: 'repeat', levelId: ada.levelId, sectionId: 'a' }, '2027/2028'), null);
    for (const session of ['2026/2027', '2025/2026', '2027/2029', '', 'bad']) assert.ok(validateAcademicDecision(structure, ada, decision, session));
    assert.match(validateAcademicDecision(structure, { ...ada, status: 'withdrawn' }, decision, '2027/2028')!, /active/);
    assert.match(validateAcademicDecision(structure, { ...ada, schoolId: 'another-school' }, decision, '2027/2028')!, /school/);
    assert.match(validateAcademicDecision(structure, { ...ada, enrolledSessions: ['2027/2028'] }, decision, '2027/2028')!, /already/);
    assert.equal(validateAcademicDecision(structure, { ...ada, enrolledSessions: ['2027/2028'] }, decision, '2028/2029'), null);
  });
  test(`Primary ${final} profiles and departures agree with shared fixtures`, () => {
    for (const pupil of pupils) {
      const profile = profilePreviewFor(structure, pupil);
      assert.equal(profile.enrollment?.status, pupil.status);
      assert.equal(profile.lifecycle.isFinalLevel, pupil.levelId === structure.finalLevelId);
      assert.equal(profile.lifecycle.departures.length, pupil.status === 'withdrawn' ? 1 : 0);
      assert.equal(profile.lifecycle.currentLevel, profile.enrollment?.className);
    }
    const former = pupils[4];
    const record = previewDepartures(structure)[0];
    assert.equal(validateStudentExit({ ...former, className: former.currentClass }, record, previewDepartures(structure), '2026-10-18').valid, false);
    assert.throws(() => profilePreviewFor(structure, { ...ada, schoolId: 'foreign' }), /mismatch/);
    assert.equal(profilePreviewFor(structure, { ...ada, levelId: 'missing' }).enrollment, undefined);
    assert.equal(profilePreviewFor(structure, pupils[1]).academicHistory[1].status, 'completed');
    const planned = profilePreviewFor(structure, pupils[3]).academicHistory[1];
    assert.equal(planned.status, 'planned');
    assert.equal(planned.section, structure.levels.find(level => level.id === planned.levelId)?.sections.find(section => section.id === planned.sectionId)?.name);
  });
}

test('invalid structures fail closed', () => {
  const structure = previewStructure();
  for (const invalid of [
    { ...structure, levels: [] },
    { ...structure, schoolId: '' },
    { ...structure, finalLevelId: 'nursery-2' },
    { ...structure, levels: structure.levels.map(level => ({ ...level, id: 'duplicate' })) },
    { ...structure, levels: structure.levels.map(level => ({ ...level, name: 'duplicate' })) },
    { ...structure, levels: structure.levels.map(level => ({ ...level, order: 0 })) },
    { ...structure, levels: structure.levels.map(level => ({ ...level, sections: [] })) },
    { ...structure, levels: [{ ...structure.levels[0], stage: 'primary' as const }, ...structure.levels.slice(1)] },
  ]) assert.equal(validateClassStructure(invalid).valid, false);
});

test('fixture structures are isolated and immutable', () => {
  assert.notEqual(previewStructure(), previewStructure());
  assert.equal(Object.isFrozen(previewStructure().levels), true);
});

test('all preview entry points retain development-only guards and disabled confirmations', () => {
  for (const route of ['students', 'promotions', 'student-exits', 'class-structure']) {
    const source = readFileSync(`src/app/dev-preview/${route}/page.tsx`, 'utf8');
    assert.match(source, /process.env.NODE_ENV !== 'development'\) notFound\(\)/);
  }
  for (const file of ['promotion-workspace.tsx', 'student-exit-workspace.tsx']) {
    const source = readFileSync(`src/components/students/${file}`, 'utf8');
    assert.match(source, /disabled>\s*Confirm/);
    assert.doesNotMatch(source, /fetch\(|supabase|use server/);
  }
});
