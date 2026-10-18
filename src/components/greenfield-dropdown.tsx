'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { edgeEnabledOptionIndex, getDropdownLayout, nextEnabledOptionIndex } from './greenfield-dropdown-behavior';

export type DropdownOption = { value: string; label: string; disabled?: boolean };

type GreenfieldDropdownProps = {
  label: string;
  value: string;
  options: readonly DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function GreenfieldDropdown({ label, value, options, onChange, className = '', disabled = false }: GreenfieldDropdownProps) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<{ top: number; left: number; width: number; maxHeight: number; placement: 'above' | 'below' } | null>(null);
  const pendingFocus = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeahead = useRef('');
  const labelId = useId();
  const menuId = useId();
  const selectedLabel = options.find(option => option.value === value)?.label ?? value;

  function focusOption(index: number) {
    if (index < 0) return;
    if (open && menu.current) optionRefs.current[index]?.focus();
    else {
      pendingFocus.current = index;
      setOpen(true);
    }
  }

  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const desiredHeight = Math.min(menu.current.scrollHeight, 320);
    const next = getDropdownLayout(rect, { width: window.innerWidth, height: window.innerHeight }, desiredHeight);
    const measuredWidth = Math.min(Math.max(rect.width, menu.current.scrollWidth), Math.max(0, window.innerWidth - 16));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 8 - measuredWidth));
    setLayout({ ...next, width: measuredWidth, left });
  }, [open, options.length]);

  useLayoutEffect(() => {
    if (!open || pendingFocus.current === null) return;
    optionRefs.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    function reposition() {
      if (!trigger.current || !menu.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const desiredHeight = Math.min(menu.current.scrollHeight, 320);
      const next = getDropdownLayout(rect, { width: window.innerWidth, height: window.innerHeight }, desiredHeight);
      const width = Math.min(Math.max(rect.width, menu.current.scrollWidth), Math.max(0, window.innerWidth - 16));
      setLayout({ ...next, width, left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 8 - width)) });
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  function moveFocus(from: number, direction: -1 | 1) {
    focusOption(nextEnabledOptionIndex(options, from, direction));
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(index, event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusOption(edgeEnabledOptionIndex(options, event.key === 'Home' ? 'first' : 'last'));
    } else if (event.key === 'Tab') {
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeahead.current = `${typeahead.current}${event.key}`.toLocaleLowerCase();
      const match = options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(typeahead.current));
      if (match >= 0) focusOption(match);
      window.setTimeout(() => { typeahead.current = ''; }, 700);
    }
  }

  return (
    <div className={`greenfield-dropdown ${className}`} ref={root}>
      <span className="greenfield-dropdown-label" id={labelId}>{label}</span>
      <button
        ref={trigger}
        type="button"
        className="greenfield-dropdown-trigger"
        aria-labelledby={`${labelId} ${menuId}-selected`}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(previous => !previous)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const index = edgeEnabledOptionIndex(options, event.key === 'ArrowDown' ? 'first' : 'last');
            if (open) moveFocus(-1, event.key === 'ArrowDown' ? 1 : -1);
            else focusOption(index);
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            focusOption(edgeEnabledOptionIndex(options, event.key === 'Home' ? 'first' : 'last'));
          }
        }}
      >
        <span id={`${menuId}-selected`}>{selectedLabel}</span>
        <ChevronDown size={16} className={open ? 'chevron-open' : ''} aria-hidden="true" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menu}
          id={menuId}
          className={`greenfield-dropdown-options ${layout?.placement === 'above' ? 'opens-above' : ''}`}
          role="listbox"
          aria-labelledby={labelId}
          style={{ position: 'fixed', top: layout?.top ?? 0, left: layout?.left ?? 0, right: 'auto', bottom: 'auto', zIndex: 1000, width: layout?.width ?? 'max-content', maxWidth: 'calc(100vw - 16px)', maxHeight: layout?.maxHeight ?? 'min(320px, calc(100vh - 16px))', overflowY: 'auto', overflowX: 'hidden', visibility: layout ? 'visible' : 'hidden' }}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={node => { optionRefs.current[index] = node; }}
              type="button"
              role="option"
              aria-selected={value === option.value}
              aria-disabled={option.disabled || undefined}
              disabled={option.disabled}
              tabIndex={-1}
              className={`greenfield-dropdown-option${value === option.value ? ' selected' : ''}`}
              onKeyDown={event => handleOptionKeyDown(event, index)}
              onClick={() => {
                if (option.disabled) return;
                onChange(option.value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span>{option.label}</span>
              {value === option.value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
