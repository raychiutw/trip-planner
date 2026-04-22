/* ===== TimelineEvent — Ocean 4-col stop card ===== */

import { memo } from 'react';
import clsx from 'clsx';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../shared/Icon';
import MarkdownText from '../shared/MarkdownText';
import { type NavLocation } from './MapLinks';
import { type InfoBoxData } from './InfoBox';
import { parseTimeRange, formatDuration, deriveTypeMeta } from '../../lib/timelineUtils';

/* ===== Types ===== */

export interface TravelData { type?: string | null; text?: string | null; }

export interface TimelineEntryData {
  id?: number | null;
  time?: string | null;
  title?: string | null;
  description?: string | null;
  note?: string | null;
  googleRating?: number | null;
  source?: string | null;
  travel?: TravelData | string | null;
  locations?: NavLocation[] | null;
  infoBoxes?: InfoBoxData[] | null;
}

interface TimelineEventProps {
  entry: TimelineEntryData;
  isNow?: boolean;
  isPast?: boolean;
}

/* ===== Component =====
 *
 * Entire stop card is click/Enter target → navigate to /trip/:id/stop/:entryId.
 * Inline expand removed (PR2): description / locations / infoBoxes live on
 * StopDetailPage. Only `note` stays inline for quick scan.
 * Keyboard: Tab focuses the card, Enter / Space activates navigation.
 */

export const TimelineEvent = memo(function TimelineEvent({ entry, isNow, isPast }: TimelineEventProps) {
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId: string }>();
  const parsed = parseTimeRange(entry.time);
  const durationText = formatDuration(parsed.duration);
  const meta = deriveTypeMeta(entry);

  const travel: TravelData | null =
    entry.travel && typeof entry.travel === 'object'
      ? entry.travel
      : typeof entry.travel === 'string'
        ? { text: entry.travel, type: '' }
        : null;
  const travelText = travel?.text ?? '';
  const travelType = travel?.type ?? '';

  const canOpen = entry.id != null && tripId != null;

  const handleOpen = () => {
    if (!canOpen) return;
    navigate(`/trip/${tripId}/stop/${entry.id}`, {
      state: { scrollAnchor: `entry-${entry.id}` },
    });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!canOpen) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  return (
    <>
      <div
        className={clsx('ocean-stop', canOpen && 'ocean-stop-clickable')}
        data-entry-id={entry.id ?? undefined}
        data-scroll-anchor={entry.id != null ? `entry-${entry.id}` : undefined}
        data-now={isNow || undefined}
        data-past={isPast || undefined}
        role={canOpen ? 'button' : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onClick={handleOpen}
        onKeyDown={handleKey}
        aria-label={canOpen ? `查看景點：${entry.title ?? '（無標題）'}` : undefined}
      >
        {/* Time column */}
        <div className="ocean-stop-time">
          <div className="ocean-stop-t">{parsed.start || '—'}</div>
          {durationText && <div className="ocean-stop-dur">{durationText}</div>}
        </div>

        {/* Icon box */}
        <div className="ocean-stop-icon" data-accent={meta.accent || undefined}>
          <Icon name={meta.icon} />
        </div>

        {/* Content */}
        <div className="ocean-stop-content">
          <div className="ocean-stop-meta">
            <span className="ocean-stop-type" data-accent={meta.accent || undefined}>{meta.label}</span>
            <span className="ocean-stop-name">{entry.title ?? ''}</span>
            {typeof entry.googleRating === 'number' && (
              <span className="ocean-stop-rating">★ {entry.googleRating.toFixed(1)}</span>
            )}
            {parsed.end && (
              <span className="ocean-stop-rating">
                <Icon name="clock" /> {parsed.start}–{parsed.end}
              </span>
            )}
          </div>
          {entry.note && <MarkdownText text={entry.note} as="div" className="ocean-stop-note" />}
        </div>

        {/* Actions — chevron hint toward detail */}
        <div className="ocean-stop-actions" aria-hidden="true">
          <span className="ocean-stop-chevron">›</span>
        </div>
      </div>

      {/* Travel connector */}
      {travel && travelText && (
        <div className={clsx('ocean-travel', isPast && 'opacity-60')}>
          {travelType && <Icon name={travelType} />}
          <span>{travelText}</span>
        </div>
      )}
    </>
  );
});

export default TimelineEvent;
