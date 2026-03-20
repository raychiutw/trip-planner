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

/** Sheet height stop percentages (dvh). */
const STOPS = [50, 75, 90];
/** Minimum drag distance (px) to trigger a snap. */
const DRAG_THRESHOLD = 30;

/** Selectors for focusable elements inside the panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/* ===== Component ===== */

/**
 * Mobile bottom sheet overlay.
 * Supports drag-to-snap between 50%, 75%, 90% height stops,
 * and drag-down-to-close at the smallest stop.
 */
export default function InfoSheet({
  open,
  title,
  onClose,
  children,
}: InfoSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const [heightStyle, setHeightStyle] = useState<string>('');
  const dragStartY = useRef(0);
  const dragging = useRef(false);

  /* --- Reset height when opening --- */
  useEffect(() => {
    if (open) setHeightStyle('');
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

  /* --- Find nearest stop --- */
  const currentStop = useCallback((): number => {
    const panel = panelRef.current;
    if (!panel) return STOPS[0];
    const h = panel.offsetHeight;
    const vh = window.innerHeight;
    const pct = (h / vh) * 100;
    let best = STOPS[0];
    STOPS.forEach((s) => {
      if (Math.abs(s - pct) < Math.abs(best - pct)) best = s;
    });
    return best;
  }, []);

  /* --- Drag handlers --- */
  const handleDragStart = useCallback((y: number) => {
    dragging.current = true;
    dragStartY.current = y;
  }, []);

  const handleDragEnd = useCallback(
    (y: number) => {
      if (!dragging.current) return;
      dragging.current = false;
      const delta = dragStartY.current - y; // positive = drag up
      if (Math.abs(delta) < DRAG_THRESHOLD) return;

      const cur = currentStop();
      const idx = STOPS.indexOf(cur);

      if (delta > 0) {
        // Drag up -> next larger stop
        if (idx < STOPS.length - 1) {
          setHeightStyle(STOPS[idx + 1] + 'dvh');
        }
      } else {
        // Drag down -> next smaller stop or close
        if (idx > 0) {
          setHeightStyle(STOPS[idx - 1] + 'dvh');
        } else {
          setHeightStyle('');
          onClose();
        }
      }
    },
    [currentStop, onClose],
  );

  /* --- Touch handlers for handle + header --- */
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleDragStart(e.touches[0].clientY);
    },
    [handleDragStart],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragging.current) e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      handleDragEnd(e.changedTouches[0].clientY);
    },
    [handleDragEnd],
  );

  /* --- Prevent scroll passthrough on backdrop --- */
  const preventScroll = useCallback((e: React.TouchEvent | React.WheelEvent) => {
    e.preventDefault();
  }, []);

  /* --- Stop propagation on panel click --- */
  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  /* --- Stop propagation for sheet body scroll --- */
  const handleBodyTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

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
      onTouchMove={preventScroll as unknown as React.TouchEventHandler}
      onWheel={preventScroll as unknown as React.WheelEventHandler}
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

        {/* Body */}
        <div
          className="info-sheet-body"
          id="bottomSheetBody"
          onTouchMove={handleBodyTouchMove}
          onWheel={handleBodyWheel}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
