/**
 * TripTimePicker — terracotta-themed time picker (replaces native type="time").
 *
 * Variant: tp-input-short solo trigger (22px bold center, 44px tap target).
 * Popover: two-column scrolling lists (hour 00-23 + minute 00/05/10/.../55).
 * Wraps `@headlessui/react` Popover for portal positioning + outside-click + a11y.
 *
 * I/O: "HH:MM" string. Empty string ("") => placeholder shown.
 */
import { useEffect, useId, useMemo, useRef } from 'react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';

import { TRIP_TIME_PICKER_STYLES } from './TripTimePicker.styles';

export interface TripTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Minute step (default 5). Use 1 for minute-precise input. */
  minuteStep?: 1 | 5 | 10 | 15 | 30;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

function parseHHMM(s: string): { hh: string; mm: string } | null {
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh: m[1]!, mm: m[2]! };
}

export function TripTimePicker({
  value,
  onChange,
  minuteStep = 5,
  placeholder = '--:--',
  ariaLabel,
  disabled = false,
  required = false,
  className,
  id,
}: TripTimePickerProps) {
  const autoId = useId();
  const triggerId = id ?? `tp-time-${autoId}`;
  const parsed = useMemo(() => parseHHMM(value), [value]);
  const display = parsed ? `${parsed.hh}:${parsed.mm}` : placeholder;
  const isPlaceholder = !parsed;

  const minutes = useMemo(
    () =>
      Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
        String(i * minuteStep).padStart(2, '0'),
      ),
    [minuteStep],
  );

  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  return (
    <Popover className={`tp-time-picker ${className ?? ''}`.trim()}>
      {({ open, close }) => (
        <TimePickerBody
          open={open}
          close={close}
          triggerId={triggerId}
          ariaLabel={ariaLabel}
          required={required}
          disabled={disabled}
          display={display}
          isPlaceholder={isPlaceholder}
          parsed={parsed}
          minutes={minutes}
          hourColRef={hourColRef}
          minuteColRef={minuteColRef}
          onChange={onChange}
        />
      )}
    </Popover>
  );
}

interface TimePickerBodyProps {
  open: boolean;
  close: () => void;
  triggerId: string;
  ariaLabel?: string;
  required: boolean;
  disabled: boolean;
  display: string;
  isPlaceholder: boolean;
  parsed: { hh: string; mm: string } | null;
  minutes: string[];
  hourColRef: React.RefObject<HTMLDivElement | null>;
  minuteColRef: React.RefObject<HTMLDivElement | null>;
  onChange: (value: string) => void;
}

function TimePickerBody({
  open,
  close,
  triggerId,
  ariaLabel,
  required,
  disabled,
  display,
  isPlaceholder,
  parsed,
  minutes,
  hourColRef,
  minuteColRef,
  onChange,
}: TimePickerBodyProps) {
  // Scroll selected items into center when popover opens.
  // headlessui PopoverPanel renders via portal — refs ready after open=true commit
  // but layout/scroll may not be ready in same tick. setTimeout(50ms) waits for
  // popover transition + layout calc + paint. v2.33.23 fix (was rAF, unreliable).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const hh = parsed?.hh ?? '12';
      // If existing minute isn't on a step boundary, scroll to nearest cell.
      const mmTarget = parsed?.mm
        ? minutes.reduce((best, m) =>
            Math.abs(Number(m) - Number(parsed.mm)) < Math.abs(Number(best) - Number(parsed.mm))
              ? m
              : best,
          )
        : '00';
      const hourScroll = hourColRef.current?.querySelector<HTMLElement>('.tp-time-col-scroll');
      const minScroll = minuteColRef.current?.querySelector<HTMLElement>('.tp-time-col-scroll');
      const hourBtn = hourColRef.current?.querySelector<HTMLElement>(`[data-h="${hh}"]`);
      const minBtn = minuteColRef.current?.querySelector<HTMLElement>(`[data-m="${mmTarget}"]`);
      // Use parent scrollTop instead of scrollIntoView (which can scroll page too).
      if (hourScroll && hourBtn) {
        hourScroll.scrollTop = hourBtn.offsetTop - hourScroll.clientHeight / 2 + hourBtn.clientHeight / 2;
      }
      if (minScroll && minBtn) {
        minScroll.scrollTop = minBtn.offsetTop - minScroll.clientHeight / 2 + minBtn.clientHeight / 2;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [open, parsed, minutes, hourColRef, minuteColRef]);

  const pick = (hh: string, mm: string) => {
    onChange(`${hh}:${mm}`);
    close();
  };

  return (
    <>
      <style>{TRIP_TIME_PICKER_STYLES}</style>
      <PopoverButton
        id={triggerId}
        as="button"
        type="button"
        className={`tp-time-trigger ${isPlaceholder ? 'is-placeholder' : ''}`}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
      >
        <span className="tp-time-value">{display}</span>
        <svg className="tp-time-chev" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: 'bottom start', gap: 8 }}
        className="tp-time-popover"
      >
        <div className="tp-time-cols">
          <div className="tp-time-col" ref={hourColRef} aria-label="小時">
            <div className="tp-time-col-label">時</div>
            <div className="tp-time-col-scroll">
              {HOURS.map((hh) => {
                const selected = parsed?.hh === hh;
                return (
                  <button
                    key={hh}
                    data-h={hh}
                    type="button"
                    className={`tp-time-cell ${selected ? 'is-selected' : ''}`}
                    onClick={() => pick(hh, parsed?.mm ?? '00')}
                  >
                    {hh}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="tp-time-col" ref={minuteColRef} aria-label="分鐘">
            <div className="tp-time-col-label">分</div>
            <div className="tp-time-col-scroll">
              {minutes.map((mm) => {
                const selected = parsed?.mm === mm;
                return (
                  <button
                    key={mm}
                    data-m={mm}
                    type="button"
                    className={`tp-time-cell ${selected ? 'is-selected' : ''}`}
                    onClick={() => pick(parsed?.hh ?? '12', mm)}
                  >
                    {mm}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverPanel>
    </>
  );
}
