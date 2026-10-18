import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateStudentExit,
// @ts-expect-error Node.js 22 direct type stripping requires .ts extension.
} from './student-exit-validation.ts';

const student = {
  id: 'ada',
  name: 'Ada Okafor',
  admissionNumber: 'GF/2026/001',
  className: 'Primary 4',
  status: 'active' as const,
};

const draft = {
  studentId: 'ada',
  kind: 'transfer' as const,
  reason: 'secondary_school' as const,
  effectiveDate: '2026-10-10',
  destinationSchool: 'Example Secondary School',
  notes: '',
  guardianRequestConfirmed: true,
};

const today = '2026-10-18';

test('valid school transfer passes', () => {
  assert.deepEqual(
    validateStudentExit(student, draft, [], today),
    { valid: true }
  );
});

test('guardian confirmation is required', () => {
  assert.equal(
    validateStudentExit(
      student,
      { ...draft, guardianRequestConfirmed: false },
      [],
      today
    ).valid,
    false
  );
});

test('future departure is rejected', () => {
  assert.equal(
    validateStudentExit(
      student,
      { ...draft, effectiveDate: '2027-01-01' },
      [],
      today
    ).valid,
    false
  );
});

test('invalid calendar date is rejected', () => {
  assert.equal(
    validateStudentExit(
      student,
      { ...draft, effectiveDate: '2026-02-30' },
      [],
      today
    ).valid,
    false
  );
});

test('transfer requires destination school', () => {
  assert.equal(
    validateStudentExit(
      student,
      { ...draft, destinationSchool: '' },
      [],
      today
    ).valid,
    false
  );
});

test('early exit does not require destination school', () => {
  assert.deepEqual(
    validateStudentExit(
      student,
      { ...draft, kind: 'early_exit', destinationSchool: '' },
      [],
      today
    ),
    { valid: true }
  );
});

test('graduated students cannot be processed', () => {
  assert.equal(
    validateStudentExit(
      { ...student, status: 'graduated' },
      draft,
      [],
      today
    ).valid,
    false
  );
});

test('duplicate departure is rejected', () => {
  const existing = [{
    ...draft,
    id: 'record-1',
    studentName: 'Ada Okafor',
    className: 'Primary 4',
    recordedAt: '2026-10-10',
    state: 'preview' as const,
  }];

  assert.equal(
    validateStudentExit(student, draft, existing, today).valid,
    false
  );
});

test('invalid student selection is rejected', () => {
  assert.equal(
    validateStudentExit(
      undefined,
      { ...draft, studentId: 'missing' },
      [],
      today
    ).valid,
    false
  );
});