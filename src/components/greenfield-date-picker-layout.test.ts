import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error Node's type-strip runner loads this TypeScript source directly.
import { getDatePickerPosition } from './greenfield-date-picker-layout.ts';

for (const width of [320, 375, 390]) {
  test(`date picker stays within a ${width}px viewport`, () => {
    const position = getDatePickerPosition(
      { left: width - 45, right: width, top: 120, bottom: 160 },
      { width, height: 700 },
      330,
    );

    assert.ok(position.left >= 8);
    assert.ok(position.left + position.width <= width - 8);
    assert.ok(position.maxHeight > 0);
  });
}

test('date picker opens above an anchor when below space is insufficient', () => {
  const position = getDatePickerPosition(
    { left: 24, right: 200, top: 620, bottom: 660 },
    { width: 375, height: 700 },
    320,
  );

  assert.equal(position.placement, 'above');
  assert.ok(position.top + Math.min(320, position.maxHeight) <= 620);
});

test('date picker uses available space below when it is sufficient', () => {
  const position = getDatePickerPosition(
    { left: 24, right: 200, top: 80, bottom: 120 },
    { width: 375, height: 700 },
    320,
  );

  assert.equal(position.placement, 'below');
  assert.ok(position.top >= 120);
});
