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
 *
 * a11y：用 `role="navigation"` 而非 `tablist` — DaySection panels 一直可見可
 * 捲動到 (scroll-to-anchor pattern)，不符合 tablist 「panels 互斥顯示」 語意。
 * 補 ArrowLeft/Right roving keyboard 給鍵盤 user 可水平在 day 之間切換。
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
}

export default function DayNav({
  days,
  currentDayNum,
  onSwitchDay,
  todayDayNum,
}: DayNavProps) {
  const navRef = useRef<HTMLElement>(null);
  // First-mount guard：初次 render 用 instant scroll (避免跟 #dayN anchor 的 vertical
  // smooth scroll 同時 fight，iOS Safari 看到 snap-back)。Subsequent day switches
  // 才走 smooth。
  const firstMountRef = useRef(true);

  // Scroll active tab into horizontal view on day switch
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLElement>(`[data-testid="dn-day-${currentDayNum}"]`);
    if (!btn) return;
    const left = btn.offsetLeft - nav.offsetWidth / 2 + btn.offsetWidth / 2;
    nav.scrollTo({
      left: Math.max(0, left),
      behavior: firstMountRef.current ? 'auto' : 'smooth',
    });
    firstMountRef.current = false;
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

  // Roving keyboard — ArrowLeft/Right 在 day buttons 之間移焦 + 切 day。
  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const idx = days.findIndex((d) => d.dayNum === currentDayNum);
    if (idx < 0) return;
    const nextIdx = e.key === 'ArrowLeft'
      ? Math.max(0, idx - 1)
      : Math.min(days.length - 1, idx + 1);
    if (nextIdx === idx) return;
    e.preventDefault();
    const nextDay = days[nextIdx];
    if (!nextDay) return;
    onSwitchDay(nextDay.dayNum);
    // Move focus to new active button so user can keep arrowing
    requestAnimationFrame(() => {
      const nav = navRef.current;
      const btn = nav?.querySelector<HTMLElement>(`[data-testid="dn-day-${nextDay.dayNum}"]`);
      btn?.focus();
    });
  }

  return (
    <nav
      ref={navRef}
      id="navPills"
      className="tp-map-day-tabs tp-map-day-tabs--sticky"
      aria-label="行程日期"
      onKeyDown={handleKeyDown}
    >
      {tabs.map(({ dayNum, dayLabel, dateLabel, color, ariaLabel }) => {
        const isActive = dayNum === currentDayNum;
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
    </nav>
  );
}
