/* ===== Timeline Component ===== */
/* Renders the full day timeline — maps each entry to a <TimelineEvent>. */

import { useMemo } from 'react';
import TimelineEvent, { type TimelineEntryData } from './TimelineEvent';

interface TimelineProps {
  /** Array of timeline entries for a single day */
  events: TimelineEntryData[];
  /** The day's date (ISO format "YYYY-MM-DD"). When it matches today, "now" tracking is enabled. */
  dayDate?: string | null;
}

/** Parse start time "HH:MM" to minutes since midnight */
function parseStartMinutes(time?: string | null): number {
  if (!time) return -1;
  const start = time.split('-')[0].trim();
  const parts = start.split(':');
  if (parts.length !== 2) return -1;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/** Parse end time from "HH:MM-HH:MM" to minutes since midnight */
function parseEndMinutes(time?: string | null): number {
  if (!time) return -1;
  const segments = time.split('-');
  if (segments.length < 2) return -1;
  const end = segments[1].trim();
  const parts = end.split(':');
  if (parts.length !== 2) return -1;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export default function Timeline({ events, dayDate }: TimelineProps) {
  if (!events || events.length === 0) return null;

  const isToday = dayDate === new Date().toISOString().split('T')[0];

  /* Compute now index: only if this is today's timeline */
  const { nowIndex } = useMemo(() => {
    if (!isToday) return { nowIndex: -1 };
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let foundNow = -1;
    for (let i = 0; i < events.length; i++) {
      const start = parseStartMinutes(events[i].time);
      const end = parseEndMinutes(events[i].time);
      // Entry has explicit end time and we're within range
      if (start >= 0 && end >= 0 && nowMin >= start && nowMin <= end) {
        foundNow = i;
        break;
      }
      // Entry has start time, check against next entry's start
      if (start >= 0 && nowMin >= start) {
        const nextStart = i + 1 < events.length ? parseStartMinutes(events[i + 1].time) : -1;
        if (nextStart < 0 || nowMin < nextStart) {
          foundNow = i;
        }
      }
    }
    return { nowIndex: foundNow };
  }, [isToday, events]);

  return (
    <div className="timeline">
      {events.map((ev, i) => (
        <TimelineEvent
          key={ev.id ?? i}
          entry={ev}
          index={i + 1}
          isNow={isToday && i === nowIndex}
          isPast={isToday && nowIndex >= 0 && i < nowIndex}
        />
      ))}
    </div>
  );
}
