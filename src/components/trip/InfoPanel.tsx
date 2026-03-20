import Countdown from './Countdown';
import TripStatsCard from './TripStatsCard';
import TodaySummary from './TodaySummary';
import QuickLinks from './QuickLinks';
import type { Day } from '../../types/trip';

/* ===== Props ===== */

interface InfoPanelProps {
  /** Sorted trip dates for countdown. */
  autoScrollDates: string[];
  /** All day data for stats card. */
  days: Day[];
  /** Currently displayed day (for today summary). */
  currentDay?: Day | null;
  /** Callback for quick action buttons. */
  onQuickAction?: (key: string) => void;
}

/* ===== Component ===== */

export default function InfoPanel({
  autoScrollDates,
  days,
  currentDay,
  onQuickAction,
}: InfoPanelProps) {
  return (
    <aside className="info-panel" id="infoPanel">
      <Countdown autoScrollDates={autoScrollDates} />
      {onQuickAction && <QuickLinks onAction={onQuickAction} />}
      {currentDay && currentDay.timeline.length > 0 && (
        <TodaySummary entries={currentDay.timeline} />
      )}
      {days.length > 0 ? <TripStatsCard days={days} /> : null}
    </aside>
  );
}
