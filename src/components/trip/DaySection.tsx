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
import { useTripId } from '../../contexts/TripIdContext';
import { useTripSegments, type TripSegment } from '../../hooks/useTripSegments';
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

/**
 * 每日累積距離 → km（rounded）。null = 無任何資料。
 *
 * 2026-07-07 user 回報「累積距離有問題」：原本 sum `entry.travel.distanceM` —
 * 那是 day fetch 當下的 snapshot（backend _merge 從 trip_segments lookup）。
 * 車程重算（self-healing / 顯式）完成後 segments refetch 了（TravelPill 立即
 * 顯示新值），day snapshot 卻要等 refetchDay — 累積 km 顯示舊值/漏段。
 * 改對齊 TravelPill 的 v2.31.8 pattern：**相鄰 pair 查 segmentMap 即時值優先**
 * （computed_at=NULL 的 stale 段不計 — 跟 pill 不顯示舊數字一致），缺 row 才
 * fallback prev.travel（離開 prev = 抵達 curr 的段）snapshot。
 */
export function getTotalKm(
  timeline: unknown[],
  segmentMap: Map<string, TripSegment>,
): number | null {
  let totalM = 0;
  let hasAny = false;
  for (let i = 0; i < timeline.length; i++) {
    const e = timeline[i];
    if (typeof e !== 'object' || e === null) continue;
    const id = (e as { id?: number | null }).id;
    const nextRaw = i + 1 < timeline.length ? timeline[i + 1] : null;
    const nextId = nextRaw && typeof nextRaw === 'object' ? (nextRaw as { id?: number | null }).id : null;

    // 即時值：本 entry → 下一 entry 的 segment（recompute 後自動 fresh）
    const seg = id != null && nextId != null ? segmentMap.get(`${id}-${nextId}`) : undefined;
    if (seg) {
      // stale（computed_at=NULL，換 POI 後等重算）不計舊值 — 對齊 pill 行為
      if (seg.computedAt != null && typeof seg.distanceM === 'number' && Number.isFinite(seg.distanceM)) {
        totalM += seg.distanceM;
        hasAny = true;
      }
      continue;
    }
    // fallback：segments 未載入 / pair 缺 row → day snapshot（travel 掛在
    // prev 上 = 離開本 entry 的段，v2.31.8 語意）
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
  // 2026-07-07：累積距離改吃 segments 即時值（TripPage provider 共用 fetch，
  // segmentUpdated 自動 refetch → 車程重算完 km 立即同步）
  const tripIdForSegments = useTripId();
  const { segmentMap } = useTripSegments(tripIdForSegments);
  const totalKm = useMemo(() => getTotalKm(timeline, segmentMap), [timeline, segmentMap]);
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

            {/* 2026-07-07 跨天拖拉：空日也 render（dndManaged 下 rail 顯示
              * 空 drop 槽）— 拖到還沒排的天是跨天最常見場景（codex review P1）。 */}
            <Timeline events={timelineEntries} dayDate={dayDate ?? null} localToday={localToday} dayId={dayId ?? null} dndManaged />
          </>
        )}
      </div>
    </section>
  );
});

export default DaySection;
