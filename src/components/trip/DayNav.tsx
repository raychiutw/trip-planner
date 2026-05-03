import { useRef, useEffect, useMemo } from 'react';
import type { DaySummary } from '../../types/trip';
import { parseLocalDate } from '../../lib/mapDay';
import { dayColor } from '../../lib/dayPalette';
import MapDayTab from './MapDayTab';

/**
 * DayNav — Trip detail page day strip。
 *
 * 視覺直接共用 MapPage 的 `<MapDayTab>` + `.tp-map-day-tabs` family，
 * 加上 `.tp-map-day-tabs--sticky` modifier 把 strip 黏在 TitleBar 下方。
 * Mockup spec: terracotta-preview-v2.html S20 underline tabs。
 * DESIGN.md: Day Nav (Trip Detail + Map page 共用視覺)。
 */

const WEEKDAYS = '日一二三四五六';

/** Exposed for unit test only; not part of the public component API. */
export function formatPillLabel(day: DaySummary): string {
  const d = parseLocalDate(day.date);
  if (!d) return String(day.dayNum);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildAriaLabel(day: DaySummary): string {
  const parts: string[] = [`Day ${day.dayNum}`];
  const d = parseLocalDate(day.date);
  if (d) parts.push(`${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`);
  if (day.label) parts.push(day.label);
  return parts.join(' — ');
}

export interface DayNavProps {
  days: DaySummary[];
  currentDayNum: number;
  onSwitchDay: (dayNum: number) => void;
  todayDayNum?: number;
  isTripMapMode?: boolean;
  onToggleTripMap?: () => void;
  /** Stop count per day (dayNum → count). Reserved for future progress marks. */
  stopsByDay?: Record<number, number>;
}

export default function DayNav({
  days,
  currentDayNum,
  onSwitchDay,
  todayDayNum,
  isTripMapMode = false,
  onToggleTripMap,
}: DayNavProps) {
  const navRef = useRef<HTMLElement>(null);

  // Scroll active tab into horizontal view on day switch
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLElement>(`[data-testid="dn-day-${currentDayNum}"]`);
    if (!btn) return;
    const left = btn.offsetLeft - nav.offsetWidth / 2 + btn.offsetWidth / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [currentDayNum]);

  const tabs = useMemo(
    () => days.map((d) => {
      const eyebrowBase = `DAY ${String(d.dayNum).padStart(2, '0')}`;
      const isToday = d.dayNum === todayDayNum;
      return {
        day: d,
        dayNum: d.dayNum,
        dayLabel: isToday ? `${eyebrowBase} · 今天` : eyebrowBase,
        dateLabel: formatPillLabel(d),
        color: dayColor(d.dayNum),
        ariaLabel: buildAriaLabel(d),
      };
    }),
    [days, todayDayNum],
  );

  return (
    <nav
      ref={navRef}
      id="navPills"
      className="tp-map-day-tabs tp-map-day-tabs--sticky"
      role="tablist"
      aria-label="行程日期"
    >
      {tabs.map(({ dayNum, dayLabel, dateLabel, color, ariaLabel }) => {
        const isActive = !isTripMapMode && dayNum === currentDayNum;
        return (
          <MapDayTab
            key={dayNum}
            dayLabel={dayLabel}
            dateLabel={dateLabel}
            dayColor={color}
            isActive={isActive}
            onClick={() => onSwitchDay(dayNum)}
            ariaLabel={ariaLabel}
            testId={`dn-day-${dayNum}`}
          />
        );
      })}

      {onToggleTripMap && (
        <MapDayTab
          dayLabel="MAP"
          dateLabel="全覽"
          isActive={isTripMapMode}
          onClick={onToggleTripMap}
          ariaLabel="全覽地圖"
          testId="dn-overview-btn"
        />
      )}
    </nav>
  );
}
