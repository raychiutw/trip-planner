/* ===== TodaySummary Component ===== */
/* Displays current day's timeline entries as a compact list for InfoPanel. */

import { memo } from 'react';
import Icon from '../shared/Icon';
import type { Entry } from '../../types/trip';

interface TodaySummaryProps {
  entries: Entry[];
}

export const TodaySummary = memo(function TodaySummary({ entries }: TodaySummaryProps) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-secondary rounded-md p-4 mb-3">
      <div className="font-bold text-title3 mb-3"><Icon name="timer" /> 今日行程</div>
      <ul className="list-none p-0 m-0">
        {entries.map((e, i) => {
          const timeStr = e.time?.split('-')[0]?.trim() || '';
          return (
            <li key={e.id ?? i} className="flex gap-2 py-2 px-3 -mx-3 text-callout rounded-sm items-center">
              <span className="font-semibold text-accent whitespace-nowrap min-w-[40px]">{timeStr}</span>
              <span className="text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{e.title}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

export default TodaySummary;
