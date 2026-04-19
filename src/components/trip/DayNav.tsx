import { useRef, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import type { DaySummary } from '../../types/trip';

/* ===== Scoped styles ===== */

const SCOPED_STYLES = `
.ocean-day-strip {
  display: flex; gap: 4px;
  overflow-x: auto; scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding: 0 40px;
  margin: -28px -40px 20px;
  scrollbar-width: thin;
  position: sticky;
  top: 64px;
  z-index: calc(var(--z-sticky-nav) - 1);
  background: var(--color-glass-nav);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
}
.ocean-day-strip::-webkit-scrollbar { height: 0; }
@media (max-width: 1200px) {
  .ocean-day-strip { padding-left: 28px; padding-right: 28px; margin-left: -28px; margin-right: -28px; margin-top: -24px; }
}
@media (max-width: 1100px) {
  .ocean-day-strip { top: 56px; }
}
body.print-mode .ocean-day-strip { display: none; }

/* === DESKTOP tab style (≥761px): underlined tabs, no border, no rounded bg === */
[data-dn] {
  flex: 0 0 auto;
  scroll-snap-align: start;
  padding: 10px 14px;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: color 160ms var(--transition-timing-function-apple),
              border-bottom-color 160ms var(--transition-timing-function-apple);
  position: relative;
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 36px;
  white-space: nowrap;
}
[data-dn]:hover:not(.active) { color: var(--color-foreground); }
[data-dn].active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
  background: transparent;
}

[data-dn] .dn-head { display: inline-flex; align-items: center; gap: 4px; }
[data-dn] .dn-eyebrow {
  font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
  opacity: 0.7; text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
[data-dn].active .dn-eyebrow { opacity: 1; }
[data-dn] .dn-weather {
  font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
  opacity: 0.75; text-transform: uppercase;
  padding: 2px 5px; border-radius: 4px;
  background: var(--color-accent-subtle); color: var(--color-accent);
}
[data-dn].active .dn-weather { opacity: 1; }

[data-dn] .dn-date {
  font-size: 14px; font-weight: 600;
  font-variant-numeric: tabular-nums; letter-spacing: -0.005em;
  line-height: 1;
  color: var(--color-foreground);
}
[data-dn].active .dn-date { color: var(--color-accent); }
[data-dn] .dn-dow {
  font-size: 11px; font-weight: 500;
  opacity: 0.55; margin-left: 4px; letter-spacing: 0.02em;
}
[data-dn].active .dn-dow { opacity: 0.75; }

[data-dn] .dn-area {
  font-size: 12px; opacity: 0.6;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 80px;
  padding-left: 6px;
  line-height: 1;
  position: relative;
}
[data-dn] .dn-area::before {
  content: "·"; position: absolute; left: -1px; opacity: 0.5;
}
[data-dn].active .dn-area { opacity: 0.8; }

body.dark [data-dn]:not(.active) { background: transparent; color: var(--color-muted); }

/* === MOBILE pill style (<761px): back to card-style snap-scroll === */
@media (max-width: 760px) {
  .ocean-day-strip {
    gap: 6px;
    padding: 4px 16px 6px;
    margin: -18px -16px 16px;
  }
  [data-dn] {
    padding: 7px 10px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    gap: 6px;
    min-height: 36px;
    color: var(--color-foreground);
  }
  [data-dn]:hover:not(.active) {
    border-color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }
  [data-dn].active {
    background: var(--color-accent);
    color: #fff;
    border-color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }
  [data-dn].active .dn-date { color: #fff; }
  [data-dn].active .dn-eyebrow { color: rgba(255,255,255,0.85); }
  [data-dn] .dn-date { font-size: 14px; color: var(--color-foreground); }
  [data-dn] .dn-area { max-width: 56px; padding-left: 6px; font-size: 11.5px; }
  [data-dn] .dn-area::before { display: none; }
  [data-dn] .dn-eyebrow { font-size: 9.5px; letter-spacing: 0.12em; }
  [data-dn] .dn-weather { background: rgba(0,0,0,0.06); color: var(--color-muted); }
  [data-dn].active .dn-weather { background: rgba(255,255,255,0.18); color: #fff; }
}

@keyframes dn-tooltip-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
`;

/* ===== Helpers ===== */

const WEEKDAYS = '日一二三四五六';
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatPillLabel(day: DaySummary): string {
  if (!day.date) return String(day.dayNum);
  const d = new Date(day.date + 'T00:00:00');
  if (isNaN(d.getTime())) return String(day.dayNum);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  return `${mm}/${dd}`;
}

function parseChipParts(day: DaySummary): { eyebrow: string; date: string; dow: string; dowZh: string } {
  const eyebrow = `DAY ${String(day.dayNum).padStart(2, '0')}`;
  if (!day.date) return { eyebrow, date: String(day.dayNum), dow: '', dowZh: '' };
  const d = new Date(day.date + 'T00:00:00');
  if (isNaN(d.getTime())) return { eyebrow, date: String(day.dayNum), dow: '', dowZh: '' };
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  return { eyebrow, date: `${mm}/${dd}`, dow: WEEKDAYS_EN[d.getDay()] ?? '', dowZh: WEEKDAYS[d.getDay()] ?? '' };
}

function formatTooltip(day: DaySummary): string {
  const parts: string[] = [`Day ${day.dayNum}`];
  if (day.date) {
    const d = new Date(day.date + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      const mm = d.getMonth() + 1;
      const dd = d.getDate();
      parts.push(`${mm}/${dd}（${WEEKDAYS[d.getDay()]}）`);
    }
  }
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

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="ocean-day-strip" id="navPills" ref={navRef} role="tablist" aria-label="行程日期">
        {days.map((d) => {
          const dayNum = d.dayNum;
          const isActive = !isTripMapMode && dayNum === currentDayNum;
          const isToday = dayNum === todayDayNum;
          const showTooltip = tooltipDay === dayNum;
          const tooltipId = `dn-tooltip-${dayNum}`;
          const parts = parseChipParts(d);
          return (
            <button
              key={dayNum}
              className={clsx('dn', isActive && 'active')}
              data-dn=""
              data-day={dayNum}
              data-action="switch-day"
              data-target={`day${dayNum}`}
              aria-label={d.label ? `${formatPillLabel(d)} ${d.label}` : formatPillLabel(d)}
              aria-describedby={showTooltip ? tooltipId : undefined}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleDayClick(dayNum)}
              onMouseEnter={() => handleMouseEnter(dayNum)}
              onMouseLeave={handleMouseLeave}
              onTouchStart={() => handleTouchStart(dayNum)}
              onTouchEnd={handleTouchEnd}
            >
              <div className="dn-head">
                <span className="dn-eyebrow">{parts.eyebrow}</span>
                {isToday && <span className="dn-weather" aria-label="今日">TODAY</span>}
              </div>
              <div className="dn-date">
                {parts.date}
                {parts.dow && <span className="dn-dow">{parts.dow}</span>}
              </div>
              {d.label && <div className="dn-area">{d.label}</div>}
              {showTooltip && (
                <span
                  id={tooltipId}
                  className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-secondary text-foreground text-caption font-medium py-2 px-3 rounded-sm shadow-md whitespace-nowrap z-10 pointer-events-none [animation:dn-tooltip-in_var(--transition-duration-fast)_var(--transition-timing-function-apple)]"
                  role="tooltip"
                >
                  {formatTooltip(d)}
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
            <div className="dn-head">
              <span className="dn-eyebrow">MAP</span>
            </div>
            <div className="dn-date">全覽</div>
            <div className="dn-area">所有日程</div>
          </button>
        )}
      </div>
    </>
  );
}
