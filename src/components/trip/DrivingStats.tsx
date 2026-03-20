import { useState, useCallback } from 'react';
import clsx from 'clsx';
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
  const cls = clsx('driving-stats', isWarning && 'driving-stats-warning');

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className={cls}>
      <div
        className={clsx('col-row', isOpen && 'open')}
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
      <div className={clsx('col-detail', isOpen && 'open')}>
        <TransportTypeGroups byType={stats.byType} />
      </div>
    </div>
  );
}

/* ===== Trip-wide Driving Stats ===== */

interface TripDrivingStatsProps {
  tripStats: TripDrivingStats;
}

/** Helper to get minutes for a transport type from a day's stats. */
function getTypeMinutes(stats: DayDrivingStats, type: string): number {
  return stats.byType[type]?.totalMinutes ?? 0;
}

/** Renders a cell value with optional warning style for car >2h. */
function StatCell({ minutes, type }: { minutes: number; type: string }) {
  const warn = type === 'car' && isDrivingWarning(minutes);
  return (
    <span className={clsx('ds-cell-value', warn && 'ds-cell-warn')}>
      {warn && <Icon name="warning" />}
      {formatMinutes(minutes)}
    </span>
  );
}

/**
 * Renders the full trip driving/transport summary.
 * - Mobile (<768px): per-day cards with vertical transport rows
 * - Desktop (>=768px): table with transport type columns + totals row
 */
export function TripDrivingStatsCard({ tripStats }: TripDrivingStatsProps) {
  const activeTypes = TRANSPORT_TYPE_ORDER.filter((k) => tripStats.grandByType[k]);

  return (
    <div className="driving-summary">
      <div className="driving-summary-header">
        <Icon name="bus" /> 交通統計
      </div>

      {/* Mobile: card layout */}
      <div className="ds-cards">
        {tripStats.days.map((d) => {
          const isWarning = isDrivingWarning(d.stats.drivingMinutes);
          return (
            <div key={d.dayId} className={clsx('ds-card', isWarning && 'ds-card-warn')}>
              <div className="ds-card-label">{d.label} {d.date}</div>
              {activeTypes.map((type) => {
                const g = d.stats.byType[type];
                if (!g) return null;
                const mins = g.totalMinutes;
                return (
                  <div key={type} className="ds-card-row">
                    <Icon name={g.icon} />
                    <span className="ds-card-type">{g.label}</span>
                    <StatCell minutes={mins} type={type} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Desktop: table layout */}
      <div className="ds-table-wrap">
        <table className="ds-table">
          <thead>
            <tr>
              <th></th>
              {activeTypes.map((type) => {
                const g = tripStats.grandByType[type];
                return (
                  <th key={type}><Icon name={g.icon} /> {g.label}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tripStats.days.map((d) => (
              <tr key={d.dayId}>
                <td className="ds-table-label">{d.label} {d.date}</td>
                {activeTypes.map((type) => (
                  <td key={type}>
                    <StatCell minutes={getTypeMinutes(d.stats, type)} type={type} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={clsx(isDrivingWarning(tripStats.grandByType['car']?.totalMinutes ?? 0) && 'ds-row-warn')}>
              <td className="ds-table-label">合計</td>
              {activeTypes.map((type) => (
                <td key={type}>
                  <StatCell minutes={tripStats.grandByType[type]?.totalMinutes ?? 0} type={type} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
