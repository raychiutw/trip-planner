/* ===== TodayRouteSheet Component ===== */
/* Displays all timeline entries for the current day with map links. */

import { memo } from 'react';
import { NavLinks, type NavLocation } from './MapLinks';
import type { TimelineEntryData } from './TimelineEvent';

interface TodayRouteSheetProps {
  events: TimelineEntryData[];
}

export const TodayRouteSheet = memo(function TodayRouteSheet({ events }: TodayRouteSheetProps) {
  const routeEvents = events.filter(
    (ev) => ev.locations && ev.locations.length > 0,
  );

  if (routeEvents.length === 0) {
    return <p className="text-muted">今日行程沒有地圖連結</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {routeEvents.map((ev, i) => (
        <div key={ev.id ?? i} className="flex flex-col gap-1 p-3 bg-accent-subtle rounded-sm">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-footnote text-accent whitespace-nowrap min-w-[40px]">{ev.time?.split('-')[0]?.trim() || ''}</span>
            <span className="text-callout font-semibold text-foreground">{ev.title || ''}</span>
          </div>
          <div className="flex gap-2 pl-[calc(40px+var(--spacing-2))]">
            <NavLinks locations={ev.locations as NavLocation[]} />
          </div>
        </div>
      ))}
    </div>
  );
});

export default TodayRouteSheet;
