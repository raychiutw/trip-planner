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
          <div key={key} className="mb-1">
            <div className="font-semibold mb-1">
              <Icon name={group.icon} /> {group.label}：
              {formatMinutes(group.totalMinutes)}
            </div>
            <div className="flex flex-wrap gap-1 gap-x-3 text-muted text-callout">
              {group.segments.map((seg, i) => (
                <span key={i}>
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

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="my-3 py-3 rounded-sm bg-transparent text-callout">
      <div
        className="flex items-center gap-2 py-2 px-3 -mx-3 select-none cursor-pointer rounded-sm transition-colors duration-fast ease-apple hover:bg-accent-bg"
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
          <span className="inline-block bg-destructive text-accent-foreground text-footnote py-1 px-2 rounded-sm font-semibold ml-2">{DRIVING_WARN_LABEL}</span>
        )}
        <span className="ml-auto text-muted text-subheadline">{isOpen ? ARROW_COLLAPSE : ARROW_EXPAND}</span>
      </div>
      <div className={clsx('hidden print:block py-3 text-body leading-relaxed', isOpen && '!block')}>
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
    <span className={clsx('font-semibold ml-auto flex items-center gap-1', warn && 'text-warning')}>
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
    <div className="my-2">
      <div className="flex items-center gap-2 py-3 font-semibold text-headline">
        <Icon name="bus" /> 交通統計
      </div>

      {/* Mobile: card layout */}
      <div className="flex flex-col gap-2 md:hidden">
        {tripStats.days.map((d) => {
          const isWarning = isDrivingWarning(d.stats.drivingMinutes);
          return (
            <div key={d.dayId} className={clsx('bg-secondary rounded-sm p-3', isWarning && 'bg-warning-bg')}>
              <div className="font-semibold text-callout mb-2">{d.label} {d.date}</div>
              {activeTypes.map((type) => {
                const g = d.stats.byType[type];
                if (!g) return null;
                const mins = g.totalMinutes;
                return (
                  <div key={type} className="flex items-center gap-2 py-1 text-callout">
                    <Icon name={g.icon} />
                    <span className="text-muted min-w-8">{g.label}</span>
                    <StatCell minutes={mins} type={type} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-callout">
          <thead>
            <tr>
              <th></th>
              {activeTypes.map((type) => {
                const g = tripStats.grandByType[type];
                return (
                  <th key={type} className="text-center p-2 font-semibold text-muted whitespace-nowrap"><Icon name={g?.icon ?? ''} /> {g?.label}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tripStats.days.map((d) => (
              <tr key={d.dayId} className="border-t border-border">
                <td className="text-left font-semibold whitespace-nowrap p-2">{d.label} {d.date}</td>
                {activeTypes.map((type) => (
                  <td key={type} className="text-center p-2">
                    <StatCell minutes={getTypeMinutes(d.stats, type)} type={type} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={clsx('border-t-2 border-border font-bold', isDrivingWarning(tripStats.grandByType['car']?.totalMinutes ?? 0) && 'bg-warning-bg')}>
              <td className="text-left font-semibold whitespace-nowrap p-2">合計</td>
              {activeTypes.map((type) => (
                <td key={type} className="text-center p-2">
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
