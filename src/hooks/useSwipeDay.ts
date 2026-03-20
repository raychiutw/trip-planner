import { useEffect, type RefObject } from 'react';

interface UseSwipeDayOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  enabled?: boolean;
}

/**
 * Hook to detect horizontal swipe gestures on a container element.
 * Swipe left → onSwipeLeft (next day), Swipe right → onSwipeRight (prev day).
 */
export function useSwipeDay(
  containerRef: RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight, enabled = true }: UseSwipeDayOptions,
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      tracking = true;
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = Date.now() - startTime;

      // Must be primarily horizontal
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      // Minimum distance: 50px
      if (Math.abs(dx) < 50) return;
      // Speed threshold: 0.3px/ms
      if (dt > 0 && Math.abs(dx) / dt < 0.3) return;

      if (dx < 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, onSwipeLeft, onSwipeRight, enabled]);
}
