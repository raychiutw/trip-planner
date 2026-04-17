import { useRef, useCallback, useEffect, useState, useLayoutEffect } from 'react';
import clsx from 'clsx';
import type { DaySummary } from '../../types/trip';

/* ===== Scoped styles (pseudo-elements + dark mode that Tailwind cannot express) ===== */

const SCOPED_STYLES = `
.dn-today-dot { width: 6px; height: 6px; }
body.dark [data-dn]:not(.active) { background: transparent; border: 1.5px solid var(--color-accent); }
@media (min-width: 1280px) { [data-dn] { font-size: var(--font-size-title3); } }
@keyframes dn-tooltip-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
`;

/* ===== Helpers ===== */

const WEEKDAYS = '日一二三四五六';

/** Format pill label: MM/DD */
export function formatPillLabel(day: DaySummary): string {
  if (!day.date) return String(day.dayNum);
  const d = new Date(day.date + 'T00:00:00');
  if (isNaN(d.getTime())) return String(day.dayNum);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  return `${mm}/${dd}`;
}

/** Format tooltip content */
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
  /** 全覽模式是否啟用 */
  isTripMapMode?: boolean;
  /** 切換全覽模式的 callback */
  onToggleTripMap?: () => void;
}

/* ===== Component ===== */

export default function DayNav({ days, currentDayNum, onSwitchDay, todayDayNum, isTripMapMode = false, onToggleTripMap }: DayNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [tooltipDay, setTooltipDay] = useState<number | null>(null);

  /* --- Sliding indicator state --- */
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(null);

  /* --- Update arrow visibility based on scroll position --- */
  const updateOverflow = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const sl = nav.scrollLeft;
    const sw = nav.scrollWidth;
    const cw = nav.clientWidth;
    setCanScrollLeft(sl > 2);
    setCanScrollRight(sl < sw - cw - 2);
  }, []);

  /* --- Scroll active pill into center view --- */
  const scrollPillIntoView = useCallback((btn: HTMLElement) => {
    const nav = navRef.current;
    if (!nav) return;
    const left = btn.offsetLeft - nav.offsetWidth / 2 + btn.offsetWidth / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, []);

  /* --- Cleanup timers on unmount --- */
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };
  }, []);

  /* --- Attach scroll + resize listeners --- */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Initial check
    updateOverflow();

    // Scroll listener
    nav.addEventListener('scroll', updateOverflow, { passive: true });

    // ResizeObserver
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateOverflow);
      observer.observe(nav);
    }

    return () => {
      nav.removeEventListener('scroll', updateOverflow);
      if (observer) observer.disconnect();
    };
  }, [updateOverflow, days]);

  /* --- Scroll active pill into view when currentDayNum changes --- */
  useEffect(() => {
    if (!currentDayNum || !navRef.current) return;
    const btn = navRef.current.querySelector<HTMLElement>(
      `[data-dn][data-day="${currentDayNum}"]`,
    );
    if (btn) scrollPillIntoView(btn);
  }, [currentDayNum, scrollPillIntoView]);

  /* --- Sliding indicator: compute position after layout --- */
  useLayoutEffect(() => {
    if (!navRef.current) return;
    // 全覽模式時，indicator 跟著「全覽」按鈕
    const nav = navRef.current;
    if (isTripMapMode) {
      const overviewBtn = nav.querySelector<HTMLElement>('[data-testid="dn-overview-btn"]');
      if (!overviewBtn) {
        setIndicatorStyle(null);
        return;
      }
      setIndicatorStyle({ left: overviewBtn.offsetLeft, width: overviewBtn.offsetWidth });
      return;
    }
    const activeBtn = nav.querySelector<HTMLElement>(`[data-dn][data-day="${currentDayNum}"]`);
    if (!activeBtn) {
      setIndicatorStyle(null);
      return;
    }
    setIndicatorStyle({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth });
  }, [currentDayNum, days, isTripMapMode]);

  /* --- Arrow click handlers --- */
  const handleArrowLeft = useCallback(() => {
    const nav = navRef.current;
    if (nav) nav.scrollBy({ left: -nav.clientWidth, behavior: 'smooth' });
  }, []);

  const handleArrowRight = useCallback(() => {
    const nav = navRef.current;
    if (nav) nav.scrollBy({ left: nav.clientWidth, behavior: 'smooth' });
  }, []);

  /* --- Day pill click --- */
  const handleDayClick = useCallback(
    (dayNum: number) => {
      setTooltipDay(null);
      onSwitchDay(dayNum);
    },
    [onSwitchDay],
  );

  /* --- Tooltip: Desktop hover --- */
  const handleMouseEnter = useCallback((dayNum: number) => {
    setTooltipDay(dayNum);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltipDay(null);
  }, []);

  /* --- Tooltip: Mobile long press --- */
  const handleTouchStart = useCallback((dayNum: number) => {
    longPressTimer.current = setTimeout(() => {
      setTooltipDay(dayNum);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Hide tooltip after a brief delay on touch
    tooltipTimer.current = setTimeout(() => setTooltipDay(null), 2000);
  }, []);

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="relative flex items-center min-w-0 ml-auto" ref={wrapRef}>
        {/* Left gradient fade mask */}
        <div
          className={clsx(
            'absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-1 bg-linear-to-r from-secondary to-transparent transition-opacity duration-fast ease-apple',
            canScrollLeft ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden="true"
        />
        {/* Right gradient fade mask */}
        <div
          className={clsx(
            'absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-1 bg-linear-to-l from-secondary to-transparent transition-opacity duration-fast ease-apple',
            canScrollRight ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden="true"
        />

        <button
          className="hidden md:flex items-center bg-transparent border-none text-accent text-title3 cursor-pointer p-2 min-w-tap-min focus-visible:outline-none aria-hidden:invisible"
          aria-label="向左捲動"
          aria-hidden={!canScrollLeft}
          tabIndex={canScrollLeft ? 0 : -1}
          disabled={!canScrollLeft}
          onClick={handleArrowLeft}
        >
          &#8249;
        </button>
        <div
          className="relative flex gap-2 flex-1 overflow-x-auto overflow-y-visible scroll-smooth py-1 md:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          id="navPills"
          ref={navRef}
        >
          {indicatorStyle && (
            <div
              className="absolute top-0 h-full bg-accent rounded-md opacity-15 pointer-events-none will-change-[transform,width]"
              aria-hidden="true"
              style={{
                // 用 apple ease-out 不 overshoot：sliding indicator 是橫向位置指示，
                // 不是 bottom sheet 的彈出感；spring overshoot（y1=1.28）會讓指示器
                // 在切換日期時衝過目標 pill 到隔壁格再彈回，視覺上像隔壁 pill 被錯標。
                transition: `transform var(--duration-indicator) var(--transition-timing-function-apple), width var(--duration-indicator) var(--transition-timing-function-apple)`,
                transform: `translateX(${indicatorStyle.left}px)`,
                width: indicatorStyle.width,
              }}
            />
          )}
          {days.map((d) => {
            const dayNum = d.dayNum;
            const isActive = !isTripMapMode && dayNum === currentDayNum;
            const isToday = dayNum === todayDayNum;
            const showTooltip = tooltipDay === dayNum;

            const tooltipId = `dn-tooltip-${dayNum}`;
            return (
              <button
                key={dayNum}
                className={clsx(
                  'dn relative z-1 flex items-center justify-center border-none py-2 px-3 rounded-md text-footnote font-semibold font-inherit min-w-tap-min min-h-tap-min text-center whitespace-nowrap transition-[background,color] duration-fast ease-apple',
                  isActive
                    ? 'active bg-accent text-accent-foreground'
                    : 'bg-accent-bg text-accent hover:bg-accent hover:text-accent-foreground',
                )}
                data-dn=""
                data-day={dayNum}
                data-action="switch-day"
                data-target={`day${dayNum}`}
                aria-label={d.label ? `${formatPillLabel(d)} ${d.label}` : formatPillLabel(d)}
                aria-describedby={showTooltip ? tooltipId : undefined}
                onClick={() => handleDayClick(dayNum)}
                onMouseEnter={() => handleMouseEnter(dayNum)}
                onMouseLeave={handleMouseLeave}
                onTouchStart={() => handleTouchStart(dayNum)}
                onTouchEnd={handleTouchEnd}
              >
                {formatPillLabel(d)}
                {/* Today marker dot */}
                {isToday && (
                  <span
                    className={clsx(
                      'dn-today-dot absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full',
                      isActive ? 'bg-accent-foreground' : 'bg-accent',
                    )}
                    aria-hidden="true"
                  />
                )}
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

          {/* 全覽按鈕（F006.5）：只在有切換 callback 時顯示 */}
          {onToggleTripMap && (
            <button
              className={clsx(
                'dn relative z-1 flex items-center justify-center border-none py-2 px-3 rounded-md text-footnote font-semibold font-inherit min-w-tap-min min-h-tap-min text-center whitespace-nowrap transition-[background,color] duration-fast ease-apple',
                isTripMapMode
                  ? 'active bg-accent text-accent-foreground'
                  : 'bg-accent-bg text-accent hover:bg-accent hover:text-accent-foreground',
              )}
              data-dn=""
              aria-label="全覽地圖"
              aria-pressed={isTripMapMode}
              onClick={onToggleTripMap}
              data-testid="dn-overview-btn"
              type="button"
            >
              全覽
            </button>
          )}
        </div>
        <button
          className="hidden md:flex items-center bg-transparent border-none text-accent text-title3 cursor-pointer p-2 min-w-tap-min focus-visible:outline-none aria-hidden:invisible"
          aria-label="向右捲動"
          aria-hidden={!canScrollRight}
          tabIndex={canScrollRight ? 0 : -1}
          disabled={!canScrollRight}
          onClick={handleArrowRight}
        >
          &#8250;
        </button>
      </div>
    </>
  );
}
