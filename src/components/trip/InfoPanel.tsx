import { useMemo } from 'react';
import Icon from '../shared/Icon';
import TodaySummary from './TodaySummary';
import { formatMinutes } from '../../lib/formatUtils';
import { calcDrivingStats } from '../../lib/drivingStats';
import { TRANSPORT_TYPE_ORDER } from '../../lib/constants';
import type { Day } from '../../types/trip';

/* ===== Props ===== */

interface InfoPanelProps {
  /** All day data. */
  days: Day[];
  /** Currently displayed day (for today summary + hotel + transport). */
  currentDay?: Day | null;
}

/* ===== Component ===== */

export default function InfoPanel({
  days,
  currentDay,
}: InfoPanelProps) {
  /* --- Current day transport summary --- */
  const dayTransport = useMemo(() => {
    if (!currentDay) return null;
    return calcDrivingStats(currentDay.timeline);
  }, [currentDay]);

  return (
    <aside className="info-panel" id="infoPanel">
      {currentDay && currentDay.timeline.length > 0 && (
        <TodaySummary entries={currentDay.timeline} />
      )}
      {/* Hotel info card */}
      {currentDay?.hotel && (
        <div className="info-card hotel-summary-card">
          <div className="info-label"><Icon name="hotel" /> 今日住宿</div>
          <div className="hotel-summary-name">{currentDay.hotel.name}</div>
          {currentDay.hotel.checkout && (
            <div className="hotel-summary-checkout">
              退房：{currentDay.hotel.checkout}
            </div>
          )}
        </div>
      )}
      {/* Day transport summary card */}
      {dayTransport && (
        <div className="info-card transport-summary-card">
          <div className="info-label"><Icon name="bus" /> 當日交通</div>
          {TRANSPORT_TYPE_ORDER.map((key) => {
            const g = dayTransport.byType[key];
            if (!g) return null;
            return (
              <div key={key} className="transport-summary-row">
                <Icon name={g.icon} />
                <span className="transport-summary-label">{g.label}</span>
                <span className="transport-summary-value">{formatMinutes(g.totalMinutes)}</span>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
