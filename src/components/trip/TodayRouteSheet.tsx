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
    return <p className="text-[var(--color-muted)]">今日行程沒有地圖連結</p>;
  }

  return (
    <div className="today-route-list">
      {routeEvents.map((ev, i) => (
        <div key={ev.id ?? i} className="today-route-item">
          <span className="today-route-time">{ev.time?.split('-')[0]?.trim() || ''}</span>
          <span className="today-route-title">{ev.title || ''}</span>
          <div className="today-route-links">
            <NavLinks locations={ev.locations as NavLocation[]} />
          </div>
        </div>
      ))}
    </div>
  );
});

export default TodayRouteSheet;
