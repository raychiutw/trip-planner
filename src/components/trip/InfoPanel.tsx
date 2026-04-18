import { useMemo } from 'react';
import Icon from '../shared/Icon';
import TodaySummary from './TodaySummary';
import { formatMinutes } from '../../lib/formatUtils';
import { calcDrivingStats } from '../../lib/drivingStats';
import { TRANSPORT_TYPE_ORDER } from '../../lib/constants';
import type { Day } from '../../types/trip';

interface InfoPanelProps {
  currentDay?: Day | null;
}

/** Ocean sidebar — rendered inside `.ocean-side` slot on desktop. Hidden <960px via grid stack. */
export default function InfoPanel({ currentDay }: InfoPanelProps) {
  const dayTransport = useMemo(() => {
    if (!currentDay) return null;
    return calcDrivingStats(currentDay.timeline);
  }, [currentDay]);

  return (
    <>
      {currentDay && currentDay.timeline.length > 0 && (
        <div className="ocean-side-card">
          <div className="ocean-side-card-header">
            <span className="ocean-side-card-title">今日行程</span>
            <Icon name="clock" />
          </div>
          <TodaySummary entries={currentDay.timeline} />
        </div>
      )}

      {currentDay?.hotel && (
        <div className="ocean-side-card">
          <div className="ocean-side-card-header">
            <span className="ocean-side-card-title">今日住宿</span>
            <Icon name="hotel" />
          </div>
          <div className="text-callout font-semibold">{currentDay.hotel.name}</div>
          {currentDay.hotel.checkout && (
            <div className="text-caption text-muted mt-1">退房：{currentDay.hotel.checkout}</div>
          )}
        </div>
      )}

      {dayTransport && (
        <div className="ocean-side-card">
          <div className="ocean-side-card-header">
            <span className="ocean-side-card-title">當日交通</span>
            <Icon name="bus" />
          </div>
          <div className="flex flex-col gap-2">
            {TRANSPORT_TYPE_ORDER.map((key) => {
              const g = dayTransport.byType[key];
              if (!g) return null;
              return (
                <div key={key} className="flex items-center gap-2 text-callout">
                  <Icon name={g.icon} />
                  <span className="flex-1 text-muted">{g.label}</span>
                  <span className="font-semibold tabular-nums">{formatMinutes(g.totalMinutes)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
