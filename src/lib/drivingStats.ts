/**
 * Driving / transport statistics calculation utilities.
 */

import {
  TRANSPORT_TYPES,
  TRANSPORT_TYPE_ORDER,
  DRIVING_WARN_MINUTES,
} from './constants';
import type { Entry } from '../types/trip';

/* ===== Types ===== */

export interface Segment {
  text: string;
  minutes: number;
  from?: string;
  to?: string;
}

export interface TypeGroup {
  label: string;
  icon: string;
  totalMinutes: number;
  segments: Segment[];
}

export interface DayDrivingStats {
  totalMinutes: number;
  drivingMinutes: number;
  byType: Record<string, TypeGroup>;
  /** Backward-compat: flat segments list (driving only). */
  segments: Segment[];
}

export interface TripDayStats {
  dayId: number;
  date: string;
  label: string;
  stats: DayDrivingStats;
}

export interface TripDrivingStats {
  grandTotal: number;
  grandByType: Record<string, { label: string; icon: string; totalMinutes: number }>;
  days: TripDayStats[];
}

/* ===== Per-day stats ===== */

/**
 * Calculates driving/transport statistics for a single day's timeline.
 * Returns null if there is no transport data.
 */
export function calcDrivingStats(timeline: Entry[] | undefined | null): DayDrivingStats | null {
  if (!timeline || !timeline.length) return null;

  const byType: Record<string, TypeGroup> = {};
  let totalMinutes = 0;
  let drivingMinutes = 0;

  timeline.forEach((entry, i) => {
    if (!entry.travel) return;
    const t = entry.travel;
    const type = t.type || '';
    const text = t.desc || (typeof t === 'string' ? (t as unknown as string) : '');
    const typeInfo = TRANSPORT_TYPES[type];
    if (!typeInfo) return;

    const m = String(text).match(/(\d+)/);
    if (!m) return;
    const mins = parseInt(m[1], 10);

    // Derive from/to from entry titles
    const from = entry.title || undefined;
    const nextEntry = timeline[i + 1];
    const to = nextEntry?.title || undefined;

    if (!byType[type]) {
      byType[type] = {
        label: typeInfo.label,
        icon: typeInfo.icon,
        totalMinutes: 0,
        segments: [],
      };
    }
    byType[type].segments.push({ text: String(text), minutes: mins, from, to });
    byType[type].totalMinutes += mins;
    totalMinutes += mins;
    if (type === 'car') drivingMinutes += mins;
  });

  if (totalMinutes === 0) return null;
  return {
    totalMinutes,
    drivingMinutes,
    byType,
    segments: byType['car'] ? byType['car'].segments : [],
  };
}

/* ===== Trip-wide stats ===== */

interface DayLike {
  id?: number;
  dayNum?: number;
  date?: string | null;
  dayOfWeek?: string | null;
  timeline: Entry[];
}

/**
 * Calculates aggregate transport statistics across all days.
 * Returns null if no transport data exists across any day.
 */
export function calcTripDrivingStats(days: DayLike[]): TripDrivingStats | null {
  if (!days || !days.length) return null;

  const dayStats: TripDayStats[] = [];
  let grandTotal = 0;
  const grandByType: Record<string, { label: string; icon: string; totalMinutes: number }> = {};

  days.forEach((day) => {
    const stats = calcDrivingStats(day.timeline);
    if (!stats) return;

    const dayId = day.dayNum ?? day.id ?? 0;
    const d = day.date || '';
    const dm = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
    let dateStr = d;
    if (dm) {
      const month = parseInt(dm[1], 10);
      const date = parseInt(dm[2], 10);
      const dow = day.dayOfWeek ? `（${day.dayOfWeek}）` : '';
      dateStr = `${month}/${date}${dow}`;
    }

    dayStats.push({
      dayId,
      date: dateStr,
      label: 'Day ' + dayId,
      stats,
    });
    grandTotal += stats.totalMinutes;

    for (const key of TRANSPORT_TYPE_ORDER) {
      const g = stats.byType[key];
      if (!g) continue;
      if (!grandByType[key]) {
        grandByType[key] = { label: g.label, icon: g.icon, totalMinutes: 0 };
      }
      grandByType[key].totalMinutes += g.totalMinutes;
    }
  });

  if (!dayStats.length) return null;
  return { grandTotal, grandByType, days: dayStats };
}

/**
 * Returns whether the driving minutes exceed the warning threshold.
 */
export function isDrivingWarning(drivingMinutes: number): boolean {
  return drivingMinutes > DRIVING_WARN_MINUTES;
}
