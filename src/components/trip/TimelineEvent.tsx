/* ===== TimelineEvent Component ===== */
/* Renders a single timeline entry: time flag, card (title, description, */
/* locations, info boxes), and optional travel segment to next entry.    */

import { memo } from 'react';
import Icon from '../shared/Icon';
import MarkdownText from '../shared/MarkdownText';
import { NavLinks, type NavLocation } from './MapLinks';
import InfoBox, { type InfoBoxData } from './InfoBox';

// ---------------------------------------------------------------------------
// Helpers — mirrors parseTimeRange / formatDuration from app.js
// ---------------------------------------------------------------------------

interface ParsedTime {
  start: string;
  end: string;
  duration: number;
}

function parseTimeRange(timeStr?: string | null): ParsedTime {
  if (!timeStr) return { start: '', end: '', duration: 0 };
  const parts = timeStr.split('-');
  const start = parts[0].trim();
  const end = parts.length > 1 ? parts[1].trim() : '';
  let duration = 0;
  if (start && end) {
    const s = start.split(':');
    const e = end.split(':');
    if (s.length === 2 && e.length === 2) {
      duration =
        (parseInt(e[0], 10) * 60 + parseInt(e[1], 10)) -
        (parseInt(s[0], 10) * 60 + parseInt(s[1], 10));
      if (duration < 0) duration += 24 * 60;
    }
  }
  return { start, end, duration };
}

function formatDuration(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h} 小時 ${m} 分`;
  if (h > 0) return `${h} 小時`;
  return `${m} 分`;
}

// ---------------------------------------------------------------------------
// Travel data shape (from dist JSON entry.travel)
// ---------------------------------------------------------------------------

export interface TravelData {
  type?: string | null;
  text?: string | null;
}

// ---------------------------------------------------------------------------
// Timeline entry data shape (from dist JSON content.timeline[])
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimelineEventProps {
  entry: TimelineEntryData;
  /** 1-based index displayed in the flag */
  index: number;
}

export const TimelineEvent = memo(function TimelineEvent({ entry, index }: TimelineEventProps) {
  const parsed = parseTimeRange(entry.time);
  const hasBody =
    entry.description ||
    (entry.locations && entry.locations.length > 0) ||
    (entry.infoBoxes && entry.infoBoxes.length > 0);
  const durationText = formatDuration(parsed.duration);

  // Resolve travel data — may be an object or a legacy string
  const travel: TravelData | null =
    entry.travel && typeof entry.travel === 'object'
      ? entry.travel
      : typeof entry.travel === 'string'
        ? { text: entry.travel, type: '' }
        : null;

  const travelText = travel?.text ?? '';
  const travelType = travel?.type ?? '';

  return (
    <>
      {/* ---- Main event ---- */}
      <div className="tl-event expanded">
        {/* Arrival flag */}
        <div className="tl-flag tl-flag-arrive">
          <span className="tl-flag-num">{index}</span>
          <span className="tl-time-start">
            {parsed.start}
            {parsed.end ? `-${parsed.end}` : ''}
          </span>
        </div>

        {/* Segment: dashed line + card */}
        <div className="tl-segment">
          <div className="tl-card">
            {/* Card header */}
            <div className="tl-card-header">
              <span className="tl-title">{entry.title ?? ''}</span>
              {typeof entry.googleRating === 'number' && (
                <>{' '}<span className="rating">★ {entry.googleRating.toFixed(1)}</span></>
              )}
              {durationText && (
                <span className="tl-duration">
                  <Icon name="clock" /> {durationText}
                </span>
              )}
            </div>

            {/* Note */}
            {entry.note && <MarkdownText text={entry.note} as="div" className="tl-desc" />}

            {/* Body: description + locations + info boxes */}
            {hasBody && (
              <div className="tl-body">
                {entry.description && <MarkdownText text={entry.description} as="div" className="tl-desc" />}
                {entry.locations && entry.locations.length > 0 && (
                  <NavLinks locations={entry.locations} />
                )}
                {entry.infoBoxes && entry.infoBoxes.length > 0 &&
                  entry.infoBoxes.map((box, i) => (
                    <InfoBox key={i} box={box} />
                  ))
                }
              </div>
            )}
          </div>{/* end tl-card */}
        </div>{/* end tl-segment */}
      </div>{/* end tl-event */}

      {/* ---- Travel segment to next entry ---- */}
      {travel && travelText && (
        <div className="tl-segment tl-segment-travel">
          <div className="tl-travel-content">
            {travelType && (
              <span className="tl-travel-icon">
                <Icon name={travelType} />
              </span>
            )}
            <span className="tl-travel-text">{travelText}</span>
          </div>
        </div>
      )}
    </>
  );
});

export default TimelineEvent;
