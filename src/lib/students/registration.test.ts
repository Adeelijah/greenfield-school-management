import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's type-stripping runner requires explicit source extensions.
import { studentRegistrationSchema } from './registration.ts';

const validStudent = {
  admissionNumber: 'GF/2026/001',
  firstName: 'Ada',
  lastName: 'Okafor',
  dateOfBirth: '2018-05-12',
};

describe('student registration validation', () => {
  it('accepts valid student details', () => {
    assert.equal(studentRegistrationSchema.safeParse(validStudent).success, true);
  });

  it('allows an omitted date of birth', () => {
    const student = Object.fromEntries(Object.entries(validStudent).filter(([key]) => key !== 'dateOfBirth'));
    assert.equal(studentRegistrationSchema.safeParse(student).success, true);
  });

  it('trims whitespace around required fields', () => {
    const result = studentRegistrationSchema.parse({
      ...validStudent,
      firstName: '  Ada  ',
    });

    assert.equal(result.firstName, 'Ada');
  });

  it('rejects missing or blank required fields', () => {
    assert.equal(studentRegistrationSchema.safeParse({
      ...validStudent,
      firstName: '   ',
    }).success, false);

    assert.equal(studentRegistrationSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Okafor',
    }).success, false);
  });

  it('rejects values exceeding database field limits', () => {
    assert.equal(studentRegistrationSchema.safeParse({
      ...validStudent,
      admissionNumber: 'A'.repeat(51),
    }).success, false);

    assert.equal(studentRegistrationSchema.safeParse({
      ...validStudent,
      lastName: 'A'.repeat(101),
    }).success, false);
  });

  it('rejects future birth dates', () => {
    assert.equal(studentRegistrationSchema.safeParse({
      ...validStudent,
      dateOfBirth: '2999-01-01',
    }).success, false);
  });

  it('rejects malformed birth dates', () => {
    assert.equal(studentRegistrationSchema.safeParse({
      ...validStudent,
      dateOfBirth: '2018-99-99',
    }).success, false);
  });

  it('rejects client-supplied school IDs and roles', () => {
    assert.equal(studentRegistrationSchema.safeParse({
      ...validStudent,
      schoolId: '11111111-1111-4111-8111-111111111111',
    }).success, false);

    assert.equal(studentRegistrationSchema.safeParse({
      ...validStudent,
      role: 'admin',
    }).success, false);
  });
});
