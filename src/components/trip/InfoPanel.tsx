import { useMemo } from 'react';
import Icon from '../shared/Icon';
import TodaySummary from './TodaySummary';
import { formatMinutes } from '../../lib/formatUtils';
import { calcDrivingStats } from '../../lib/drivingStats';
import { TRANSPORT_TYPE_ORDER } from '../../lib/constants';
import type { Day } from '../../types/trip';
import type { DocEntry } from './DocCard';

interface InfoPanelProps {
  /** Currently displayed day (for today summary + hotel + transport). */
  currentDay?: Day | null;
  /** All loaded days keyed by dayNum (for hotels list). */
  allDays?: Record<number, Day | undefined>;
  /** Ordered day numbers for whole trip (for progress + hotels list). */
  dayNums?: number[];
  /** Current day num (for progress indicator). */
  currentDayNum?: number;
  /** Flight doc entries (for flight overview card). */
  flightEntries?: DocEntry[];
}

interface HotelStay {
  nightLabel: string;
  name: string;
  area?: string;
}

function extractShortName(content: string): string {
  // Strip markdown and take first line of text content
  const plain = content.replace(/<[^>]+>/g, '').replace(/[*_`]/g, '').trim();
  return plain.split('\n')[0]?.trim() || '';
}

/** Collapse consecutive same-hotel days into "Night X-Y · Hotel" rows. */
function buildHotelStays(dayNums: number[] | undefined, allDays: Record<number, Day | undefined> | undefined): HotelStay[] {
  if (!dayNums || !allDays) return [];
  const stays: HotelStay[] = [];
  let prevName: string | null = null;
  let startIdx = -1;
  for (let i = 0; i < dayNums.length; i++) {
    const dn = dayNums[i];
    if (dn === undefined) continue;
    const day = allDays[dn];
    const hotelName = day?.hotel && typeof day.hotel === 'object' ? (day.hotel as { name?: string }).name : null;
    if (hotelName && hotelName !== prevName) {
      if (prevName && startIdx >= 0) {
        stays.push({
          nightLabel: i - 1 === startIdx ? `Night ${startIdx + 1}` : `Night ${startIdx + 1}-${startIdx + (i - startIdx)}`,
          name: prevName,
          area: typeof (allDays[dayNums[startIdx] ?? 0]?.hotel) === 'object' ? (allDays[dayNums[startIdx] ?? 0]!.hotel as { area?: string })?.area : undefined,
        });
        // reset tracker (trigger below)
      }
      prevName = hotelName;
      startIdx = i;
    } else if (!hotelName && prevName) {
      stays.push({
        nightLabel: i - 1 === startIdx ? `Night ${startIdx + 1}` : `Night ${startIdx + 1}-${i}`,
        name: prevName,
      });
      prevName = null;
      startIdx = -1;
    }
  }
  // Final flush
  if (prevName && startIdx >= 0) {
    const endIdx = dayNums.length - 1;
    stays.push({
      nightLabel: endIdx === startIdx ? `Night ${startIdx + 1}` : `Night ${startIdx + 1}-${endIdx + 1}`,
      name: prevName,
    });
  }
  return stays;
}

/** Ocean sidebar — 4 cards:
 *   - 整體進度 (Overall progress)
 *   - 今日行程 (Today timeline)
 *   - 住宿安排 (All-trip hotels)
 *   - 當日交通 (Today transport) + 航班 (Flight overview)
 */
export default function InfoPanel({
  currentDay,
  allDays,
  dayNums,
  currentDayNum,
  flightEntries,
}: InfoPanelProps) {
  const dayTransport = useMemo(() => {
    if (!currentDay) return null;
    return calcDrivingStats(currentDay.timeline);
  }, [currentDay]);

  const hotelStays = useMemo(() => buildHotelStays(dayNums, allDays), [dayNums, allDays]);

  const progressData = useMemo(() => {
    if (!dayNums || dayNums.length === 0) return null;
    const currentIdx = currentDayNum !== undefined ? dayNums.indexOf(currentDayNum) : -1;
    return { total: dayNums.length, currentIdx };
  }, [dayNums, currentDayNum]);

  return (
    <>
      {/* 整體進度 */}
      {progressData && (
        <div className="ocean-side-card">
          <div className="ocean-side-card-header">
            <span className="ocean-side-card-title">整體進度</span>
          </div>
          <div className="flex gap-1 mb-3">
            {Array.from({ length: progressData.total }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-sm"
                style={{
                  background:
                    i === progressData.currentIdx
                      ? 'var(--color-accent)'
                      : i < progressData.currentIdx
                        ? 'var(--color-foreground)'
                        : 'var(--color-border)',
                }}
              />
            ))}
          </div>
          <div className="text-caption text-muted">
            第 <b className="text-foreground">{progressData.currentIdx + 1}</b> 天，共 {progressData.total} 天
          </div>
        </div>
      )}

      {/* 今日行程 */}
      {currentDay && currentDay.timeline.length > 0 && (
        <div className="ocean-side-card">
          <div className="ocean-side-card-header">
            <span className="ocean-side-card-title">今日行程</span>
            <Icon name="clock" />
          </div>
          <TodaySummary entries={currentDay.timeline} />
        </div>
      )}

      {/* 住宿安排 (全程) */}
      {hotelStays.length > 0 && (
        <div className="ocean-side-card">
          <div className="ocean-side-card-header">
            <span className="ocean-side-card-title">住宿安排</span>
            <Icon name="hotel" />
          </div>
          <div className="flex flex-col">
            {hotelStays.map((h, i) => (
              <div
                key={i}
                className="py-2"
                style={{ borderBottom: i < hotelStays.length - 1 ? '1px solid var(--color-border)' : 'none' }}
              >
                <div className="text-caption2 font-semibold tracking-[0.18em] uppercase text-muted">
                  {h.nightLabel}
                </div>
                <div className="text-footnote font-bold mt-0.5">{h.name}</div>
                {h.area && <div className="text-caption text-muted">{h.area}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 當日交通 */}
      {dayTransport && (
        <div className="ocean-side-card">
          <div className="ocean-side-card-header">
            <span className="ocean-side-card-title">當日交通</span>
            <Icon name="bus" />
          </div>
          <div className="flex flex-col gap-2">
            {TRANSPORT_TYPE_ORDER.map((key) => {
              const g = dayTransport.byType[key];
              if (!g) return null;
              return (
                <div key={key} className="flex items-center gap-2 text-callout">
                  <Icon name={g.icon} />
                  <span className="flex-1 text-muted">{g.label}</span>
                  <span className="font-semibold tabular-nums">{formatMinutes(g.totalMinutes)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 航班 (trip-level overview — 緊湊 monospace 版) */}
      {flightEntries && flightEntries.length > 0 && (
        <div className="ocean-side-card">
          <div className="ocean-side-card-header">
            <span className="ocean-side-card-title">航班</span>
            <Icon name="plane" />
          </div>
          <div className="flex flex-col gap-3">
            {flightEntries.slice(0, 2).map((e, i) => {
              const isOutbound = /去程|outbound/i.test(e.title) || i === 0;
              return (
                <div key={e.id ?? i}>
                  <div className="text-caption2 font-semibold tracking-[0.18em] uppercase text-muted mb-1">
                    {isOutbound ? 'Outbound' : 'Return'}
                  </div>
                  <div className="text-caption font-mono leading-normal">
                    {extractShortName(e.content) || e.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
