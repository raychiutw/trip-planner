/* ===== Timeline Component ===== */

import { useMemo } from 'react';
import { type TimelineEntryData } from './TimelineEvent';
import TimelineRail from './TimelineRail';

interface TimelineProps {
  events: TimelineEntryData[];
  /** The day's date (ISO format "YYYY-MM-DD"). When it matches today, "now" tracking is enabled. */
  dayDate?: string | null;
  /** Today's date (ISO format "YYYY-MM-DD") provided by parent for stable comparison. */
  localToday?: string | null;
}

function parseStartMinutes(time?: string | null): number {
  if (!time) return -1;
  const start = (time.split('-')[0] ?? '').trim();
  const parts = start.split(':');
  if (parts.length !== 2) return -1;
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

function parseEndMinutes(time?: string | null): number {
  if (!time) return -1;
  const segments = time.split('-');
  if (segments.length < 2) return -1;
  const end = (segments[1] ?? '').trim();
  const parts = end.split(':');
  if (parts.length !== 2) return -1;
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

export default function Timeline({ events, dayDate, localToday }: TimelineProps) {
  const isToday = useMemo(() => {
    const today = localToday ?? new Date().toISOString().split('T')[0];
    return dayDate === today;
  }, [dayDate, localToday]);

  const nowIndex = useMemo(() => {
    if (!isToday) return -1;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const start = parseStartMinutes(ev?.time);
      const end = parseEndMinutes(ev?.time);
      if (start >= 0 && end >= 0 && nowMin >= start && nowMin <= end) return i;
      if (start >= 0 && nowMin >= start) {
        const nextEv = i + 1 < events.length ? events[i + 1] : undefined;
        const nextStart = nextEv ? parseStartMinutes(nextEv.time) : -1;
        if (nextStart < 0 || nowMin < nextStart) return i;
      }
    }
    return -1;
  }, [isToday, events]);

  if (!events || events.length === 0) return null;

  return <TimelineRail events={events} nowIndex={nowIndex} />;
}
