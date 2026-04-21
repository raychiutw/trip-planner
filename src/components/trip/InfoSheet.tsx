import { useRef, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';
import { useSheetBehavior } from '../../hooks/useSheetBehavior';

/* ===== Scoped styles (dark mode + focus management) ===== */

const SCOPED_STYLES = `
body.dark [data-info-sheet-panel] {
  background: color-mix(in srgb, var(--color-secondary) 95%, var(--color-accent) 5%);
  box-shadow: 0 -1px 0 rgba(255,255,255,0.06), 0 -8px 30px rgba(0,0,0,0.5);
}
[data-info-sheet-panel] :focus:not(:focus-visible) { outline: none; box-shadow: none; }
[data-info-sheet-panel]:focus { outline: none; box-shadow: none; }
@media (max-width: 767px) {
  [data-info-sheet-panel] { height: 75vh; min-height: 280px; }
  @supports (height: 1dvh) { [data-info-sheet-panel] { height: 75dvh; } }
  [data-info-sheet-panel].detent-full { height: 100vh; }
  @supports (height: 1dvh) { [data-info-sheet-panel].detent-full { height: 100dvh; } }
  [data-info-sheet-panel] {
    transition: transform var(--transition-duration-slow) var(--transition-timing-function-apple),
                height var(--transition-duration-slow) var(--transition-timing-function-apple);
  }
  [data-info-sheet-panel] [data-sheet-close-btn] {
    position: absolute;
    width: 1px; height: 1px; overflow: hidden;
    clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; padding: 0;
  }
  [data-info-sheet-panel]:not(.detent-full) [data-info-sheet-body]::after {
    content: '';
    position: sticky; bottom: 0; display: block; height: 24px;
    background: linear-gradient(transparent, var(--color-secondary));
    pointer-events: none;
  }
}
`;

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

/** Mobile breakpoint — keep in sync with @media (max-width: 767px) in SCOPED_STYLES */
const MOBILE_BREAKPOINT = 768;

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
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  /* --- Multi-detent state (mobile only) --- */
  const [detent, setDetent] = useState<'half' | 'full'>('half');

  // ref to avoid re-binding touch listeners on every detent change
  const detentRef = useRef(detent);
  detentRef.current = detent;

  // ref wrapper so touch/escape effects don't re-bind when onClose identity changes
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // reset detent synchronously on close to avoid flash when re-opening
  const handleClose = useCallback(() => {
    setDetent('half');
    onCloseRef.current();
  }, []);

  /* --- useSheetBehavior: container class, scroll lock, focus, escape, focus trap, backdrop scroll --- */
  const { panelRef, backdropRef, handlePanelKeyDown } = useSheetBehavior(open, handleClose, {
    restorePreviousFocus: true,
  });

  /* --- Touch gesture for multi-detent (mobile only) --- */
  const isDragging = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (window.innerWidth >= MOBILE_BREAKPOINT) return;

    const panel = panelRef.current;
    const body = bodyRef.current;
    if (!panel || !body) return;

    let startY = 0;
    let currentTranslateY = 0;

    const onTouchStart = (e: TouchEvent) => {
      const handle = panel.querySelector('[data-sheet-handle]');
      const isOnHandle = handle?.contains(e.target as Node);
      const isAtTop = body.scrollTop <= 0;
      const d = detentRef.current;

      if (d === 'half' || isOnHandle || (d === 'full' && isAtTop)) {
        startY = e.touches[0]!.clientY;
        isDragging.current = true;
        currentTranslateY = 0;
        panel.style.transition = 'none';
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const deltaY = e.touches[0]!.clientY - startY;
      const d = detentRef.current;

      if (d === 'full' && deltaY < 0) {
        isDragging.current = false;
        panel.style.transition = '';
        panel.style.transform = '';
        return;
      }

      if (d === 'half' && deltaY > 0) {
        e.preventDefault();
        currentTranslateY = deltaY;
        panel.style.transform = `translateY(${deltaY}px)`;
      } else if (d === 'half' && deltaY < 0) {
        e.preventDefault();
        currentTranslateY = deltaY;
        panel.style.transform = `translateY(${deltaY * 0.3}px)`;
      } else if (d === 'full' && deltaY > 0) {
        e.preventDefault();
        currentTranslateY = deltaY;
        panel.style.transform = `translateY(${deltaY}px)`;
      }
    };

    const onTouchEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      panel.style.transition = '';
      panel.style.transform = '';

      const d = detentRef.current;
      const expandThreshold = 60;
      const closeThreshold = 100;
      const collapseThreshold = 60;

      if (d === 'half') {
        if (currentTranslateY < -expandThreshold) {
          setDetent('full');
        } else if (currentTranslateY > closeThreshold) {
          handleClose();
        }
      } else if (d === 'full') {
        if (currentTranslateY > collapseThreshold) {
          setDetent('half');
        }
      }

      currentTranslateY = 0;
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: false });
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('touchend', onTouchEnd);

    return () => {
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
    };
  }, [open, handleClose, panelRef]);

  /* --- Stop propagation on panel click --- */
  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  /* --- Stop propagation for sheet body wheel --- */
  const handleBodyWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        className={clsx(
          'fixed inset-0 bg-overlay transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        style={{ zIndex: 'var(--z-info-sheet-backdrop)', transitionDuration: 'var(--transition-duration-slow)', transitionTimingFunction: 'var(--transition-timing-function-apple)' }}
        id="infoBottomSheet"
        ref={backdropRef}
        onClick={handleClose}
      >
        <div
          className={clsx(detent === 'full' && 'detent-full')}
          data-info-sheet-panel
          id="infoSheet"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
          tabIndex={-1}
          onClick={handlePanelClick}
          onKeyDown={handlePanelKeyDown}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '75vh',
            background: 'color-mix(in srgb, var(--color-secondary) 94%, transparent)',
            WebkitBackdropFilter: 'blur(var(--blur-glass, 14px))',
            backdropFilter: 'blur(var(--blur-glass, 14px))',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            zIndex: 'var(--z-info-sheet)',
            transform: open ? 'translateY(0)' : 'translateY(100%)',
            transition: open
              ? 'transform var(--duration-sheet-open) var(--ease-spring)'
              : 'transform var(--duration-sheet-close) var(--ease-sheet-close)',
            display: 'flex',
            flexDirection: 'column',
            padding: '12px var(--spacing-padding-h) max(24px, env(safe-area-inset-bottom))',
            overscrollBehavior: 'contain',
          }}
        >
          {/* Drag handle (decorative only) */}
          <div
            data-sheet-handle
            className="w-10 h-1 rounded-full bg-muted mx-auto mt-3 mb-1"
          />

          {/* Header */}
          <div
            className="grid items-center mb-2"
            style={{ gridTemplateColumns: 'var(--spacing-tap-min) 1fr var(--spacing-tap-min)' }}
          >
            <div className="w-tap-min shrink-0" />
            <span
              className="flex-1 min-w-0 text-title3 font-bold text-foreground text-center overflow-hidden text-ellipsis whitespace-nowrap"
              id="sheet-title"
            >
              {title}
            </span>
            <button
              data-sheet-close-btn
              className="flex items-center justify-center w-tap-min h-tap-min border-none rounded-full bg-transparent text-foreground shrink-0 transition-colors duration-fast hover:text-accent hover:bg-accent-bg focus:outline-none"
              id="sheetCloseBtn"
              aria-label="關閉"
              ref={closeBtnRef}
              onClick={handleClose}
            >
              <Icon name="x-mark" />
            </button>
          </div>

          {/* Body */}
          <div
            data-info-sheet-body
            className="overflow-y-auto text-body flex-1 min-h-0"
            style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
            id="bottomSheetBody"
            ref={bodyRef}
            onWheel={handleBodyWheel}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
