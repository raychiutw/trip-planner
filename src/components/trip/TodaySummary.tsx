/* ===== TodaySummary Component ===== */
/* Displays current day's timeline entries as a compact list for InfoPanel. */

import { memo } from 'react';
import type { Entry } from '../../types/trip';

interface TodaySummaryProps {
  entries: Entry[];
}

export const TodaySummary = memo(function TodaySummary({ entries }: TodaySummaryProps) {
  if (entries.length === 0) return null;

  return (
    <ul className="list-none p-0 m-0 flex flex-col gap-2">
      {entries.map((e, i) => {
        const timeStr = e.time?.split('-')[0]?.trim() || '';
        return (
          <li key={e.id ?? i} className="flex gap-3 text-callout items-center">
            <span className="font-semibold text-accent whitespace-nowrap min-w-[40px] tabular-nums">{timeStr}</span>
            <span className="text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{e.title}</span>
          </li>
        );
      })}
    </ul>
  );
});

export default TodaySummary;
