/**
 * DaySection — memoised per-day renderer (Terracotta design).
 *
 * Renders:
 *  - Terracotta hero card (Day eyebrow + 看地圖 chip + title + date + stats)
 *  - Weather card (HourlyWeather)
 *  - Timeline stop cards
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import clsx from 'clsx';
import DaySkeleton from './DaySkeleton';
import HourlyWeather from './HourlyWeather';
import Timeline from './Timeline';
import Icon from '../shared/Icon';
import { toTimelineEntry } from '../../lib/mapDay';
import { validateDay } from '../../lib/validateDay';
import { buildWeatherDay } from '../../lib/weather';
import type { Day, DaySummary } from '../../types/trip';

/* ===== 看地圖 chip + hero chips layout + 加景點 footer (scoped styles) ===== */
const MAP_CHIP_STYLES = `
.day-map-chip {
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 44px; /* F010: Apple HIG 最小 tap target 44pt */
  font-size: var(--font-size-eyebrow); font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--color-accent);
  text-decoration: none;
  padding: 2px 0;
  white-space: nowrap;
  transition: opacity 160ms var(--transition-timing-function-apple);
}
.day-map-chip:hover { opacity: 0.75; }
.day-map-chip .svg-icon { width: 12px; height: 12px; }
.tp-hero-chips {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 6px;
}
.tp-hero-chips-left {
  display: inline-flex; gap: 8px; align-items: center; flex-wrap: wrap;
}

`;

export interface DaySectionProps {
  dayNum: number;
  day: Day | undefined;
  daySummary: DaySummary | undefined;
  tripStart: string | null;
  tripEnd: string | null;
  themeArt?: { dark: boolean };
  localToday?: string;
  isActive?: boolean;
  // Note: inline day map was removed in PR3. Use /trip/:id/map?day=N instead.
  timezone?: string;
}

/** Extract time range parts from entry time string "HH:MM-HH:MM" or "HH:MM". */
function getTimelineBounds(timeline: unknown[]): { start: string | null; end: string | null } {
  const times = timeline
    .map((e) => (typeof e === 'object' && e !== null && 'time' in e ? String((e as { time?: unknown }).time ?? '') : ''))
    .filter((t) => t);
  if (times.length === 0) return { start: null, end: null };
  const firstStr = times[0] ?? '';
  const lastStr = times[times.length - 1] ?? '';
  const firstParts = firstStr.split('-');
  const lastParts = lastStr.split('-');
  return {
    start: firstParts[0]?.trim() || null,
    end: (lastParts[lastParts.length - 1] ?? lastParts[0] ?? '').trim() || null,
  };
}

/** Sum entry.travel.distanceM across timeline → kilometers (rounded). null if no data. */
function getTotalKm(timeline: unknown[]): number | null {
  let totalM = 0;
  let hasAny = false;
  for (const e of timeline) {
    if (typeof e !== 'object' || e === null) continue;
    const travel = (e as { travel?: { distanceM?: number | null } }).travel;
    const d = travel?.distanceM;
    if (typeof d === 'number' && Number.isFinite(d)) {
      totalM += d;
      hasAny = true;
    }
  }
  if (!hasAny) return null;
  return Math.round(totalM / 1000);
}

/** Compute hours between bounds.start and bounds.end (e.g. "08:00" → "21:00" = 13). */
function getTotalHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const parse = (t: string): number | null => {
    const [hh, mm] = t.split(':');
    const h = parseInt(hh ?? '', 10);
    const m = parseInt(mm ?? '0', 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  const s = parse(start);
  const e = parse(end);
  if (s == null || e == null) return null;
  const diff = e - s;
  if (diff <= 0) return null;
  return Math.round(diff / 60);
}

const DaySection = React.memo(function DaySection({
  dayNum,
  day,
  daySummary,
  tripStart,
  tripEnd,
  localToday,
  isActive,
  timezone,
}: DaySectionProps) {
  const [animKey, setAnimKey] = useState(0);
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevActiveRef.current) setAnimKey((k) => k + 1);
    prevActiveRef.current = !!isActive;
  }, [isActive]);

  // useMemo 穩定 reference：`?? []` 每 render 造新陣列，會讓下面 4 個吃 timeline 的
  // useMemo 依賴每 render 變動而永不命中（react-hooks/exhaustive-deps）。
  const timeline = useMemo(() => day?.timeline ?? [], [day?.timeline]);
  const weatherDay = useMemo(() => buildWeatherDay(day?.label, timeline), [day?.label, timeline]);
  const dayDate = day?.date ?? daySummary?.date ?? undefined;
  const dayId = day?.id;

  const warnings = useMemo(() => validateDay(timeline), [timeline]);
  const bounds = useMemo(() => getTimelineBounds(timeline), [timeline]);
  const totalKm = useMemo(() => getTotalKm(timeline), [timeline]);
  const totalHours = useMemo(() => getTotalHours(bounds.start, bounds.end), [bounds.start, bounds.end]);
  const heroSub = useMemo(() => {
    const parts: string[] = [];
    if (timeline.length > 0) parts.push(`${timeline.length} 個停留點`);
    if (totalKm != null) parts.push(`${totalKm} km`);
    if (totalHours != null) parts.push(`預估 ${totalHours} 小時`);
    return parts.length > 1 ? parts.join(' · ') : '';
  }, [timeline.length, totalKm, totalHours]);

  const timelineEntries = useMemo(
    () => timeline.map((e) => typeof e === 'object' && e !== null ? toTimelineEntry(e) : toTimelineEntry({})),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day?.timeline],
  );

  const eyebrow = `DAY ${String(dayNum).padStart(2, '0')}`;
  const dateLabel = daySummary?.date
    ? `${daySummary.date}${daySummary.dayOfWeek ? `（${daySummary.dayOfWeek}）` : ''}`
    : '';
  const area = daySummary?.label || '';
  // Section 4.3 (terracotta-mockup-parity-v2)：3-tier fallback chain — user-defined
  // title (trip_days.title) → 區域 label (trip_days.label, 例「美瑛」) →「Day N」。
  const dayTitle = day?.title?.trim() || area || `Day ${dayNum}`;

  return (
    <section className="tp-day day-section" data-day={dayNum}>
      <style>{MAP_CHIP_STYLES}</style>
      {/* Terracotta Hero card */}
      <div className="tp-hero" id={`day${dayNum}`}>
        <div className="tp-hero-chips">
          <div className="tp-hero-chips-left">
            <span className="tp-hero-chip">
              {eyebrow}
              {dateLabel && ` · ${dateLabel}`}
            </span>
            {area && area !== dayTitle && <span className="tp-hero-chip-muted">{area}</span>}
          </div>
        </div>
        <h2 className="tp-hero-title">{dayTitle}</h2>
        {heroSub && <div className="tp-hero-sub">{heroSub}</div>}
      </div>

      <div
        key={animKey}
        className={clsx(animKey > 0 && 'day-content-enter', day && 'day-content-loaded')}
        id={`day-slot-${dayNum}`}
      >
        {!day ? (
          <DaySkeleton />
        ) : (
          <>
            {warnings.length > 0 && (
              <div className="py-3 px-4 my-2 rounded-sm text-callout" style={{ background: 'rgba(244, 140, 6, 0.08)', color: 'var(--color-warning)', borderLeft: '3px solid var(--color-warning)' }}>
                <strong><Icon name="warning" /> 注意事項：</strong>
                <ul className="mt-1 ml-4">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}

            {weatherDay && dayDate && dayId && (
              <HourlyWeather
                dayId={dayId}
                dayDate={dayDate}
                weatherDay={weatherDay}
                tripStart={tripStart}
                tripEnd={tripEnd}
                timezone={timezone}
              />
            )}

            {timeline.length > 0 && (
              <Timeline events={timelineEntries} dayDate={dayDate ?? null} localToday={localToday} dayId={dayId ?? null} />
            )}
          </>
        )}
      </div>
    </section>
  );
});

export default DaySection;
