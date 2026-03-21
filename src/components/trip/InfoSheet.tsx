import { useRef, useCallback, useEffect } from 'react';
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

/** Selectors for focusable elements inside the panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/* ===== Component ===== */

/**
 * Mobile bottom sheet overlay.
 *
 * Fixed height: 85dvh. Close via X button, backdrop click, or Escape key.
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
  // C.5: saved scroll position for iOS body lock
  const savedBodyScrollY = useRef(0);

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
      // Focus the sheet panel itself for keyboard accessibility (Escape key)
      // without focusing the close button (avoids orange focus ring issue)
      requestAnimationFrame(() => {
        panelRef.current?.focus();
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

  /* --- Fix 2: Passive event listener for scroll prevention on backdrop --- */
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const backdrop = backdropRef.current;
    if (!backdrop) return;

    // Only prevent scroll on the backdrop itself, not on child elements (panel body)
    const prevent = (e: Event) => {
      if (e.target === backdrop) e.preventDefault();
    };
    backdrop.addEventListener('wheel', prevent, { passive: false });
    backdrop.addEventListener('touchmove', prevent, { passive: false });

    return () => {
      backdrop.removeEventListener('wheel', prevent);
      backdrop.removeEventListener('touchmove', prevent);
    };
  }, [open]);

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
      ref={backdropRef}
      onClick={onClose}
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        className="info-sheet-panel"
        id="infoSheet"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        onClick={handlePanelClick}
        onKeyDown={handlePanelKeyDown}
      >
        {/* Drag handle (decorative only) */}
        <div className="sheet-handle" />

        {/* Header */}
        <div className="sheet-header">
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
          ref={bodyRef}
          onWheel={handleBodyWheel}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
