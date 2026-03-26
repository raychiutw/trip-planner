import { useState, useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

/* ===== Scoped styles (dark mode + focus management + print) ===== */

const SCOPED_STYLES = `
body.dark [data-qp-item] {
  box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset;
}
body.dark [data-qp-trigger] {
  box-shadow: 0 0 20px color-mix(in srgb, var(--color-accent) 30%, transparent),
              0 2px 8px rgba(0,0,0,0.4);
}
body.dark [data-qp-sheet] {
  box-shadow: 0 -1px 0 rgba(255,255,255,0.06),
              0 -8px 30px rgba(0,0,0,0.5);
}
[data-qp-sheet] :focus:not(:focus-visible) { outline: none; box-shadow: none; }
[data-qp-sheet]:focus { outline: none; box-shadow: none; }
.print-mode [data-qp-root], .print-mode [data-qp-trigger] { display: none !important; }
@media print { [data-qp-root], [data-qp-trigger] { display: none !important; } }
@media (max-width: 390px) {
  [data-qp-item-bottom] { padding: var(--spacing-1) var(--spacing-half); font-size: var(--font-size-caption2); }
}
@media (max-width: 350px) {
  [data-qp-grid] { grid-template-columns: repeat(2, 1fr); }
  [data-qp-grid-bottom] { grid-template-columns: repeat(3, 1fr); }
}
`;

/* ===== Panel item config ===== */

type PanelAction = 'sheet' | 'print' | 'download';

interface PanelItemConfig {
  key: string;
  icon: string;
  label: string;
  action: PanelAction;
  section?: 'A' | 'B' | 'C';
}

const PANEL_ITEMS: PanelItemConfig[] = [
  // Section A: 行程資訊
  { key: 'flights', icon: 'plane', label: '航班', action: 'sheet', section: 'A' },
  { key: 'checklist', icon: 'check-circle', label: '出發', action: 'sheet', section: 'A' },
  { key: 'emergency', icon: 'emergency', label: '緊急', action: 'sheet', section: 'A' },
  { key: 'backup', icon: 'backup', label: '備案', action: 'sheet', section: 'A' },
  // Section B row 1: 行程工具
  { key: 'suggestions', icon: 'lightbulb', label: '解籤', action: 'sheet', section: 'B' },
  { key: 'today-route', icon: 'route', label: '路線', action: 'sheet', section: 'B' },
  { key: 'driving', icon: 'car', label: '交通', action: 'sheet', section: 'B' },
  // Section B row 2: 快捷設定（#9: 標題與 InfoSheet 一致）
  { key: 'trip-select', icon: 'swap-horiz', label: '切換行程', action: 'sheet', section: 'B' },
  { key: 'appearance', icon: 'palette', label: '外觀主題', action: 'sheet', section: 'B' },
  // Section C: 匯出
  { key: 'printer', icon: 'printer', label: '列印', action: 'print', section: 'C' },
  { key: 'download-pdf', icon: 'download', label: 'PDF', action: 'download', section: 'C' },
  { key: 'download-md', icon: 'doc', label: 'MD', action: 'download', section: 'C' },
  { key: 'download-json', icon: 'code', label: 'JSON', action: 'download', section: 'C' },
  { key: 'download-csv', icon: 'table', label: 'CSV', action: 'download', section: 'C' },
];

/* ===== Constants ===== */

/** Selectors for focusable elements inside the panel (same as InfoSheet). */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/* ===== Props ===== */

interface QuickPanelProps {
  onItemClick: (contentKey: string) => void;
  onPrint: () => void;
  onDownload: (format: string) => void;
  isOnline?: boolean;
}

/* ===== Component ===== */

/** Write actions that should be disabled when offline. */
const WRITE_KEYS = new Set(['trip-select']);

export default function QuickPanel({
  onItemClick,
  onPrint,
  onDownload,
  isOnline = true,
}: QuickPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  /* --- Container scale-down when panel is open --- */
  useEffect(() => {
    document.querySelector('.container')?.classList.toggle('sheet-open', isOpen);
    return () => {
      document.querySelector('.container')?.classList.remove('sheet-open');
    };
  }, [isOpen]);

  /* --- Body scroll lock (iOS Safari safe) --- */
  useBodyScrollLock(isOpen);

  /* --- Focus management on open/close --- */
  useEffect(() => {
    if (isOpen) {
      // Focus the sheet itself for keyboard accessibility (Escape key)
      // without focusing the close button (avoids orange focus ring issue)
      requestAnimationFrame(() => {
        sheetRef.current?.focus();
      });
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  /* --- Escape key: close and return focus to FAB --- */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  /* --- Focus trap on Tab key (same pattern as InfoSheet) --- */
  const handleSheetKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
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

  /* --- Grid item click handler --- */
  const handleItemClick = useCallback(
    (item: PanelItemConfig) => {
      switch (item.action) {
        case 'sheet':
          onItemClick(item.key);
          handleClose();
          break;
        case 'print':
          onPrint();
          handleClose();
          break;
        case 'download': {
          const format = item.key.replace('download-', '');
          onDownload(format);
          handleClose();
          break;
        }
      }
    },
    [onItemClick, onPrint, onDownload, handleClose],
  );

  /* --- Prevent scroll passthrough on backdrop (native listeners, passive: false) --- */
  useEffect(() => {
    if (!isOpen) return;
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    const prevent = (e: Event) => { e.preventDefault(); };
    backdrop.addEventListener('wheel', prevent, { passive: false });
    backdrop.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      backdrop.removeEventListener('wheel', prevent);
      backdrop.removeEventListener('touchmove', prevent);
    };
  }, [isOpen]);

  /* --- Grid View --- */
  const sectionA = PANEL_ITEMS.filter((i) => i.section === 'A');
  const sectionB = PANEL_ITEMS.filter((i) => i.section === 'B');
  const sectionC = PANEL_ITEMS.filter((i) => i.section === 'C');

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div data-qp-root id="quickPanel">
        {/* Backdrop */}
        <div
          className={clsx(
            'fixed inset-0 bg-overlay transition-opacity',
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
          style={{
            zIndex: 'calc(var(--z-quick-panel) - 1)',
            overscrollBehavior: 'none',
            transitionDuration: 'var(--transition-duration-normal)',
            transitionTimingFunction: 'var(--transition-timing-function-apple)',
          }}
          role="presentation"
          aria-hidden="true"
          ref={backdropRef}
          onClick={handleClose}
        />

        {/* Sheet */}
        <div
          data-qp-sheet
          className="fixed bottom-0 left-0 right-0 overflow-y-auto"
          style={{
            background: 'color-mix(in srgb, var(--color-secondary) 88%, transparent)',
            WebkitBackdropFilter: 'saturate(180%) blur(28px)',
            backdropFilter: 'saturate(180%) blur(28px)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            padding: 'var(--spacing-3) var(--spacing-4) calc(var(--spacing-4) + env(safe-area-inset-bottom))',
            transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
            transition: isOpen
              ? 'transform var(--duration-sheet-open) var(--ease-spring)'
              : 'transform var(--duration-sheet-close) var(--ease-sheet-close)',
            zIndex: 'var(--z-quick-panel)',
            maxHeight: '85vh',
            touchAction: 'none',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="快速選單"
          ref={sheetRef}
          tabIndex={-1}
          onKeyDown={handleSheetKeyDown}
        >
          {/* Drag handle — swipe-up affordance */}
          <div
            className="w-10 h-1 rounded-full bg-muted mx-auto mt-3"
            aria-hidden="true"
          />
          {/* X close button (same style as InfoSheet) */}
          <div className="flex items-center justify-end mb-1">
            <div className="flex-1" />
            <button
              className="flex items-center justify-center w-tap-min h-tap-min border-none rounded-full bg-transparent text-foreground shrink-0 transition-colors duration-fast hover:text-accent hover:bg-accent-bg focus:outline-none"
              aria-label="關閉"
              ref={closeBtnRef}
              onClick={handleClose}
            >
              <Icon name="x-mark" />
            </button>
          </div>
          <div>
            <div
              data-qp-grid
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
            >
              {sectionA.map((item) => {
                const isDisabled = !isOnline && WRITE_KEYS.has(item.key);
                return (
                  <button
                    key={item.key}
                    data-qp-item
                    className={clsx(
                      'flex flex-col items-center justify-center gap-1 min-h-tap-min border-none bg-background text-foreground cursor-pointer rounded-sm shadow-md p-3 font-inherit text-footnote transition-colors duration-fast',
                      'active:bg-hover',
                      isDisabled && 'opacity-50 cursor-not-allowed',
                    )}
                    data-content={item.key}
                    disabled={isDisabled}
                    onClick={() => handleItemClick(item)}
                  >
                    <Icon name={item.icon} />
                    <span className="text-footnote text-foreground leading-none">{item.label}</span>
                  </button>
                );
              })}
              {sectionB.map((item) => {
                const isDisabled = !isOnline && WRITE_KEYS.has(item.key);
                return (
                  <button
                    key={item.key}
                    data-qp-item
                    className={clsx(
                      'flex flex-col items-center justify-center gap-1 min-h-tap-min border-none bg-background text-foreground cursor-pointer rounded-sm shadow-md p-3 font-inherit text-footnote transition-colors duration-fast',
                      'active:bg-hover',
                      isDisabled && 'opacity-50 cursor-not-allowed',
                    )}
                    data-content={item.key}
                    disabled={isDisabled}
                    onClick={() => handleItemClick(item)}
                  >
                    <Icon name={item.icon} />
                    <span className="text-footnote text-foreground leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="my-3" />
            <div
              data-qp-grid-bottom
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
            >
              {sectionC.map((item) => {
                const isDisabled = !isOnline && WRITE_KEYS.has(item.key);
                return (
                  <button
                    key={item.key}
                    data-qp-item
                    data-qp-item-bottom
                    className={clsx(
                      'flex flex-col items-center justify-center gap-1 min-h-tap-min border-none bg-tertiary text-muted cursor-pointer rounded-sm shadow-md p-3 font-inherit text-footnote transition-colors duration-fast',
                      'active:bg-hover',
                      isDisabled && 'opacity-50 cursor-not-allowed',
                    )}
                    data-content={item.key}
                    disabled={isDisabled}
                    onClick={() => handleItemClick(item)}
                  >
                    <Icon name={item.icon} />
                    <span className="text-footnote text-muted leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* FAB trigger */}
        <button
          data-qp-trigger
          className={clsx(
            'fixed flex items-center justify-center rounded-full bg-accent text-accent-foreground border-none shadow-md',
            isOpen && 'opacity-0 pointer-events-none scale-80',
          )}
          style={{
            bottom: 'max(88px, calc(68px + env(safe-area-inset-bottom)))',
            right: 'var(--spacing-5)',
            width: 'var(--fab-size)',
            height: 'var(--fab-size)',
            zIndex: 'var(--z-quick-panel)',
            transition: isOpen
              ? 'opacity var(--transition-duration-fast), transform var(--transition-duration-fast)'
              : 'transform var(--transition-duration-normal) var(--transition-timing-function-apple)',
          }}
          aria-label="快速選單"
          aria-expanded={isOpen}
          ref={triggerRef}
          onClick={handleToggle}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-7 h-7 transition-transform"
            style={{
              transitionDuration: 'var(--transition-duration-normal)',
              transitionTimingFunction: 'var(--transition-timing-function-apple)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <path d="M12 8l-6 6h12z" />
          </svg>
        </button>
      </div>
    </>
  );
}

/* ===== Exports for testing ===== */
export { PANEL_ITEMS };
export type { PanelItemConfig, QuickPanelProps };
