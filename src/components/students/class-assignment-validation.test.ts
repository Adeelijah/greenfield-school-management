import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node.js 22 requires the explicit .ts extension for direct test execution.
import { validateClassAssignment } from './class-assignment-validation.ts';

const classes = [
  { id: 'class-1', name: 'Primary 3', section: 'A' },
  { id: 'class-2', name: 'Primary 4', section: 'B' },
];

const sessions = [
  { id: 'session-2026', label: '2026/2027', isCurrent: true },
  { id: 'session-2025', label: '2025/2026', isCurrent: false },
];

const enrollments = [
  {
    id: 'enrollment-1',
    studentId: 'student-1',
    classId: 'class-1',
    sessionId: 'session-2025',
    status: 'graduated' as const,
  },
];

describe('Class Assignment validation', () => {
  it('accepts a valid assignment', () => {
    assert.deepEqual(
      validateClassAssignment(
        { classId: 'class-2', sessionId: 'session-2026' },
        classes,
        sessions,
        enrollments
      ),
      { valid: true }
    );
  });

  it('rejects a missing academic session', () => {
    const result = validateClassAssignment(
      { classId: 'class-1', sessionId: '' },
      classes,
      sessions,
      enrollments
    );

    assert.deepEqual(result, {
      valid: false,
      error: 'Select an academic session.',
    });
  });

  it('rejects an unknown academic session', () => {
    const result = validateClassAssignment(
      { classId: 'class-1', sessionId: 'unknown' },
      classes,
      sessions,
      enrollments
    );

    assert.equal(result.valid, false);
  });

  it('rejects a missing class', () => {
    const result = validateClassAssignment(
      { classId: '', sessionId: 'session-2026' },
      classes,
      sessions,
      enrollments
    );

    assert.deepEqual(result, {
      valid: false,
      error: 'Select a class.',
    });
  });

  it('rejects an unknown class', () => {
    const result = validateClassAssignment(
      { classId: 'unknown', sessionId: 'session-2026' },
      classes,
      sessions,
      enrollments
    );

    assert.equal(result.valid, false);
  });

  it('rejects duplicate enrollment in the same session', () => {
    const result = validateClassAssignment(
      { classId: 'class-2', sessionId: 'session-2025' },
      classes,
      sessions,
      enrollments
    );

    assert.deepEqual(result, {
      valid: false,
      error: 'This student already has an enrollment for the selected academic session.',
    });
  });
});