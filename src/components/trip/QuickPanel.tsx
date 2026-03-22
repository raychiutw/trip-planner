import { useState, useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

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
  { key: 'suggestions', icon: 'lightbulb', label: '建議', action: 'sheet', section: 'B' },
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
}

/* ===== Component ===== */

export default function QuickPanel({
  onItemClick,
  onPrint,
  onDownload,
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
    <div className={clsx('quick-panel', isOpen && 'open')} id="quickPanel">
      {/* Backdrop */}
      <div
        className="quick-panel-backdrop"
        role="presentation"
        aria-hidden="true"
        ref={backdropRef}
        onClick={handleClose}
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      />

      {/* Sheet (#11: drag handle removed, use X button to close) */}
      <div
        className="quick-panel-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="快速選單"
        ref={sheetRef}
        tabIndex={-1}
        onKeyDown={handleSheetKeyDown}
      >
        {/* #2b: X close button (same style as InfoSheet) */}
        <div className="quick-panel-header">
          <div className="quick-panel-header-spacer" />
          <button
            className="sheet-close-btn"
            aria-label="關閉"
            ref={closeBtnRef}
            onClick={handleClose}
          >
            <Icon name="x-mark" />
          </button>
        </div>
        <div className="quick-panel-grid-container">
          <div className="quick-panel-grid">
            {sectionA.map((item) => (
              <button
                key={item.key}
                className="quick-panel-item"
                data-content={item.key}
                onClick={() => handleItemClick(item)}
              >
                <Icon name={item.icon} />
                <span className="quick-panel-label">{item.label}</span>
              </button>
            ))}
            {sectionB.map((item) => (
              <button
                key={item.key}
                className="quick-panel-item"
                data-content={item.key}
                onClick={() => handleItemClick(item)}
              >
                <Icon name={item.icon} />
                <span className="quick-panel-label">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="quick-panel-divider" />
          <div className="quick-panel-grid-bottom">
            {sectionC.map((item) => (
              <button
                key={item.key}
                className="quick-panel-item quick-panel-item-bottom"
                data-content={item.key}
                onClick={() => handleItemClick(item)}
              >
                <Icon name={item.icon} />
                <span className="quick-panel-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FAB trigger */}
      <button
        className="quick-panel-trigger"
        aria-label="快速選單"
        aria-expanded={isOpen}
        ref={triggerRef}
        onClick={handleToggle}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="quick-panel-arrow">
          <path d="M12 8l-6 6h12z" />
        </svg>
      </button>
    </div>
  );
}

/* ===== Exports for testing ===== */
export { PANEL_ITEMS };
export type { PanelItemConfig, QuickPanelProps };
