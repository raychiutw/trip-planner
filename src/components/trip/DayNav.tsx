import { useMemo } from 'react';
import type { DaySummary } from '../../types/trip';
import { parseLocalDate } from '../../lib/mapDay';
import { useDayStripNav } from '../../hooks/useDayStripNav';
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
  // 置中捲入 + ArrowLeft/Right roving 共用邏輯（與 MapPage day strip 同一份）。
  const { navRef, handleKeyDown } = useDayStripNav<number>({
    keys: useMemo(() => days.map((d) => d.dayNum), [days]),
    activeKey: currentDayNum,
    onPick: onSwitchDay,
    testId: (n) => `dn-day-${n}`,
  });

  const tabs = useMemo(
    () => days.map((d) => {
      const eyebrowBase = `DAY ${d.dayNum}`;
      const isToday = d.dayNum === todayDayNum;
      return {
        day: d,
        dayNum: d.dayNum,
        dayLabel: isToday ? `${eyebrowBase} · 今天` : eyebrowBase,
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
      aria-label="行程日期"
      onKeyDown={handleKeyDown}
    >
      {tabs.map(({ dayNum, dayLabel, ariaLabel }) => {
        const isActive = dayNum === currentDayNum;
        return (
          <MapDayTab
            key={dayNum}
            dayLabel={dayLabel}
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
