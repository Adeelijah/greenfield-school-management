import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's type-stripping runner requires explicit source extensions.
import { edgeEnabledOptionIndex, getDropdownLayout, nextEnabledOptionIndex } from './greenfield-dropdown-behavior.ts';

test('dropdown stays within common mobile and tablet viewport widths', () => {
  for (const width of [320, 375, 390, 768]) {
    const layout = getDropdownLayout({ top: 80, bottom: 124, left: width - 100, width: 140 }, { width, height: 700 }, 180);
    assert.ok(layout.left >= 8);
    assert.ok(layout.left + layout.width <= width - 8);
  }
});

test('dropdown opens above when the menu does not fit below', () => {
  const layout = getDropdownLayout({ top: 520, bottom: 564, left: 20, width: 220 }, { width: 390, height: 600 }, 220);
  assert.equal(layout.placement, 'above');
  assert.ok(layout.top >= 8);
  assert.ok(layout.top + layout.maxHeight <= 592);
});

test('keyboard helpers skip disabled options, wrap, and find enabled edges', () => {
  const options = [{}, { disabled: true }, {}, { disabled: true }];
  assert.equal(nextEnabledOptionIndex(options, 0, 1), 2);
  assert.equal(nextEnabledOptionIndex(options, 2, 1), 0);
  assert.equal(edgeEnabledOptionIndex(options, 'first'), 0);
  assert.equal(edgeEnabledOptionIndex(options, 'last'), 2);
  assert.equal(nextEnabledOptionIndex([{ disabled: true }], 0, 1), -1);
});
