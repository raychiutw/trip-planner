/**
 * NoteDateTimeField — trip-notes datetime editor.
 *
 * Composes the canonical TripDatePicker (date) + TripTimePicker (time) to
 * replace native `<input type="datetime-local">` in the trip-notes CRUD forms.
 * Custom terracotta popovers → consistent 44px control height + design-spec
 * compliance (no native date/time chrome). v2.34.x QA input-styling pass.
 *
 * I/O: a single datetime string matching the stored shape —
 *   "YYYY-MM-DDTHH:MM"  (date + time)
 *   "YYYY-MM-DD"        (date only)
 *   "HH:MM"             (time only, rare)
 *   ""                  (empty)
 *
 * Local state holds the date/time parts so two sequential picks
 * (date then time) don't lose each other while the parent's autosave PATCH
 * round-trips. An external value change (e.g. STALE refetch) re-syncs.
 */
import { useEffect, useState } from 'react';

import { TripDatePicker } from '../TripDatePicker';
import { TripTimePicker } from '../TripTimePicker';

export interface NoteDateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  minuteStep?: 1 | 5 | 10 | 15 | 30;
}

export function splitDateTime(v: string): { date: string; time: string } {
  if (!v) return { date: '', time: '' };
  const tIdx = v.indexOf('T');
  if (tIdx >= 0) return { date: v.slice(0, tIdx), time: v.slice(tIdx + 1, tIdx + 6) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { date: v, time: '' };
  if (/^\d{1,2}:\d{2}/.test(v)) return { date: '', time: v.slice(0, 5) };
  return { date: v, time: '' };
}

export function combineDateTime(date: string, time: string): string {
  if (date && time) return `${date}T${time}`;
  return date || time || '';
}

const STYLES = `
.tp-notes-datetime { display: flex; gap: 8px; align-items: stretch; max-width: 460px; }
.tp-notes-datetime > .tp-date-picker { flex: 1 1 auto; min-width: 0; }
/* 128px fits the 22px-bold "--:--" value + chevron on one line; narrower
 * widths let the placeholder wrap at its hyphens → trigger balloons tall. */
.tp-notes-datetime > .tp-time-picker { flex: 0 0 128px; }
.tp-notes-datetime .tp-date-trigger,
.tp-notes-datetime .tp-time-trigger { width: 100%; white-space: nowrap; }
`;

export default function NoteDateTimeField({
  value,
  onChange,
  ariaLabel,
  minuteStep = 5,
}: NoteDateTimeFieldProps) {
  const initial = splitDateTime(value);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);

  // Re-sync if the stored value changes externally (refetch / STALE recovery).
  useEffect(() => {
    const s = splitDateTime(value);
    setDate(s.date);
    setTime(s.time);
  }, [value]);

  const handleDate = (d: string) => {
    setDate(d);
    onChange(combineDateTime(d, time));
  };
  const handleTime = (t: string) => {
    setTime(t);
    onChange(combineDateTime(date, t));
  };

  return (
    <div className="tp-notes-datetime">
      <style>{STYLES}</style>
      <TripDatePicker
        value={date}
        onChange={handleDate}
        ariaLabel={ariaLabel ? `${ariaLabel}日期` : '日期'}
      />
      <TripTimePicker
        value={time}
        onChange={handleTime}
        ariaLabel={ariaLabel ? `${ariaLabel}時間` : '時間'}
        minuteStep={minuteStep}
      />
    </div>
  );
}
