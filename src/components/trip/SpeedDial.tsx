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
];

/* ===== Props ===== */

interface SpeedDialProps {
  /** Called when a speed dial item is clicked. Receives the content key. */
  onItemClick: (contentKey: string) => void;
}

/* ===== Component ===== */

/**
 * Mobile floating action button menu.
 * Renders a trigger button, backdrop, and 6 item buttons.
 */
export default function SpeedDial({ onItemClick }: SpeedDialProps) {
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
      onItemClick(contentKey);
    },
    [onItemClick],
  );

  /* --- Prevent scroll through on backdrop --- */
  const preventScroll = useCallback((e: React.TouchEvent | React.WheelEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className={`speed-dial${isOpen ? ' open' : ''}`} id="speedDial">
      <div
        className="speed-dial-backdrop"
        id="speedDialBackdrop"
        onClick={handleClose}
        onTouchMove={preventScroll as unknown as React.TouchEventHandler}
        onWheel={preventScroll as unknown as React.WheelEventHandler}
      />
      <div className="speed-dial-items" id="speedDialItems">
        {DIAL_ITEMS.map((item) => (
          <button
            key={item.key}
            className="speed-dial-item"
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
