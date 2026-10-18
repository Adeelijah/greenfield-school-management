import test from 'node:test';
import assert from 'node:assert/strict';

// @ts-expect-error Node.js 22 direct type stripping requires .ts extension.
import { validatePromotionEligibility } from './promotion-eligibility.ts';

const progression = [
  {
    className: 'Primary 3 - Section A',
    nextClassName: 'Primary 4 - Section A',
    isFinalClass: false,
  },
  {
    className: 'Primary 4 - Section A',
    nextClassName: 'Primary 5 - Section A',
    isFinalClass: false,
  },
  {
    className: 'Primary 6 - Section A',
    nextClassName: null,
    isFinalClass: true,
  },
];

const student = {
  id: 'ada',
  name: 'Ada Okafor',
  admissionNumber: 'GF/2026/001',
  currentClass: 'Primary 3 - Section A',
  currentSession: '2026/2027',
  destinationEnrolled: false,
  status: 'active' as const,
};

test('valid promotion follows configured progression', () => {
  const result = validatePromotionEligibility(
    student,
    {
      studentId: 'ada',
      action: 'promote',
      destinationClass: 'Primary 4 - Section A',
    },
    '2027/2028',
    progression
  );

  assert.deepEqual(result, { valid: true });
});

test('skipping classes is rejected', () => {
  const result = validatePromotionEligibility(
    student,
    {
      studentId: 'ada',
      action: 'promote',
      destinationClass: 'Primary 5 - Section A',
    },
    '2027/2028',
    progression
  );

  assert.equal(result.valid, false);
});

test('repeat class is allowed', () => {
  const result = validatePromotionEligibility(
    student,
    {
      studentId: 'ada',
      action: 'repeat',
      destinationClass: 'Primary 3 - Section A',
    },
    '2027/2028',
    progression
  );

  assert.deepEqual(result, { valid: true });
});

test('non-final class cannot graduate', () => {
  const result = validatePromotionEligibility(
    student,
    {
      studentId: 'ada',
      action: 'graduate',
      destinationClass: '',
    },
    '2027/2028',
    progression
  );

  assert.equal(result.valid, false);
});

test('final class can graduate', () => {
  const result = validatePromotionEligibility(
    {
      ...student,
      currentClass: 'Primary 6 - Section A',
    },
    {
      studentId: 'ada',
      action: 'graduate',
      destinationClass: '',
    },
    '2027/2028',
    progression
  );

  assert.deepEqual(result, { valid: true });
});

test('past academic sessions are rejected', () => {
  const result = validatePromotionEligibility(
    student,
    {
      studentId: 'ada',
      action: 'promote',
      destinationClass: 'Primary 4 - Section A',
    },
    '2025/2026',
    progression
  );

  assert.equal(result.valid, false);
});

test('duplicate destination enrollment is rejected', () => {
  const result = validatePromotionEligibility(
    { ...student, destinationEnrolled: true },
    {
      studentId: 'ada',
      action: 'promote',
      destinationClass: 'Primary 4 - Section A',
    },
    '2027/2028',
    progression
  );

  assert.equal(result.valid, false);
});