import { useState, useRef, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';

/* ===== Props ===== */

interface InfoSheetProps {
  /** Whether the sheet is currently open. */
  open: boolean;
  /** Title displayed in the sheet header. */
  title: string;
  /** Called when the sheet should close. */
  onClose: () => void;
  /** Content rendered inside the sheet body. */
  children: React.ReactNode;
}

/* ===== Constants ===== */

/** Minimum drag distance (px) to trigger a snap. */
const DRAG_THRESHOLD = 30;
/** Step size (px) for drag-to-snap height changes. */
const SNAP_STEP_PX = 120;
/** Minimum continuous move (px) to switch from scroll to drag mode (C.6). */
const SCROLL_TO_DRAG_THRESHOLD = 10;

/** Selectors for focusable elements inside the panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/* ===== Component ===== */

/**
 * Mobile bottom sheet overlay.
 *
 * C.4: Height is CSS `min(fit-content, 85dvh)` — no JS measurement needed.
 *      Drag snaps use px-based steps from the current height.
 * C.5: Body scroll lock uses iOS Safari safe pattern (position: fixed).
 * C.6: Scroll-to-top + pull down transitions into panel drag (shrink/close only).
 */
export default function InfoSheet({
  open,
  title,
  onClose,
  children,
}: InfoSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const [heightStyle, setHeightStyle] = useState<string>('');
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const lastTouchY = useRef(0);
  const lastTouchTime = useRef(0);
  const dragging = useRef(false);
  // C.5: saved scroll position for iOS body lock
  const savedBodyScrollY = useRef(0);
  // C.6: body-to-drag transition state
  const bodyDragMode = useRef(false);
  const bodyDragAccumulator = useRef(0);
  const bodyInitialScrollTop = useRef(0);

  /* --- Reset height when opening --- */
  useEffect(() => {
    if (open) setHeightStyle('');
  }, [open]);

  /* --- C.5: Body scroll lock (iOS Safari safe) --- */
  useEffect(() => {
    if (open) {
      savedBodyScrollY.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedBodyScrollY.current}px`;
      document.body.style.width = '100%';
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, savedBodyScrollY.current);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [open]);

  /* --- Focus management on open/close --- */
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      requestAnimationFrame(() => {
        closeBtnRef.current?.focus();
      });
    } else {
      if (previousFocusRef.current && previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    }
  }, [open]);

  /* --- Escape key handler --- */
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  /* --- Drag handlers --- */
  const handleDragStart = useCallback((y: number) => {
    dragging.current = true;
    panelRef.current?.classList.add('dragging');
    dragStartY.current = y;
    dragStartTime.current = Date.now();
    lastTouchY.current = y;
    lastTouchTime.current = Date.now();
  }, []);

  const handleDragEnd = useCallback(
    (y: number) => {
      if (!dragging.current) return;
      dragging.current = false;
      panelRef.current?.classList.remove('dragging');
      const panel = panelRef.current;
      const delta = dragStartY.current - y; // positive = drag up
      const dt = Date.now() - lastTouchTime.current;
      const velocity = dt > 0 ? (lastTouchY.current - y) / dt : 0; // px/ms, positive = up

      const useVelocity = Math.abs(velocity) > 0.5;

      if (!useVelocity && Math.abs(delta) < DRAG_THRESHOLD) return;

      const goUp = useVelocity ? velocity > 0 : delta > 0;
      const currentH = panel?.offsetHeight ?? 0;
      const maxH = window.innerHeight * 0.85;

      if (goUp) {
        // Expand: step up, clamped to max
        const nextH = Math.min(currentH + SNAP_STEP_PX, maxH);
        setHeightStyle(nextH + 'px');
      } else {
        // Shrink: step down, or close if already small
        const nextH = currentH - SNAP_STEP_PX;
        if (nextH < SNAP_STEP_PX) {
          setHeightStyle('');
          onClose();
        } else {
          setHeightStyle(nextH + 'px');
        }
      }
    },
    [onClose],
  );

  /* --- Touch handlers for handle + header --- */
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleDragStart(e.touches[0].clientY);
    },
    [handleDragStart],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragging.current) {
      e.preventDefault();
      lastTouchY.current = e.touches[0].clientY;
      lastTouchTime.current = Date.now();
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      handleDragEnd(e.changedTouches[0].clientY);
    },
    [handleDragEnd],
  );

  /* --- C.6: Native touch listener on body for { passive: false } --- */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !open) return;

    const onTouchStart = (e: TouchEvent) => {
      bodyDragMode.current = false;
      bodyDragAccumulator.current = 0;
      bodyInitialScrollTop.current = body.scrollTop;
      lastTouchY.current = e.touches[0].clientY;
      lastTouchTime.current = Date.now();
    };

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      const deltaY = lastTouchY.current - y; // positive = finger moving up

      if (bodyDragMode.current) {
        // Already in drag mode — prevent scrolling, track for panel resize
        e.preventDefault();
        e.stopPropagation();
        lastTouchY.current = y;
        lastTouchTime.current = Date.now();
        return;
      }

      // Only transition when at scroll top and pulling down (shrink/close)
      const atTop = body.scrollTop <= 0;
      const fingerDown = deltaY < 0;

      if (atTop && fingerDown) {
        bodyDragAccumulator.current += Math.abs(deltaY);
        if (bodyDragAccumulator.current > SCROLL_TO_DRAG_THRESHOLD) {
          bodyDragMode.current = true;
          handleDragStart(y);
          e.preventDefault();
          e.stopPropagation();
          lastTouchY.current = y;
          lastTouchTime.current = Date.now();
          return;
        }
      } else {
        bodyDragAccumulator.current = 0;
      }

      // Normal scroll — stop from reaching backdrop
      e.stopPropagation();
      lastTouchY.current = y;
      lastTouchTime.current = Date.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (bodyDragMode.current) {
        bodyDragMode.current = false;
        handleDragEnd(e.changedTouches[0].clientY);
      }
    };

    body.addEventListener('touchstart', onTouchStart, { passive: true });
    body.addEventListener('touchmove', onTouchMove, { passive: false });
    body.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      body.removeEventListener('touchstart', onTouchStart);
      body.removeEventListener('touchmove', onTouchMove);
      body.removeEventListener('touchend', onTouchEnd);
    };
  }, [open, handleDragStart, handleDragEnd]);

  /* --- Prevent scroll passthrough on backdrop --- */
  const preventTouchScroll = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
  }, []);

  const preventWheelScroll = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
  }, []);

  /* --- Stop propagation on panel click --- */
  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  /* --- Stop propagation for sheet body wheel --- */
  const handleBodyWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  /* --- Focus trap on Tab key --- */
  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  return (
    <div
      className={clsx('info-sheet-backdrop', open && 'open')}
      id="infoBottomSheet"
      onClick={onClose}
      onTouchMove={preventTouchScroll}
      onWheel={preventWheelScroll}
    >
      <div
        className="info-sheet-panel"
        id="infoSheet"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        style={heightStyle ? { height: heightStyle } : undefined}
        onClick={handlePanelClick}
        onKeyDown={handlePanelKeyDown}
      >
        {/* Drag handle */}
        <div
          className="sheet-handle"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Header (also draggable) */}
        <div
          className="sheet-header"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="sheet-header-spacer" />
          <span className="sheet-title" id="sheet-title">
            {title}
          </span>
          <button
            className="sheet-close-btn"
            id="sheetCloseBtn"
            aria-label="關閉"
            ref={closeBtnRef}
            onClick={onClose}
          >
            <Icon name="x-mark" />
          </button>
        </div>

        {/* Body — touch events handled via native addEventListener for { passive: false } */}
        <div
          className="info-sheet-body"
          id="bottomSheetBody"
          ref={bodyRef}
          onWheel={handleBodyWheel}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
