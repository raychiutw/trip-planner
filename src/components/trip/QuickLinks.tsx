/* ===== QuickLinks Component ===== */
/* Icon button row for quick access to common sheets (InfoPanel). */

import { memo } from 'react';
import Icon from '../shared/Icon';

interface QuickLinksProps {
  onAction: (key: string) => void;
}

const LINKS = [
  { key: 'flights',     icon: 'plane',     label: '航班' },
  { key: 'emergency',   icon: 'emergency', label: '緊急' },
  { key: 'backup',      icon: 'backup',    label: '備案' },
  { key: 'today-route', icon: 'route',     label: '路線' },
] as const;

export const QuickLinks = memo(function QuickLinks({ onAction }: QuickLinksProps) {
  return (
    <div className="info-card quick-links">
      <div className="quick-links-row">
        {LINKS.map((l) => (
          <button
            key={l.key}
            className="quick-link-btn"
            aria-label={l.label}
            onClick={() => onAction(l.key)}
          >
            <Icon name={l.icon} />
            <span className="quick-link-label">{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

export default QuickLinks;
