import Countdown from './Countdown';
import TripStatsCard from './TripStatsCard';
import Flights from './Flights';
import Checklist from './Checklist';
import Backup from './Backup';
import Emergency from './Emergency';
import Suggestions from './Suggestions';
import { TripDrivingStatsCard } from './DrivingStats';
import type { Day } from '../../types/trip';
import type { FlightsData } from './Flights';
import type { ChecklistData } from './Checklist';
import type { BackupData } from './Backup';
import type { EmergencyData } from './Emergency';
import type { SuggestionsData } from './Suggestions';
import type { TripDrivingStats } from '../../lib/drivingStats';

/* ===== Props ===== */

interface InfoPanelProps {
  /** Sorted trip dates for countdown. */
  autoScrollDates: string[];
  /** All day data for stats card. */
  days: Day[];
  /** Flights doc content. */
  flights?: FlightsData | null;
  /** Checklist doc content. */
  checklist?: ChecklistData | null;
  /** Backup doc content. */
  backup?: BackupData | null;
  /** Emergency doc content. */
  emergency?: EmergencyData | null;
  /** Suggestions doc content. */
  suggestions?: SuggestionsData | null;
  /** Pre-computed trip-wide driving stats. */
  tripDrivingStats?: TripDrivingStats | null;
}

/* ===== Component ===== */

/**
 * Desktop right sidebar panel.
 * Renders Countdown, TripStats, Flights, Checklist, Backup, Emergency,
 * Suggestions, and DrivingStats cards.
 */
export default function InfoPanel({
  autoScrollDates,
  days,
  flights,
  checklist,
  backup,
  emergency,
  suggestions,
  tripDrivingStats,
}: InfoPanelProps) {
  return (
    <aside className="info-panel" id="infoPanel">
      {/* Countdown */}
      <Countdown autoScrollDates={autoScrollDates} />

      {/* Trip Stats */}
      {days.length > 0 && <TripStatsCard days={days} />}

      {/* Flights */}
      {flights && (
        <div className="info-card">
          <h3>{flights._title || flights.title || '航班資訊'}</h3>
          <Flights data={flights} />
        </div>
      )}

      {/* Checklist */}
      {checklist && (
        <div className="info-card">
          <h3>{checklist._title || checklist.title || '出發前確認'}</h3>
          <Checklist data={checklist} />
        </div>
      )}

      {/* Backup */}
      {backup && (
        <div className="info-card">
          <h3>{backup._title || backup.title || '備案'}</h3>
          <Backup data={backup} />
        </div>
      )}

      {/* Emergency */}
      {emergency && (
        <div className="info-card">
          <h3>{emergency._title || emergency.title || '緊急聯絡'}</h3>
          <Emergency data={emergency} />
        </div>
      )}

      {/* Suggestions */}
      {suggestions && (
        <div className="info-card">
          <h3>{suggestions._title || suggestions.title || 'AI 行程建議'}</h3>
          <Suggestions data={suggestions} />
        </div>
      )}

      {/* Trip-wide Driving Stats */}
      {tripDrivingStats && (
        <div className="info-card">
          <TripDrivingStatsCard tripStats={tripDrivingStats} />
        </div>
      )}
    </aside>
  );
}
