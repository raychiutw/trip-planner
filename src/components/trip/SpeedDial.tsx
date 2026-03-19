import { useState, useCallback } from 'react';
import Icon from '../shared/Icon';

/* ===== Speed Dial Item Config ===== */

interface SpeedDialItemConfig {
  key: string;
  icon: string;
  label: string;
}

const DIAL_ITEMS: SpeedDialItemConfig[] = [
  { key: 'prep', icon: 'plane', label: '行前準備' },
  { key: 'emergency-group', icon: 'emergency', label: '緊急應變' },
  { key: 'ai-group', icon: 'lightbulb', label: 'AI 分析' },
  { key: 'tools', icon: 'gear', label: '設定' },
];

/* ===== Group → content key mapping ===== */

/** Maps speed dial group key to the content keys shown in bottom sheet */
export const SPEED_DIAL_GROUPS: Record<string, { title: string; items: { key: string; label: string; action?: 'sheet' | 'navigate' | 'print' | 'download' }[] }> = {
  prep: {
    title: '行前準備',
    items: [
      { key: 'flights', label: '航班資訊', action: 'sheet' },
      { key: 'checklist', label: '出發前確認', action: 'sheet' },
    ],
  },
  'emergency-group': {
    title: '緊急應變',
    items: [
      { key: 'emergency', label: '緊急聯絡', action: 'sheet' },
      { key: 'backup', label: '備案', action: 'sheet' },
    ],
  },
  'ai-group': {
    title: 'AI 分析',
    items: [
      { key: 'suggestions', label: 'AI 行程建議', action: 'sheet' },
      { key: 'driving', label: '交通統計', action: 'sheet' },
    ],
  },
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

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleItemClick = useCallback(
    (groupKey: string) => {
      setIsOpen(false);

      const group = SPEED_DIAL_GROUPS[groupKey];
      if (!group) return;

      /* tools group: if only 1 non-sheet action, handle directly */
      if (groupKey === 'tools') {
        if (onGroupClick) {
          onGroupClick(groupKey);
        }
        return;
      }

      /* Groups with 2 sheet items: if only 1 item, open directly; otherwise open group sheet */
      if (group.items.length === 1) {
        onItemClick(group.items[0].key);
      } else if (onGroupClick) {
        onGroupClick(groupKey);
      } else {
        /* Fallback: open first item */
        onItemClick(group.items[0].key);
      }
    },
    [onItemClick, onGroupClick],
  );

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
