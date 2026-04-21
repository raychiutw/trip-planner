/**
 * DaySection — memoised per-day renderer (Ocean design).
 *
 * Renders:
 *  - Ocean hero card (Day eyebrow + title + date + stats)
 *  - Weather, hotel, driving stats cards
 *  - Timeline stop cards
 */

import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { extractPinsFromDay } from '../../hooks/useMapData';
import type { Day, DaySummary } from '../../types/trip';

/* ===== Map expand button (scoped styles) ===== */
const MAP_EXPAND_STYLES = `
.map-expand-wrap { position: relative; }
.map-expand-btn {
  position: absolute; top: 10px; right: 10px; z-index: 400;
  width: 34px; height: 34px; border-radius: 10px;
  display: grid; place-items: center;
  background: var(--color-background); border: 1px solid var(--color-border);
  color: var(--color-foreground); cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  text-decoration: none;
  transition: border-color 160ms var(--transition-timing-function-apple),
              color 160ms var(--transition-timing-function-apple);
}
.map-expand-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
`;

function MapExpandBtn({ href, onClick, label = '地圖全螢幕' }: { href: string; onClick: (e: React.MouseEvent) => void; label?: string }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="map-expand-btn"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
    </a>
  );
}

const OceanMap = lazy(() => import('./OceanMap'));

export interface DaySectionProps {
  dayNum: number;
  day: Day | undefined;
  daySummary: DaySummary | undefined;
  tripStart: string | null;
  tripEnd: string | null;
  themeArt?: { dark: boolean };
  localToday?: string;
  isActive?: boolean;
  hideDayMap?: boolean;
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
  hideDayMap = false,
  timezone,
}: DaySectionProps) {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
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

  return (
    <section className="ocean-day day-section" data-day={dayNum}>
      {/* Ocean Hero card */}
      <div className="ocean-hero" id={`day${dayNum}`}>
        <div className="ocean-hero-chips">
          <span className="ocean-hero-chip">
            {eyebrow}
            {dateLabel && ` · ${dateLabel}`}
          </span>
          {area && <span className="ocean-hero-chip-muted">{area}</span>}
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

            {!hideDayMap && day && (() => {
              const { pins } = extractPinsFromDay(day);
              if (pins.length === 0) return null;
              return (
                <>
                  <style>{MAP_EXPAND_STYLES}</style>
                  <div className="map-expand-wrap">
                    <Suspense fallback={<div className="h-[420px] rounded-md bg-secondary animate-pulse" aria-label="地圖載入中" />}>
                      <OceanMap pins={pins} mode="overview" />
                    </Suspense>
                    {tripId && (
                      <MapExpandBtn
                        href={`/trip/${tripId}/map?day=${dayNum}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/trip/${tripId}/map?day=${dayNum}`); }}
                        label={`地圖全螢幕（Day ${dayNum}）`}
                      />
                    )}
                  </div>
                </>
              );
            })()}

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
