import React, { useRef, useCallback, useEffect, useState } from 'react';
import type { DaySummary } from '../../types/trip';

/* ===== Props ===== */

interface DayNavProps {
  days: DaySummary[];
  currentDayNum: number;
  onSwitchDay: (dayNum: number) => void;
}

/* ===== Component ===== */

export default function DayNav({ days, currentDayNum, onSwitchDay }: DayNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
      onSwitchDay(dayNum);
    },
    [onSwitchDay],
  );

  /* --- Build wrap class names --- */
  const wrapClassName = [
    'dh-nav-wrap',
    canScrollLeft ? 'can-scroll-left' : '',
    canScrollRight ? 'can-scroll-right' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClassName} ref={wrapRef}>
      <button
        className="dh-nav-arrow"
        aria-label="向左捲動"
        aria-hidden={!canScrollLeft}
        onClick={handleArrowLeft}
      >
        &#8249;
      </button>
      <div className="dh-nav" id="navPills" ref={navRef}>
        {days.map((d) => {
          const dayNum = d.day_num ?? d.id;
          const isActive = dayNum === currentDayNum;
          return (
            <button
              key={dayNum}
              className={`dn${isActive ? ' active' : ''}`}
              data-day={dayNum}
              data-action="switch-day"
              data-target={`day${dayNum}`}
              onClick={() => handleDayClick(dayNum)}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
      <button
        className="dh-nav-arrow"
        aria-label="向右捲動"
        aria-hidden={!canScrollRight}
        onClick={handleArrowRight}
      >
        &#8250;
      </button>
    </div>
  );
}
