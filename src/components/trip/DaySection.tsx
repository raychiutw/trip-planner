/**
 * DaySection — memoised per-day renderer (Ocean design).
 *
 * Renders:
 *  - Ocean hero card (Day eyebrow + 看地圖 chip + title + date + stats)
 *  - Weather, hotel, driving stats cards
 *  - Timeline stop cards
 *
 * PR3 change: inline OceanMap removed. Each day hero now has a 「看地圖」
 * chip linking to /trip/:id/map?day=N.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import clsx from 'clsx';
import DaySkeleton from './DaySkeleton';
import Hotel from './Hotel';
import HourlyWeather from './HourlyWeather';
import Timeline from './Timeline';
import { DayDrivingStatsCard } from './DrivingStats';
import Icon from '../shared/Icon';
import { toTimelineEntry, toHotelData } from '../../lib/mapDay';
import { calcDrivingStats } from '../../lib/drivingStats';
import { validateDay } from '../../lib/validateDay';
import { buildWeatherDay } from '../../lib/weather';
import type { Day, DaySummary } from '../../types/trip';

/* ===== 看地圖 chip + hero chips layout (scoped styles) ===== */
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
.ocean-hero-chips {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 6px;
}
.ocean-hero-chips-left {
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
  const { tripId } = useParams<{ tripId: string }>();
  const [animKey, setAnimKey] = useState(0);
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevActiveRef.current) setAnimKey((k) => k + 1);
    prevActiveRef.current = !!isActive;
  }, [isActive]);

  const hotel = day?.hotel;
  const timeline = day?.timeline ?? [];
  const weatherDay = useMemo(() => buildWeatherDay(day?.label, timeline), [day?.label, timeline]);
  const dayDate = day?.date ?? daySummary?.date ?? undefined;
  const dayId = day?.id;

  const dayDrivingStats = useMemo(
    () => timeline.length > 0 ? calcDrivingStats(timeline) : null,
    [timeline],
  );
  const warnings = useMemo(() => validateDay(timeline), [timeline]);
  const bounds = useMemo(() => getTimelineBounds(timeline), [timeline]);

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

  const mapHref = tripId ? `/trip/${tripId}/map?day=${dayNum}` : null;

  return (
    <section className="ocean-day day-section" data-day={dayNum}>
      <style>{MAP_CHIP_STYLES}</style>
      {/* Ocean Hero card */}
      <div className="ocean-hero" id={`day${dayNum}`}>
        <div className="ocean-hero-chips">
          <div className="ocean-hero-chips-left">
            <span className="ocean-hero-chip">
              {eyebrow}
              {dateLabel && ` · ${dateLabel}`}
            </span>
            {area && <span className="ocean-hero-chip-muted">{area}</span>}
          </div>
          {mapHref && (
            <Link
              to={mapHref}
              className="day-map-chip"
              aria-label={`DAY ${String(dayNum).padStart(2, '0')} 地圖`}
            >
              <Icon name="map" />
              看地圖
            </Link>
          )}
        </div>
        <h2 className="ocean-hero-title">{area || `Day ${dayNum}`}</h2>
        <div className="ocean-hero-stats">
          <div className="ocean-hero-stat">
            <div className="ocean-hero-stat-label">Stops</div>
            <div className="ocean-hero-stat-value">{timeline.length || '—'}</div>
          </div>
          {bounds.start && (
            <div className="ocean-hero-stat">
              <div className="ocean-hero-stat-label">Start</div>
              <div className="ocean-hero-stat-value">{bounds.start}</div>
            </div>
          )}
          {bounds.end && (
            <div className="ocean-hero-stat">
              <div className="ocean-hero-stat-label">End</div>
              <div className="ocean-hero-stat-value">{bounds.end}</div>
            </div>
          )}
        </div>
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

            {hotel && typeof hotel === 'object' && (
              <div className="ocean-side-card mb-3">
                <Hotel hotel={toHotelData(hotel)} />
              </div>
            )}
            {dayDrivingStats && (
              <div className="ocean-side-card mb-3">
                <DayDrivingStatsCard stats={dayDrivingStats} />
              </div>
            )}

            {timeline.length > 0 && (
              <Timeline events={timelineEntries} dayDate={dayDate ?? null} localToday={localToday} />
            )}
          </>
        )}
      </div>
    </section>
  );
});

export default DaySection;
