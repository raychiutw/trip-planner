/* ===== TodaySummary Component ===== */
/* Displays current day's timeline entries as a compact list for InfoPanel. */

import { memo } from 'react';
import Icon from '../shared/Icon';
import type { Entry } from '../../types/trip';

interface TodaySummaryProps {
  entries: Entry[];
  onEntryClick?: (index: number) => void;
}

export const TodaySummary = memo(function TodaySummary({ entries, onEntryClick }: TodaySummaryProps) {
  if (entries.length === 0) return null;

  return (
    <div className="info-card today-summary">
      <div className="info-label"><Icon name="timer" /> 今日行程</div>
      <ul className="today-summary-list">
        {entries.map((e, i) => {
          const timeStr = e.time?.split('-')[0]?.trim() || '';
          return (
            <li
              key={e.id ?? i}
              className="today-summary-item"
              onClick={() => onEntryClick?.(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEntryClick?.(i); } }}
              role={onEntryClick ? 'button' : undefined}
              tabIndex={onEntryClick ? 0 : undefined}
            >
              <span className="today-summary-time">{timeStr}</span>
              <span className="today-summary-title">{e.title}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

export default TodaySummary;
