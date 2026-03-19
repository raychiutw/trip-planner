import { useState, useCallback } from 'react';
import Icon from '../shared/Icon';

/* ===== Speed Dial Item Config ===== */

interface SpeedDialItemConfig {
  key: string;
  icon: string;
  label: string;
}

const DIAL_ITEMS: SpeedDialItemConfig[] = [
  { key: 'flights', icon: 'plane', label: '航班資訊' },
  { key: 'checklist', icon: 'check-circle', label: '出發前確認' },
  { key: 'backup', icon: 'refresh', label: '備案' },
  { key: 'emergency', icon: 'emergency', label: '緊急聯絡' },
  { key: 'suggestions', icon: 'lightbulb', label: 'AI 行程建議' },
  { key: 'driving', icon: 'car', label: '交通統計' },
  { key: 'download', icon: 'download', label: '下載行程' },
  { key: 'printer', icon: 'printer', label: '列印模式' },
  { key: 'settings', icon: 'gear', label: '設定' },
];

/* ===== Props ===== */

interface SpeedDialProps {
  /** Called when a speed dial item is clicked. Receives the content key. */
  onItemClick: (contentKey: string) => void;
  /** 可選：觸發列印模式切換 */
  onPrint?: () => void;
  /** 可選：觸發下載行程 */
  onDownload?: () => void;
}

/* ===== Component ===== */

/**
 * Mobile floating action button menu.
 * Renders a trigger button, backdrop, and 6 item buttons.
 */
export default function SpeedDial({ onItemClick, onPrint, onDownload }: SpeedDialProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleItemClick = useCallback(
    (contentKey: string) => {
      setIsOpen(false);
      /* 下載行程：呼叫 onDownload */
      if (contentKey === 'download' && onDownload) {
        onDownload();
        return;
      }
      /* 列印模式：呼叫 onPrint 而非 onItemClick */
      if (contentKey === 'printer') {
        onPrint?.();
        return;
      }
      /* 設定頁：直接跳轉 */
      if (contentKey === 'settings') {
        window.location.href = 'setting.html';
        return;
      }
      onItemClick(contentKey);
    },
    [onItemClick, onPrint, onDownload],
  );

  /* --- Prevent scroll through on backdrop --- */
  const preventTouchScroll = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
  }, []);
  const preventWheelScroll = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className={`speed-dial${isOpen ? ' open' : ''}`} id="speedDial">
      <div
        className="speed-dial-backdrop"
        id="speedDialBackdrop"
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
            onClick={() => handleItemClick(item.key)}
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
      <button
        className="speed-dial-trigger"
        id="speedDialTrigger"
        aria-label="快速選單"
        onClick={handleToggle}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M12 8l-6 6h12z" />
        </svg>
      </button>
    </div>
  );
}
