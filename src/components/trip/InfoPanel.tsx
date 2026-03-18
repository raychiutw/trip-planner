import Countdown from './Countdown';
import TripStatsCard from './TripStatsCard';
import type { Day } from '../../types/trip';

/* ===== Props ===== */

interface InfoPanelProps {
  /** Sorted trip dates for countdown. */
  autoScrollDates: string[];
  /** All day data for stats card. */
  days: Day[];
}

/* ===== Component ===== */

/**
 * Desktop right sidebar panel.
 * Renders Countdown + TripStatsCard only (matching old vanilla JS behavior).
 */
export default function InfoPanel({
  autoScrollDates,
  days,
}: InfoPanelProps) {
  return (
    <aside className="info-panel" id="infoPanel">
      <Countdown autoScrollDates={autoScrollDates} />
      {days.length > 0 ? <TripStatsCard days={days} /> : null}
    </aside>
  );
}
