import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node.js 22 direct type stripping requires the .ts extension.
import { validatePromotion } from './promotion-validation.ts';

const student = {
  id: 'ada',
  name: 'Ada Okafor',
  admissionNumber: 'GF/2026/001',
  currentClass: 'Primary 3 - Section A',
  currentSession: '2026/2027',
  destinationEnrolled: false,
  status: 'active' as const,
};

test('promotion validation', () => {
  assert.equal(validatePromotion(student, {
    studentId: 'ada', action: 'promote', destinationClass: 'Primary 4 - Section A',
  }, '2027/2028'), null);

  assert.equal(validatePromotion(student, {
    studentId: 'ada', action: 'repeat', destinationClass: student.currentClass,
  }, '2027/2028'), null);

  assert.equal(validatePromotion(student, {
    studentId: 'ada', action: 'graduate', destinationClass: '',
  }, '2027/2028'), null);

  assert.match(validatePromotion(student, {
    studentId: 'ada', action: 'promote', destinationClass: student.currentClass,
  }, '2027/2028') ?? '', /different destination class/);

  assert.match(validatePromotion({ ...student, destinationEnrolled: true }, {
    studentId: 'ada', action: 'promote', destinationClass: 'Primary 4 - Section A',
  }, '2027/2028') ?? '', /already has an enrollment/);

  assert.match(validatePromotion(student, {
    studentId: 'ada', action: 'promote', destinationClass: 'Primary 4 - Section A',
  }, '2026/2027') ?? '', /must differ/);

  assert.match(validatePromotion({ ...student, status: 'withdrawn' }, {
    studentId: 'ada', action: 'graduate', destinationClass: '',
  }, '2027/2028') ?? '', /Only active students/);
});