import { useEffect, useRef, type RefObject } from 'react';

/** Minimum ratio of horizontal to vertical displacement to qualify as a horizontal swipe. */
const SWIPE_DIRECTION_RATIO = 1.2;

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
  const callbackRef = useRef({ onSwipeLeft, onSwipeRight });

  useEffect(() => {
    callbackRef.current = { onSwipeLeft, onSwipeRight };
  });

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
      if (Math.abs(dx) < Math.abs(dy) * SWIPE_DIRECTION_RATIO) return;
      // Minimum distance: 50px
      if (Math.abs(dx) < 50) return;
      // Speed threshold: 0.3px/ms
      if (dt > 0 && Math.abs(dx) / dt < 0.3) return;

      if (dx < 0) {
        callbackRef.current.onSwipeLeft();
      } else {
        callbackRef.current.onSwipeRight();
      }
    }

    // passive: true — we never call preventDefault() in these handlers, so passive
    // improves scroll performance (allows browser to scroll without waiting for JS).
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, enabled]);
}
