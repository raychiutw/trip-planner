import { useState, useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';
import { apiFetch } from '../../hooks/useApi';
import type { ColorMode, ColorTheme } from '../../hooks/useDarkMode';
import type { TripListItem } from '../../types/trip';

/* ===== Panel item config ===== */

type PanelAction = 'sheet' | 'drill-down' | 'print' | 'download';

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
  // Section B row 2: 快捷設定
  { key: 'trip-select', icon: 'swap-horiz', label: '行程', action: 'drill-down', section: 'B' },
  { key: 'appearance', icon: 'palette', label: '外觀', action: 'drill-down', section: 'B' },
  { key: 'printer', icon: 'printer', label: '列印', action: 'print', section: 'B' },
  // Section C: 下載匯出
  { key: 'download-pdf', icon: 'download', label: 'PDF', action: 'download', section: 'C' },
  { key: 'download-md', icon: 'doc', label: 'MD', action: 'download', section: 'C' },
  { key: 'download-json', icon: 'code', label: 'JSON', action: 'download', section: 'C' },
  { key: 'download-csv', icon: 'table', label: 'CSV', action: 'download', section: 'C' },
];

/* ===== Theme definitions ===== */

const THEME_OPTIONS: { key: ColorTheme; label: string; color: string }[] = [
  { key: 'sun', label: '陽光', color: '#E86A4A' },
  { key: 'sky', label: '晴空', color: '#2870A0' },
  { key: 'zen', label: '和風', color: '#9A6B50' },
  { key: 'forest', label: '森林', color: '#4A8C5C' },
  { key: 'sakura', label: '櫻花', color: '#D4708A' },
  { key: 'night', label: '星夜', color: '#6B6B6B' },
];

const COLOR_MODE_OPTIONS: { key: ColorMode; label: string }[] = [
  { key: 'light', label: '淺色' },
  { key: 'dark', label: '深色' },
  { key: 'auto', label: '自動' },
];

/* ===== Props ===== */

interface QuickPanelProps {
  onItemClick: (contentKey: string) => void;
  onPrint: () => void;
  onDownload: (format: string) => void;
  onTripChange: (tripId: string) => void;
  currentTripId: string | null;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  colorTheme: ColorTheme;
  onThemeChange: (theme: ColorTheme) => void;
}

/* ===== View state ===== */

type PanelView = 'grid' | 'trip-select' | 'appearance';

/* ===== Component ===== */

export default function QuickPanel({
  onItemClick,
  onPrint,
  onDownload,
  onTripChange,
  currentTripId,
  colorMode,
  onColorModeChange,
  colorTheme,
  onThemeChange,
}: QuickPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<PanelView>('grid');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const savedBodyScrollY = useRef(0);

  /* --- Trips list for drill-down --- */
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        // Opening — reset view to grid
        setView('grid');
      }
      return !prev;
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setView('grid');
  }, []);

  /* --- Body scroll lock (iOS Safari safe, same pattern as InfoSheet) --- */
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen]);

  /* --- Escape key: close and return focus to FAB --- */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setView('grid');
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  /* --- Fetch trips when trip-select view is active --- */
  useEffect(() => {
    if (view !== 'trip-select') return;
    let cancelled = false;
    setTripsLoading(true);
    apiFetch<TripListItem[]>('/trips')
      .then((data) => {
        if (cancelled) return;
        setTrips(data.filter((t) => t.published === 1));
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (!cancelled) setTripsLoading(false);
      });
    return () => { cancelled = true; };
  }, [view]);

  /* --- Grid item click handler --- */
  const handleItemClick = useCallback(
    (item: PanelItemConfig) => {
      switch (item.action) {
        case 'sheet':
          onItemClick(item.key);
          handleClose();
          break;
        case 'drill-down':
          if (item.key === 'trip-select') setView('trip-select');
          else if (item.key === 'appearance') setView('appearance');
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

  const GridView = (
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
      <div className="quick-panel-grid">
        {sectionC.map((item) => (
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
    </div>
  );

  /* --- Trip Select View --- */
  const TripSelectView = (
    <div className="quick-panel-drilldown">
      <button className="quick-panel-back" onClick={() => setView('grid')}>
        <Icon name="arrow-left" />
        <span>返回選單</span>
      </button>
      <div className="quick-panel-drilldown-title">切換行程</div>
      <div className="quick-panel-trip-list">
        {tripsLoading && <div className="quick-panel-trip-loading">載入中...</div>}
        {!tripsLoading && trips.map((t) => (
          <button
            key={t.tripId}
            className={clsx('quick-panel-trip-item', t.tripId === currentTripId && 'active')}
            onClick={() => {
              onTripChange(t.tripId);
              handleClose();
            }}
          >
            <span className="quick-panel-trip-name">{t.name}</span>
            {t.title && <span className="quick-panel-trip-title">{t.title}</span>}
            {t.tripId === currentTripId && <Icon name="check-circle" />}
          </button>
        ))}
      </div>
    </div>
  );

  /* --- Appearance View --- */
  const AppearanceView = (
    <div className="quick-panel-drilldown">
      <button className="quick-panel-back" onClick={() => setView('grid')}>
        <Icon name="arrow-left" />
        <span>返回選單</span>
      </button>
      <div className="quick-panel-drilldown-title">外觀主題</div>

      {/* Color mode selector */}
      <div className="quick-panel-section-label">色彩模式</div>
      <div className="quick-panel-mode-group">
        {COLOR_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={clsx('quick-panel-mode-btn', colorMode === opt.key && 'active')}
            onClick={() => onColorModeChange(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Theme color selector */}
      <div className="quick-panel-section-label">主題色</div>
      <div className="quick-panel-theme-group">
        {THEME_OPTIONS.map((t) => (
          <button
            key={t.key}
            className={clsx('quick-panel-theme-btn', colorTheme === t.key && 'active')}
            onClick={() => onThemeChange(t.key)}
            aria-label={t.label}
          >
            <span className="quick-panel-theme-dot" style={{ backgroundColor: t.color }} />
            <span className="quick-panel-theme-label">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

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

      {/* Sheet */}
      <div
        className="quick-panel-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="快速選單"
      >
        <div className="sheet-handle" />
        {view === 'grid' && GridView}
        {view === 'trip-select' && TripSelectView}
        {view === 'appearance' && AppearanceView}
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
