import { useRef, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import type { DaySummary } from '../../types/trip';

/* ===== Scoped styles ===== */

const SCOPED_STYLES = `
.ocean-day-strip {
  display: flex; gap: 8px;
  overflow-x: auto; scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding: 0 0 4px 0;
  margin: 0 0 24px;
  scrollbar-width: thin;
}
.ocean-day-strip::-webkit-scrollbar { height: 6px; }
.ocean-day-strip::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
.ocean-day-strip::-webkit-scrollbar-track { background: transparent; }

[data-dn] {
  flex: 0 0 160px;
  scroll-snap-align: start;
  padding: 14px 14px 12px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-foreground);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: all var(--transition-duration-fast) var(--transition-timing-function-apple);
  position: relative;
}
[data-dn]:hover:not(.active) { border-color: var(--color-accent); }
[data-dn].active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }

[data-dn] .dn-head { display: flex; justify-content: space-between; align-items: center; }
[data-dn] .dn-eyebrow { font-size: 10px; font-weight: 600; letter-spacing: 0.18em; opacity: 0.55; text-transform: uppercase; }
[data-dn].active .dn-eyebrow { opacity: 0.7; }
[data-dn] .dn-weather { font-size: 11px; opacity: 0.55; display: inline-flex; align-items: center; gap: 3px; }
[data-dn].active .dn-weather { opacity: 0.7; }

[data-dn] .dn-date { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; line-height: 1; margin-top: 10px; }
[data-dn] .dn-dow { font-size: 12px; font-weight: 500; opacity: 0.55; margin-left: 6px; letter-spacing: 0.02em; }
[data-dn].active .dn-dow { opacity: 0.7; }

[data-dn] .dn-area { font-size: 12.5px; margin-top: 6px; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-dn].active .dn-area { opacity: 0.85; }

[data-dn] .dn-marks { display: flex; gap: 3px; margin-top: 12px; }
[data-dn] .dn-mark { width: 14px; height: 2px; background: var(--color-lineStrong, #C1C1C1); }
[data-dn].active .dn-mark { background: rgba(255,255,255,0.65); }

body.dark [data-dn]:not(.active) { background: transparent; border-color: var(--color-border); color: var(--color-foreground); }

@media (max-width: 760px) {
  [data-dn] { flex: 0 0 140px; padding: 12px 12px 10px; }
  [data-dn] .dn-date { font-size: 22px; }
}
@media (max-width: 480px) {
  [data-dn] { flex: 0 0 130px; }
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
                {isToday && <span className="dn-weather" aria-label="今日">● TODAY</span>}
              </div>
              <div className="dn-date">
                {parts.date}
                {parts.dow && <span className="dn-dow">{parts.dow}</span>}
              </div>
              {d.label && <div className="dn-area">{d.label}</div>}
              <div className="dn-marks" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (<span key={i} className="dn-mark" />))}
              </div>
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
            <div className="dn-marks" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (<span key={i} className="dn-mark" />))}
            </div>
          </button>
        )}
      </div>
    </>
  );
}
