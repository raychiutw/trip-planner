/* ===== Timeline Component ===== */

import { useMemo } from 'react';
import { type TimelineEntryData } from './TimelineEvent';
import TimelineRail from './TimelineRail';
import { parseStartMinutes, parseEndMinutes } from '../../lib/timelineUtils';

interface TimelineProps {
  events: TimelineEntryData[];
  /** The day's date (ISO format "YYYY-MM-DD"). When it matches today, "now" tracking is enabled. */
  dayDate?: string | null;
  /** Today's date (ISO format "YYYY-MM-DD") provided by parent for stable comparison. */
  localToday?: string | null;
  /** v2.10 Wave 1: trip_days.id for the current day — used by RailRow ⎘/⇅
   *  popover (currentDayId) + PATCH/POST endpoints (target_day_id resolves
   *  via TripDaysContext day picker). */
  dayId?: number | null;
  /** 2026-07-07 跨天拖拉：透傳 TimelineRail — TripPage 統一 DndContext 時 true。 */
  dndManaged?: boolean;
}

export default function Timeline({ events, dayDate, localToday, dayId, dndManaged }: TimelineProps) {
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

  // 2026-07-07 跨天拖拉：dndManaged 空日放行 — rail render 空 drop 槽
  if ((!events || events.length === 0) && !dndManaged) return null;

  return <TimelineRail events={events} nowIndex={nowIndex} dayId={dayId} dndManaged={dndManaged} />;
}
