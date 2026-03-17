import { useState, useRef, useCallback, useEffect } from 'react';
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
  const [heightStyle, setHeightStyle] = useState<string>('');
  const dragStartY = useRef(0);
  const dragging = useRef(false);

  /* --- Reset height when opening --- */
  useEffect(() => {
    if (open) setHeightStyle('');
  }, [open]);

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

  return (
    <div
      className={`info-sheet-backdrop${open ? ' open' : ''}`}
      id="infoBottomSheet"
      onClick={onClose}
      onTouchMove={preventScroll as unknown as React.TouchEventHandler}
      onWheel={preventScroll as unknown as React.WheelEventHandler}
    >
      <div
        className="info-sheet-panel"
        id="infoSheet"
        ref={panelRef}
        style={heightStyle ? { height: heightStyle } : undefined}
        onClick={handlePanelClick}
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
          <span className="sheet-title" id="sheetTitle">
            {title}
          </span>
          <button
            className="sheet-close-btn"
            id="sheetCloseBtn"
            aria-label="關閉"
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
