import { useState, useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';

/* ===== FAB trigger SVGs: horizontal arrows ===== */
const FAB_CLOSED = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 6l-8 6 8 6z" />
  </svg>
);
const FAB_OPEN = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 6l8 6-8 6z" />
  </svg>
);

/* ===== Speed Dial Item Config ===== */

interface SpeedDialItemConfig {
  key: string;
  icon: string;
  label: string;
  action: 'sheet' | 'group';
}

const DIAL_ITEMS: SpeedDialItemConfig[] = [
  { key: 'flights',     icon: 'plane',        label: '航班',   action: 'sheet' },
  { key: 'checklist',   icon: 'check-circle', label: '出發',   action: 'sheet' },
  { key: 'emergency',   icon: 'emergency',    label: '緊急',   action: 'sheet' },
  { key: 'backup',      icon: 'backup',       label: '備案',   action: 'sheet' },
  { key: 'suggestions', icon: 'lightbulb',    label: '建議',   action: 'sheet' },
  { key: 'today-route', icon: 'route',        label: '路線',   action: 'sheet' },
  { key: 'driving',     icon: 'car',          label: '交通',   action: 'sheet' },
  { key: 'tools',       icon: 'gear',         label: '設定',   action: 'group' },
];

/* ===== Group → content key mapping (only for tools group) ===== */

export const SPEED_DIAL_GROUPS: Record<string, { title: string; items: { key: string; label: string; action?: 'sheet' | 'navigate' | 'print' | 'download' }[] }> = {
  tools: {
    title: '設定',
    items: [
      { key: 'trip-select', label: '切換行程', action: 'navigate' },
      { key: 'appearance', label: '外觀與主題', action: 'navigate' },
      { key: 'download', label: '下載行程', action: 'sheet' },
      { key: 'printer', label: '列印模式', action: 'print' },
    ],
  },
};

/* ===== Props ===== */

interface SpeedDialProps {
  onItemClick: (contentKey: string) => void;
  onGroupClick?: (groupKey: string) => void;
  onPrint?: () => void;
  onDownload?: () => void;
}

/* ===== Component ===== */

export default function SpeedDial({ onItemClick, onGroupClick, onPrint, onDownload }: SpeedDialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleItemClick = useCallback(
    (item: SpeedDialItemConfig) => {
      setIsOpen(false);

      if (item.action === 'group' && onGroupClick) {
        onGroupClick(item.key);
        return;
      }

      // Direct sheet action
      onItemClick(item.key);
    },
    [onItemClick, onGroupClick],
  );

  /* --- Escape key handler: close and return focus to trigger --- */
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

  const preventTouchScroll = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
  }, []);
  const preventWheelScroll = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className={clsx('speed-dial', isOpen && 'open')} id="speedDial">
      {/* Backdrop: prevent scroll passthrough to page content while dial is open */}
      <div
        className="speed-dial-backdrop"
        id="speedDialBackdrop"
        role="presentation"
        aria-hidden="true"
        onClick={handleClose}
        onTouchMove={preventTouchScroll}
        onWheel={preventWheelScroll}
      />
      <div className="speed-dial-items" id="speedDialItems">
        {DIAL_ITEMS.map((item) => (
          <button
            key={item.key}
            className="speed-dial-item"
            data-content={item.key}
            aria-label={item.label}
            onClick={() => handleItemClick(item)}
          >
            <span className="speed-dial-label">{item.label}</span>
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
      <button
        className="speed-dial-trigger"
        id="speedDialTrigger"
        aria-label="快速選單"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="speedDialItems"
        ref={triggerRef}
        onClick={handleToggle}
      >
        {isOpen ? FAB_OPEN : FAB_CLOSED}
      </button>
    </div>
  );
}
