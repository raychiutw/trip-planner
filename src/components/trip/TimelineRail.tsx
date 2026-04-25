/**
 * TimelineRail — 桌機與手機統一 compact editorial rail（PR 11 / v2.0.2.7 後同時服務兩端）
 *
 * Structure:
 *  - Left gutter: right-aligned time
 *  - Vertical rail: 1px line connecting all dots
 *  - Dot: numbered circle, accent border for sight/food
 *  - Row: small type icon + name + (type · duration · rating)
 *  - Click row → navigate /trip/:tripId/stop/:entryId (details + map)
 *
 * Inline expand removed (PR2): note / infoBoxes / restaurants now live on the
 * StopDetailPage. Row = tap target for navigation.
 */

import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTripId } from '../../contexts/TripIdContext';
import Icon from '../shared/Icon';
import type { TimelineEntryData } from './TimelineEvent';
import { parseTimeRange, formatDuration, deriveTypeMeta } from '../../lib/timelineUtils';

interface TimelineRailProps {
  events: TimelineEntryData[];
  /** Activate "now" indicator for this index */
  nowIndex?: number;
}

const TimelineRail = memo(function TimelineRail({ events, nowIndex = -1 }: TimelineRailProps) {
  const navigate = useNavigate();
  const tripId = useTripId();

  if (!events || events.length === 0) return null;

  const firstTime = parseTimeRange(events[0]?.time).start;
  const lastTime = parseTimeRange(events[events.length - 1]?.time).end ||
                   parseTimeRange(events[events.length - 1]?.time).start;

  const handleOpenStop = (entryId: number | null | undefined) => {
    if (!tripId || entryId == null) return;
    navigate(`/trip/${tripId}/stop/${entryId}`, {
      state: { scrollAnchor: `entry-${entryId}` },
    });
  };

  return (
    <div className="ocean-rail">
      <div className="ocean-rail-header">
        <span className="ocean-rail-eyebrow">Itinerary</span>
        <span className="ocean-rail-meta">
          {events.length} stops{firstTime && lastTime ? ` · ${firstTime}–${lastTime}` : ''}
        </span>
      </div>
      <div className="ocean-rail-body">
        <div className="ocean-rail-line" aria-hidden="true" />
        {events.map((entry, i) => {
          const parsed = parseTimeRange(entry.time);
          const meta = deriveTypeMeta(entry);
          const isPast = nowIndex >= 0 && i < nowIndex;
          const isNow = nowIndex >= 0 && i === nowIndex;
          const isLast = i === events.length - 1;
          const canOpen = entry.id != null && tripId != null;
          return (
            <div
              key={entry.id ?? i}
              className="ocean-rail-item"
              data-now={isNow || undefined}
              data-past={isPast || undefined}
              data-accent={meta.accent || undefined}
              data-last={isLast || undefined}
              data-scroll-anchor={entry.id != null ? `entry-${entry.id}` : undefined}
            >
              <span className="ocean-rail-time">{parsed.start}</span>
              <span className="ocean-rail-dot" aria-hidden="true">{i + 1}</span>
              <button
                type="button"
                className="ocean-rail-head"
                onClick={() => handleOpenStop(entry.id)}
                disabled={!canOpen}
                aria-label={`查看景點：${entry.title ?? '（無標題）'}`}
              >
                <span className="ocean-rail-icon" aria-hidden="true">
                  <Icon name={meta.icon} />
                </span>
                <span className="ocean-rail-content">
                  <span className="ocean-rail-name">{entry.title ?? ''}</span>
                  <span className="ocean-rail-sub">
                    <span className="ocean-rail-type">{meta.label}</span>
                    {formatDuration(parsed.duration) && (
                      <>
                        <span className="ocean-rail-sep">·</span>
                        <span>{formatDuration(parsed.duration)}</span>
                      </>
                    )}
                    {typeof entry.googleRating === 'number' && (
                      <>
                        <span className="ocean-rail-sep">·</span>
                        <span>★ {entry.googleRating.toFixed(1)}</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="ocean-rail-caret" aria-hidden="true">›</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default TimelineRail;
