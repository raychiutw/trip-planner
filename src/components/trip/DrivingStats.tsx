import { useState, useCallback } from 'react';
import Icon from '../shared/Icon';
import {
  ARROW_EXPAND,
  ARROW_COLLAPSE,
  DRIVING_WARN_LABEL,
  TRANSPORT_TYPE_ORDER,
} from '../../lib/constants';
import { formatMinutes } from '../../lib/formatUtils';
import type {
  DayDrivingStats,
  TripDrivingStats,
  TypeGroup,
} from '../../lib/drivingStats';
import { isDrivingWarning } from '../../lib/drivingStats';

/* ===== Transport Type Groups (shared sub-component) ===== */

function TransportTypeGroups({ byType }: { byType: Record<string, TypeGroup> }) {
  return (
    <>
      {TRANSPORT_TYPE_ORDER.map((key) => {
        const group = byType[key];
        if (!group) return null;
        return (
          <div key={key} className="transport-type-group">
            <div className="transport-type-label">
              <Icon name={group.icon} /> {group.label}：
              {formatMinutes(group.totalMinutes)}
            </div>
            <div className="driving-stats-detail">
              {group.segments.map((seg, i) => (
                <span key={i} className="driving-stats-seg">
                  <Icon name={group.icon} />{' '}
                  {seg.from && (
                    <>{seg.from}{seg.to ? ` → ${seg.to}` : ''} </>
                  )}
                  {seg.text}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ===== Per-Day Driving Stats ===== */

interface DayDrivingStatsProps {
  stats: DayDrivingStats;
}

/**
 * Renders a collapsible per-day transport stats row
 * (used inside day-overview).
 */
export function DayDrivingStatsCard({ stats }: DayDrivingStatsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isWarning = isDrivingWarning(stats.drivingMinutes);
  const cls = isWarning ? 'driving-stats driving-stats-warning' : 'driving-stats';

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className={cls}>
      <div
        className={`col-row${isOpen ? ' open' : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={isOpen ? '收合交通資訊' : '展開交通資訊'}
        onClick={handleToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
      >
        {isWarning ? <Icon name="warning" /> : <Icon name="bus" />} 當日交通：
        {formatMinutes(stats.totalMinutes)}
        {isWarning && (
          <span className="driving-stats-badge">{DRIVING_WARN_LABEL}</span>
        )}
        <span className="arrow">{isOpen ? ARROW_COLLAPSE : ARROW_EXPAND}</span>
      </div>
      <div className={`col-detail${isOpen ? ' open' : ''}`}>
        <TransportTypeGroups byType={stats.byType} />
      </div>
    </div>
  );
}

/* ===== Trip-wide Driving Stats ===== */

interface TripDrivingStatsProps {
  tripStats: TripDrivingStats;
}

/**
 * Renders the full trip driving/transport summary with per-day breakdowns.
 * Used in the info panel and bottom sheet.
 */
export function TripDrivingStatsCard({ tripStats }: TripDrivingStatsProps) {
  return (
    <div className="driving-summary">
      <div className="driving-summary-header">
        <Icon name="bus" /> 全旅程交通統計：
        {formatMinutes(tripStats.grandTotal)}
      </div>
      <div className="driving-summary-body">
        {/* Type summary */}
        {TRANSPORT_TYPE_ORDER.map((key) => {
          const g = tripStats.grandByType[key];
          if (!g) return null;
          return (
            <div key={key} className="transport-type-summary">
              <Icon name={g.icon} /> {g.label}：{formatMinutes(g.totalMinutes)}
            </div>
          );
        })}

        {/* Per-day breakdown */}
        {tripStats.days.map((d) => {
          const isWarning = isDrivingWarning(d.stats.drivingMinutes);
          return (
            <div
              key={d.dayId}
              className={`driving-summary-day${isWarning ? ' driving-stats-warning' : ''}`}
            >
              <div className="driving-summary-day-header">
                <strong>
                  {d.label}（{d.date}）
                </strong>
                ：{formatMinutes(d.stats.totalMinutes)}
                {isWarning && (
                  <span className="driving-stats-badge">{DRIVING_WARN_LABEL}</span>
                )}
              </div>
              <div className="driving-summary-day-body">
                <TransportTypeGroups byType={d.stats.byType} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
