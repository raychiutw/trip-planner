import { useCallback } from 'react';
import Countdown from './Countdown';
import TripStatsCard from './TripStatsCard';
import TodaySummary from './TodaySummary';
import type { Day } from '../../types/trip';

/* ===== Props ===== */

interface InfoPanelProps {
  /** Sorted trip dates for countdown. */
  autoScrollDates: string[];
  /** All day data for stats card. */
  days: Day[];
  /** Currently displayed day (for today summary). */
  currentDay?: Day | null;
}

/* ===== Component ===== */

export default function InfoPanel({
  autoScrollDates,
  days,
  currentDay,
}: InfoPanelProps) {
  const handleEntryClick = useCallback((index: number) => {
    const el = document.querySelector(`.tl-event[data-entry-index="${index}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return (
    <aside className="info-panel" id="infoPanel">
      <Countdown autoScrollDates={autoScrollDates} />
      {currentDay && currentDay.timeline.length > 0 && (
        <TodaySummary entries={currentDay.timeline} onEntryClick={handleEntryClick} />
      )}
      {days.length > 0 ? <TripStatsCard days={days} /> : null}
    </aside>
  );
}
