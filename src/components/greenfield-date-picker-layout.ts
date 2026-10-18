export type DatePickerAnchor = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;

export type DatePickerViewport = {
  width: number;
  height: number;
};

export type DatePickerPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: 'above' | 'below';
};

export function getDatePickerPosition(
  anchor: DatePickerAnchor,
  viewport: DatePickerViewport,
  desiredHeight: number,
  preferredWidth = 310,
  gutter = 8,
): DatePickerPosition {
  const width = Math.max(0, Math.min(preferredWidth, viewport.width - gutter * 2));
  const left = Math.max(gutter, Math.min(anchor.left, viewport.width - width - gutter));
  const below = Math.max(0, viewport.height - anchor.bottom - gutter);
  const above = Math.max(0, anchor.top - gutter);
  const placement = below < Math.min(desiredHeight, 300) && above > below ? 'above' : 'below';
  const maxHeight = Math.max(0, placement === 'above' ? above : below);
  const height = Math.min(desiredHeight, maxHeight);
  const top = placement === 'above'
    ? Math.max(gutter, anchor.top - height - gutter)
    : Math.min(viewport.height - height - gutter, anchor.bottom + gutter);

  return { left, top, width, maxHeight, placement };
}
