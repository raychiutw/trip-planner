/**
 * DaySection — memoised per-day renderer.
 * Extracted from TripPage.tsx to reduce file size.
 */

import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import clsx from 'clsx';
import DaySkeleton from './DaySkeleton';
import Hotel from './Hotel';
import HourlyWeather from './HourlyWeather';
import Timeline from './Timeline';
import { DayDrivingStatsCard } from './DrivingStats';
import DayArt from './DayArt';
import Icon from '../shared/Icon';
import { toTimelineEntry, toHotelData } from '../../lib/mapDay';
import { calcDrivingStats } from '../../lib/drivingStats';
import { validateDay } from '../../lib/validateDay';
import { buildWeatherDay } from '../../lib/weather';
import type { Day, DaySummary } from '../../types/trip';
import type { ColorTheme } from '../../hooks/useDarkMode';

/* DayMap — React.lazy code-split（D1：SDK lazy load）*/
const DayMap = lazy(() => import('./DayMap'));

export interface DaySectionProps {
  dayNum: number;
  day: Day | undefined;
  daySummary: DaySummary | undefined;
  tripStart: string | null;
  tripEnd: string | null;
  themeArt?: { theme: ColorTheme; dark: boolean };
  localToday?: string;
  isActive?: boolean;
  /** 全覽模式時隱藏 DayMap（避免與 TripMap 重複）*/
  hideDayMap?: boolean;
  /** IANA timezone for weather API (derived from trip destination). */
  timezone?: string;
  /** Whether the DayMap feature flag is enabled. */
  enableDayMap?: boolean;
}

const DaySection = React.memo(function DaySection({
  dayNum,
  day,
  daySummary,
  tripStart,
  tripEnd,
  themeArt,
  localToday,
  isActive,
  hideDayMap = false,
  timezone,
  enableDayMap = false,
}: DaySectionProps) {
  /* Track whether this section has been activated to trigger enter animation */
  const [animKey, setAnimKey] = useState(0);
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      setAnimKey((k) => k + 1);
    }
    prevActiveRef.current = !!isActive;
  }, [isActive]);

  const hotel = day?.hotel;
  const timeline = day?.timeline ?? [];
  // Derive weather locations from entries (no longer stored in DB)
  const weatherDay = useMemo(
    () => buildWeatherDay(day?.label, timeline),
    [day?.label, timeline],
  );
  const dayDate = day?.date ?? daySummary?.date ?? undefined;
  const dayId = day?.id;

  const dayDrivingStats = useMemo(
    () => timeline.length > 0 ? calcDrivingStats(timeline) : null,
    [timeline],
  );

  const warnings = useMemo(() => validateDay(timeline), [timeline]);

  /* Memoised timeline entries — avoids new array reference on every render */
  const timelineEntries = useMemo(
    () => timeline.map((e) => typeof e === 'object' && e !== null ? toTimelineEntry(e) : toTimelineEntry({})),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day?.timeline],
  );

  return (
    <section className="day-section" data-day={dayNum}>
      <div className="day-header relative z-(--z-day-header) py-2 px-4 flex items-center gap-2 min-h-[100px] rounded-t-md" id={`day${dayNum}`}>
        <h2 className="text-title2 font-bold whitespace-nowrap overflow-hidden text-ellipsis m-0">Day {dayNum}</h2>
        {daySummary?.label && (
          <span>{daySummary.label}</span>
        )}
        {daySummary?.date && (
          <span className="text-subheadline text-muted ml-auto whitespace-nowrap">
            {daySummary.date}
            {daySummary.dayOfWeek && `（${daySummary.dayOfWeek}）`}
          </span>
        )}
        {themeArt && <DayArt entries={timeline} dark={themeArt.dark} />}
      </div>
      <div key={animKey} className={clsx('px-padding-h pb-4', animKey > 0 && 'day-content-enter', day && 'day-content-loaded')} id={`day-slot-${dayNum}`}>
        {!day ? (
          <DaySkeleton />
        ) : (
          <>
            {warnings.length > 0 && (
              <div className="bg-destructive-bg py-3 px-4 my-2 rounded-sm text-callout text-destructive">
                <strong><Icon name="warning" /> 注意事項：</strong>
                <ul className="mt-1 ml-4">
                  {warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
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
              <div className="mb-3 bg-tertiary/60 rounded-md p-padding-h">
                <Hotel hotel={toHotelData(hotel)} />
              </div>
            )}
            {dayDrivingStats && (
              <div className="mb-3 bg-tertiary/60 rounded-md p-padding-h">
                <DayDrivingStatsCard stats={dayDrivingStats} />
              </div>
            )}

            {/* DayMap：DayNav 下方、Timeline 上方（D1：React.lazy + Suspense）
                全覽模式（hideDayMap=true）時隱藏，由 TripMap 取代
                enableDayMap=false 時完全隱藏（feature flag）*/}
            {enableDayMap && !hideDayMap && (
              <Suspense fallback={<div className="h-[200px] rounded-sm bg-secondary animate-pulse" aria-label="地圖載入中" />}>
                <DayMap day={day} dayNum={dayNum} />
              </Suspense>
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
