import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { DaySummary } from '../../types/trip';
import { parseLocalDate } from '../../lib/mapDay';
import { dayColor } from '../../lib/dayPalette';

/* ===== Scoped styles ===== */

/* DayNav — sticky underline tab strip (對齊 MapPage day tab 視覺 + sticky chrome)
 * 2026-05-03: 從 chip card pill 改 colorful text + active underline,跟
 * .tp-map-day-tab 同 family。Sticky 緊接 TitleBar (top 64/56px) 形成 sticky
 * chrome group。 */
const SCOPED_STYLES = `
.ocean-day-strip {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0 12px;
  margin: 0 -40px 20px;
  position: sticky;
  top: 64px;
  z-index: calc(var(--z-sticky-nav) - 1);
  background: color-mix(in srgb, var(--color-background) 92%, transparent);
  backdrop-filter: blur(var(--blur-glass, 14px));
  -webkit-backdrop-filter: blur(var(--blur-glass, 14px));
  border-bottom: 1px solid var(--color-border);
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 32px), transparent 100%);
  mask-image: linear-gradient(to right, black calc(100% - 32px), transparent 100%);
}
.ocean-day-strip::-webkit-scrollbar { display: none; }
@media (max-width: 1200px) {
  .ocean-day-strip { margin-left: -28px; margin-right: -28px; }
}
@media (max-width: 1100px) {
  .ocean-day-strip { top: 56px; }
}
@media (max-width: 760px) {
  .ocean-day-strip {
    margin: 0 0 16px;
  }
}
body.print-mode .ocean-day-strip { display: none; }

/* DayNav button — alias of .tp-map-day-tab visual (sticky chrome group with
 * MapPage). Colorful eyebrow per dayColor + active underline 2px。 */
[data-dn] {
  flex: 0 0 auto;
  padding: 6px 14px;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font: inherit;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-height: 44px;
  white-space: nowrap;
  transition: color 150ms, border-bottom-color 150ms;
}
[data-dn]:hover:not(.active) { color: var(--color-foreground); }
[data-dn].active {
  color: var(--color-accent);
  border-bottom-color: var(--day-color, var(--color-accent));
}
[data-dn] .dn-eyebrow {
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
  line-height: 1;
}
[data-dn].active .dn-eyebrow { opacity: 1; }
[data-dn] .dn-date {
  font-size: var(--font-size-footnote);
  font-weight: 600;
  line-height: 1;
  color: var(--color-foreground);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.005em;
}
[data-dn].active .dn-date { color: var(--color-accent); }

[data-dn] .dn-eyebrow-today {
  font-weight: 600;
  opacity: 0.8;
}
[data-dn] .dn-area {
  font-size: var(--font-size-caption2);
  opacity: 0.55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
  line-height: 1;
}

@keyframes dn-tooltip-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
`;

/* ===== Helpers ===== */

const WEEKDAYS = '日一二三四五六';
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Exposed for unit test only; not part of the public component API. */
export function formatPillLabel(day: DaySummary): string {
  const d = parseLocalDate(day.date);
  if (!d) return String(day.dayNum);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function parseChipParts(day: DaySummary): { eyebrow: string; date: string; dow: string; dowZh: string } {
  const eyebrow = `DAY ${String(day.dayNum).padStart(2, '0')}`;
  const d = parseLocalDate(day.date);
  if (!d) return { eyebrow, date: String(day.dayNum), dow: '', dowZh: '' };
  return {
    eyebrow,
    date: `${d.getMonth() + 1}/${d.getDate()}`,
    dow: WEEKDAYS_EN[d.getDay()] ?? '',
    dowZh: WEEKDAYS[d.getDay()] ?? '',
  };
}

function formatTooltip(day: DaySummary): string {
  const parts: string[] = [`Day ${day.dayNum}`];
  const d = parseLocalDate(day.date);
  if (d) parts.push(`${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`);
  if (day.label) parts.push(day.label);
  return parts.join(' — ');
}

/* ===== Props ===== */

interface DayNavProps {
  days: DaySummary[];
  currentDayNum: number;
  onSwitchDay: (dayNum: number) => void;
  todayDayNum?: number;
  isTripMapMode?: boolean;
  onToggleTripMap?: () => void;
  /** Stop count per day (dayNum → count). Used to render progress marks. */
  stopsByDay?: Record<number, number>;
}

/* ===== Component ===== */

export default function DayNav({ days, currentDayNum, onSwitchDay, todayDayNum, isTripMapMode = false, onToggleTripMap }: DayNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltipDay, setTooltipDay] = useState<number | null>(null);

  /* --- Cleanup timers on unmount --- */
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };
  }, []);

  /* --- Scroll active chip into view --- */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLElement>(`[data-dn][data-day="${currentDayNum}"]`);
    if (!btn) return;
    const left = btn.offsetLeft - nav.offsetWidth / 2 + btn.offsetWidth / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [currentDayNum]);

  const handleDayClick = useCallback((dayNum: number) => {
    onSwitchDay(dayNum);
  }, [onSwitchDay]);

  /* --- Hover/touch tooltip --- */
  const handleMouseEnter = useCallback((dayNum: number) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => setTooltipDay(dayNum), 400);
  }, []);
  const handleMouseLeave = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltipDay(null);
  }, []);
  const handleTouchStart = useCallback((dayNum: number) => {
    longPressTimer.current = setTimeout(() => setTooltipDay(dayNum), 500);
  }, []);
  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setTimeout(() => setTooltipDay(null), 1500);
  }, []);

  // Pre-compute per-chip data once per `days`/`todayDayNum` change so render loop
  // doesn't rerun parseChipParts + dayColor on every parent state update.
  const chips = useMemo(
    () => days.map((d) => {
      const color = dayColor(d.dayNum);
      return {
        day: d,
        dayNum: d.dayNum,
        parts: parseChipParts(d),
        isToday: d.dayNum === todayDayNum,
        btnStyle: { '--day-color': color } as React.CSSProperties,
        eyebrowStyle: { color } as React.CSSProperties,
      };
    }),
    [days, todayDayNum],
  );

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="ocean-day-strip" id="navPills" ref={navRef} role="tablist" aria-label="行程日期">
        {chips.map(({ day, dayNum, parts, isToday, btnStyle, eyebrowStyle }) => {
          const isActive = !isTripMapMode && dayNum === currentDayNum;
          const showTooltip = tooltipDay === dayNum;
          const tooltipId = `dn-tooltip-${dayNum}`;
          return (
            <button
              key={dayNum}
              className={clsx('dn', isActive && 'active')}
              data-dn=""
              data-day={dayNum}
              data-action="switch-day"
              data-target={`day${dayNum}`}
              aria-label={day.label ? `${formatPillLabel(day)} ${day.label}` : formatPillLabel(day)}
              aria-describedby={showTooltip ? tooltipId : undefined}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleDayClick(dayNum)}
              onMouseEnter={() => handleMouseEnter(dayNum)}
              onMouseLeave={handleMouseLeave}
              onTouchStart={() => handleTouchStart(dayNum)}
              onTouchEnd={handleTouchEnd}
              style={btnStyle}
            >
              {/* eyebrow (DAY 01) 套 per-day color, date 跟 active state 用 accent */}
              <span className="dn-eyebrow" style={eyebrowStyle}>
                {parts.eyebrow}
                {isToday && <span className="dn-eyebrow-today" aria-label="今日"> · 今天</span>}
              </span>
              <div className="dn-date">{parts.date}</div>
              {day.label && <div className="dn-area">{day.label}</div>}
              {showTooltip && (
                <span
                  id={tooltipId}
                  className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-secondary text-foreground text-caption font-medium py-2 px-3 rounded-sm shadow-md whitespace-nowrap z-10 pointer-events-none [animation:dn-tooltip-in_var(--transition-duration-fast)_var(--transition-timing-function-apple)]"
                  role="tooltip"
                >
                  {formatTooltip(day)}
                </span>
              )}
            </button>
          );
        })}

        {onToggleTripMap && (
          <button
            className={clsx('dn', isTripMapMode && 'active')}
            data-dn=""
            aria-label="全覽地圖"
            aria-pressed={isTripMapMode}
            onClick={onToggleTripMap}
            data-testid="dn-overview-btn"
            type="button"
          >
            {/* Overview button: no per-day color (用 accent fallback)。 */}
            <span className="dn-eyebrow">MAP</span>
            <div className="dn-date">全覽</div>
          </button>
        )}
      </div>
    </>
  );
}
