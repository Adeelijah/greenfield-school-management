export type DropdownRect = { top: number; bottom: number; left: number; width: number };
export type DropdownLayout = { placement: 'above' | 'below'; top: number; left: number; width: number; maxHeight: number };

export function getDropdownLayout(
  rect: DropdownRect,
  viewport: { width: number; height: number },
  desiredHeight: number,
  gap = 7,
  margin = 8,
): DropdownLayout {
  const viewportWidth = Math.max(0, viewport.width);
  const viewportHeight = Math.max(0, viewport.height);
  const maxWidth = Math.max(0, viewportWidth - margin * 2);
  const width = Math.min(Math.max(0, rect.width), maxWidth);
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - margin - width));
  const below = Math.max(0, viewportHeight - margin - rect.bottom - gap);
  const above = Math.max(0, rect.top - margin - gap);
  const placement = desiredHeight <= below || below >= above ? 'below' : 'above';
  const maxHeight = Math.min(Math.max(0, desiredHeight), placement === 'below' ? below : above);
  const top = placement === 'below'
    ? Math.min(rect.bottom + gap, Math.max(margin, viewportHeight - margin - maxHeight))
    : Math.max(margin, rect.top - gap - maxHeight);
  return { placement, top, left, width, maxHeight };
}

export function nextEnabledOptionIndex(
  options: readonly { disabled?: boolean }[],
  currentIndex: number,
  direction: -1 | 1,
): number {
  if (!options.length) return -1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (currentIndex + direction * offset + options.length * 2) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

export function edgeEnabledOptionIndex(options: readonly { disabled?: boolean }[], edge: 'first' | 'last'): number {
  const indexes = options.map((option, index) => ({ option, index }));
  return (edge === 'first' ? indexes : indexes.reverse()).find(item => !item.option.disabled)?.index ?? -1;
}
