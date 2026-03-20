import React, { useRef, useCallback, useEffect, useState } from 'react';
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
}

/* ===== Component ===== */

export default function DayNav({ days, currentDayNum, onSwitchDay, todayDayNum }: DayNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [tooltipDay, setTooltipDay] = useState<number | null>(null);

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
        {days.map((d) => {
          const dayNum = d.day_num;
          const isActive = dayNum === currentDayNum;
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
              {isActive && d.label && (
                <span className="dn-active-label">{d.label}</span>
              )}
              {showTooltip && (
                <span id={tooltipId} className="dn-tooltip" role="tooltip">
                  {formatTooltip(d)}
                </span>
              )}
            </button>
          );
        })}
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
