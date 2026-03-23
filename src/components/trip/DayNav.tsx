import React, { useRef, useCallback, useEffect, useState, useLayoutEffect } from 'react';
import clsx from 'clsx';
import type { DaySummary } from '../../types/trip';

/* ===== Helpers ===== */

const WEEKDAYS = '日一二三四五六';

/** Format pill label: MM/DD */
export function formatPillLabel(day: DaySummary): string {
  if (!day.date) return String(day.day_num);
  const d = new Date(day.date + 'T00:00:00');
  if (isNaN(d.getTime())) return String(day.day_num);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  return `${mm}/${dd}`;
}

/** Format tooltip content */
function formatTooltip(day: DaySummary): string {
  const parts: string[] = [`Day ${day.day_num}`];
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

  /* --- Cleanup long-press timer on unmount --- */
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
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

    // Window resize fallback
    window.addEventListener('resize', updateOverflow, { passive: true });

    return () => {
      nav.removeEventListener('scroll', updateOverflow);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, [updateOverflow, days]);

  /* --- Scroll active pill into view when currentDayNum changes --- */
  useEffect(() => {
    if (!currentDayNum || !navRef.current) return;
    const btn = navRef.current.querySelector<HTMLElement>(
      `.dn[data-day="${currentDayNum}"]`,
    );
    if (btn) scrollPillIntoView(btn);
  }, [currentDayNum, scrollPillIntoView]);

  /* --- Sliding indicator: compute position after layout --- */
  useLayoutEffect(() => {
    if (!navRef.current) return;
    // 全覽模式時，indicator 跟著「全覽」按鈕
    const nav = navRef.current;
    if (isTripMapMode) {
      const overviewBtn = nav.querySelector<HTMLElement>('.dn-overview');
      if (!overviewBtn) {
        setIndicatorStyle(null);
        return;
      }
      setIndicatorStyle({ left: overviewBtn.offsetLeft, width: overviewBtn.offsetWidth });
      return;
    }
    const activeBtn = nav.querySelector<HTMLElement>(`.dn[data-day="${currentDayNum}"]`);
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
    setTimeout(() => setTooltipDay(null), 2000);
  }, []);

  /* --- Build wrap class names --- */
  const wrapClassName = clsx(
    'dh-nav-wrap',
    canScrollLeft && 'can-scroll-left',
    canScrollRight && 'can-scroll-right',
  );

  return (
    <div className={wrapClassName} ref={wrapRef}>
      <button
        className="dh-nav-arrow"
        aria-label="向左捲動"
        aria-hidden={!canScrollLeft}
        tabIndex={canScrollLeft ? 0 : -1}
        disabled={!canScrollLeft}
        onClick={handleArrowLeft}
      >
        &#8249;
      </button>
      <div className="dh-nav" id="navPills" ref={navRef}>
        {indicatorStyle && (
          <div
            className="dn-indicator"
            aria-hidden="true"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: indicatorStyle.width,
            }}
          />
        )}
        {days.map((d) => {
          const dayNum = d.day_num;
          const isActive = !isTripMapMode && dayNum === currentDayNum;
          const isToday = dayNum === todayDayNum;
          const showTooltip = tooltipDay === dayNum;

          const tooltipId = `dn-tooltip-${dayNum}`;
          return (
            <button
              key={dayNum}
              className={clsx('dn', isActive && 'active', isToday && 'dn-today')}
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
              {showTooltip && (
                <span id={tooltipId} className="dn-tooltip" role="tooltip">
                  {formatTooltip(d)}
                </span>
              )}
            </button>
          );
        })}

        {/* 全覽按鈕（F006.5）：只在有切換 callback 時顯示 */}
        {onToggleTripMap && (
          <button
            className={clsx('dn', 'dn-overview', isTripMapMode && 'active')}
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
        className="dh-nav-arrow"
        aria-label="向右捲動"
        aria-hidden={!canScrollRight}
        tabIndex={canScrollRight ? 0 : -1}
        disabled={!canScrollRight}
        onClick={handleArrowRight}
      >
        &#8250;
      </button>
    </div>
  );
}
