import type { ClassStructure } from './class-structure';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateClassStructure,
  nextAcademicLevel,
// @ts-expect-error Node.js 22 direct type stripping requires .ts extension.
} from './class-structure.ts';

const structure: ClassStructure = {
  schoolId: 'school-1',
  levels: [
    { id: 'n1', name: 'Nursery 1', stage: 'nursery', order: 0, sections: [{ id: 'a', name: 'A' }] },
    { id: 'p1', name: 'Primary 1', stage: 'primary', order: 1, sections: [{ id: 'a', name: 'A' }] },
    { id: 'p5', name: 'Primary 5', stage: 'primary', order: 2, sections: [{ id: 'a', name: 'A' }] },
  ],
  finalLevelId: 'p5',
};

test('valid school-specific structure', () => {
  assert.deepEqual(validateClassStructure(structure), { valid: true });
});

test('resolves next academic level', () => {
  assert.equal(nextAcademicLevel(structure, 'n1')?.id, 'p1');
});

test('final class has no next level', () => {
  assert.equal(nextAcademicLevel(structure, 'p5'), null);
});

test('rejects duplicate names', () => {
  assert.equal(validateClassStructure({
    ...structure,
    levels: [...structure.levels, { ...structure.levels[1], id: 'x', name: 'primary 1' }],
  }).valid, false);
});

test('rejects invalid final class', () => {
  assert.equal(validateClassStructure({
    ...structure,
    finalLevelId: 'missing',
  }).valid, false);
});

test('rejects final class not last', () => {
  assert.equal(validateClassStructure({
    ...structure,
    finalLevelId: 'p1',
  }).valid, false);
});

test('rejects missing school ID', () => {
  assert.equal(validateClassStructure({
    ...structure,
    schoolId: '',
  }).valid, false);
});

test('requires Primary 5 or Primary 6 as the final level', () => {
  assert.equal(validateClassStructure({ ...structure, levels: structure.levels.map(level => level.id === 'p5' ? { ...level, name: 'Primary 4' } : level) }).valid, false);
  assert.equal(validateClassStructure({ ...structure, levels: structure.levels.map(level => level.id === 'p5' ? { ...level, name: 'Primary 6' } : level) }).valid, true);
});

test('sections belong to individual levels and duplicate names are rejected locally', () => {
  const levels = structure.levels.map(level => level.id === 'p1' ? { ...level, sections: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] } : level);
  assert.equal(validateClassStructure({ ...structure, levels }).valid, true);
  assert.equal(validateClassStructure({ ...structure, levels: levels.map(level => level.id === 'p1' ? { ...level, sections: [{ id: 'a', name: 'A' }, { id: 'b', name: 'a' }] } : level) }).valid, false);
  assert.equal(structure.levels.find(level => level.id === 'p5')?.sections.length, 1);
});
