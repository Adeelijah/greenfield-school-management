'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { getDatePickerPosition } from './greenfield-date-picker-layout';

type GreenfieldDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  allowFuture?: boolean;
};

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function GreenfieldDatePicker({
  value,
  onChange,
  label,
  allowFuture = false,
}: GreenfieldDatePickerProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [showYears, setShowYears] = useState(false);
  const [showMonths, setShowMonths] = useState(false);
  const [yearPage, setYearPage] = useState(
    Math.floor(currentYear / 12) * 12
  );
  const [position, setPosition] = useState<ReturnType<typeof getDatePickerPosition> | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const calendarId = useId();

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor || !calendar.current) return;
      setPosition(getDatePickerPosition(
        anchor,
        { width: window.innerWidth, height: window.innerHeight },
        calendar.current.scrollHeight,
      ));
    }

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, year, month, showYears, showMonths]);

  useEffect(() => {
    if (!open) return;

    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (
        root.current &&
        !root.current.contains(target) &&
        !calendar.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }

    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function changeMonth(offset: number) {
    const next = new Date(year, month + offset, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  function selectDate(day: number) {
    onChange(toISO(year, month, day));
    setOpen(false);
    trigger.current?.focus();
  }

  function openCalendar() {
    setPosition(null);
    if (!open && value) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (match) {
        setYear(Number(match[1]));
        setMonth(Number(match[2]) - 1);
      }
    }
    setShowYears(false);
    setShowMonths(false);
    setOpen(previous => !previous);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const displayValue = value
    ? (() => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) return value;
        return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
      })()
    : 'Select date';

  return (
    <div className="greenfield-date-picker" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="greenfield-date-trigger"
        aria-label={`${label}: ${displayValue}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={calendarId}
        onClick={openCalendar}
      >
        <span>{displayValue}</span>
        <CalendarDays size={17} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={calendar}
          id={calendarId}
          className="greenfield-calendar"
          role="dialog"
          aria-label={`${label} calendar`}
          style={{
            position: 'fixed',
            left: position?.left ?? 8,
            top: position?.top ?? 8,
            width: position?.width ?? 'min(310px, calc(100vw - 16px))',
            maxHeight: position?.maxHeight ?? 'calc(100vh - 16px)',
            overflowY: 'auto',
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          <div className="greenfield-calendar-header">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={17} />
            </button>

            <div className="greenfield-calendar-period">
              <button
                type="button"
                className="greenfield-month-trigger"
                aria-label={`Choose month, currently ${months[month]}`}
                aria-expanded={showMonths}
                onClick={() => {
                  setShowYears(false);
                  setShowMonths(previous => !previous);
                }}
              >
                {months[month]}
              </button>

              <button
                type="button"
                className="greenfield-year-trigger"
                aria-expanded={showYears}
                aria-label={`Choose year, currently ${year}`}
                onClick={() => {
                  setYearPage(Math.floor(year / 12) * 12);
                  setShowMonths(false);
                  setShowYears(previous => !previous);
                }}
              >
                {year}
              </button>
            </div>

            <button
              type="button"
              aria-label="Next month"
              disabled={!allowFuture && (
                year > currentYear ||
                (year === currentYear && month >= currentMonth)
              )}
              onClick={() => changeMonth(1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>

          {showYears && (
            <div className="greenfield-year-panel">
              <div className="greenfield-year-navigation">
                <button
                  type="button"
                  aria-label="Previous 12 years"
                  onClick={() => setYearPage(previous => previous - 12)}
                >
                  <ChevronLeft size={16} />
                </button>
                <strong>{yearPage} - {yearPage + 11}</strong>
                <button
                  type="button"
                  aria-label="Next 12 years"
                  disabled={!allowFuture && yearPage + 12 > currentYear}
                  onClick={() => setYearPage(previous => previous + 12)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="greenfield-year-grid">
                {Array.from({ length: 12 }, (_, index) => yearPage + index)
                  .map(option => (
                    <button
                      key={option}
                      type="button"
                      disabled={!allowFuture && option > currentYear}
                      aria-pressed={year === option}
                      className={year === option ? 'selected' : ''}
                      onClick={() => {
                        setYear(option);
                        setShowYears(false);
                      }}
                    >
                      {option}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {showMonths && (
            <div className="greenfield-month-panel">
              <div className="greenfield-month-grid">
                {months.map((name, index) => {
                  const unavailable = !allowFuture && (
                    year === currentYear && index > currentMonth
                  );

                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={unavailable}
                      aria-pressed={month === index}
                      className={month === index ? 'selected' : ''}
                      onClick={() => {
                        setMonth(index);
                        setShowMonths(false);
                      }}
                    >
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!showYears && !showMonths && <div className="greenfield-calendar-grid">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <span className="greenfield-calendar-weekday" key={day}>
                {day}
              </span>
            ))}

            {cells.map((day, index) => {
              if (day === null) {
                return <span key={`empty-${index}`} />;
              }

              const date = toISO(year, month, day);
              const disabled = !allowFuture && date > toISO(
                currentYear,
                currentMonth,
                today.getDate()
              );

              return (
                <button
                  key={date}
                  type="button"
                  disabled={disabled}
                  aria-label={date}
                  aria-pressed={value === date}
                  className={value === date ? 'selected' : ''}
                  onClick={() => selectDate(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>}

          <div className="greenfield-calendar-footer">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Clear date
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
