/* ===== TimelineEvent Component ===== */
/* Renders a single timeline entry: time flag, card (title, description, */
/* locations, info boxes), and optional travel segment to next entry.    */

import { memo } from 'react';
import clsx from 'clsx';
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
  /** Whether this is the current active entry */
  isNow?: boolean;
  /** Whether this entry's time has passed */
  isPast?: boolean;
}

export const TimelineEvent = memo(function TimelineEvent({ entry, index, isNow, isPast }: TimelineEventProps) {
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
      <div
        className={clsx(
          'relative',
          isPast && 'opacity-55',
        )}
        data-entry-id={entry.id ?? undefined}
        data-now={isNow || undefined}
      >
        {/* Arrival flag */}
        <div
          className="inline-flex items-center gap-2 py-1 pr-5 pl-3 font-bold text-(length:--font-size-footnote) leading-tight bg-(--color-accent) text-(--color-accent-foreground) rounded-l-(--radius-xs)"
          style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)' }}
        >
          <span
            className={clsx(
              'relative text-[0.8em] bg-white/25 w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0',
              isNow && 'shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_50%,transparent)]',
            )}
          >
            {index}
            {/* Pulse dot for "now" indicator — replaces ::after pseudo-element */}
            {isNow && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-(--color-accent) animate-[tl-pulse_2s_infinite]" />
            )}
          </span>
          <span>
            {parsed.start}
            {parsed.end ? `-${parsed.end}` : ''}
          </span>
        </div>

        {/* Segment: dashed line + card */}
        <div
          data-tl-segment
          className={clsx(
            'ml-3 py-2 pl-4 border-0 border-l-2 border-dashed border-(--color-border)',
            isNow && 'border-solid! border-(--color-accent)!',
          )}
        >
          <div
            data-tl-card
            className={clsx(
              'rounded-(--radius-sm) px-4 py-3',
              isNow && 'shadow-(--shadow-md) ring-[1.5px] ring-(--color-accent) scale-[1.01]',
              isPast && '!shadow-none opacity-75',
            )}
          >
            {/* Card header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-(length:--font-size-title3) leading-tight text-(--color-accent) flex-1 min-w-0">
                {entry.title ?? ''}
              </span>
              {typeof entry.googleRating === 'number' && (
                <>{' '}<span className="text-(--color-accent) text-(length:--font-size-caption) shrink-0">★ {entry.googleRating.toFixed(1)}</span></>
              )}
              {durationText && (
                <span className="text-(length:--font-size-footnote) text-(--color-muted) whitespace-nowrap shrink-0 inline-flex items-center gap-1">
                  <Icon name="clock" /> {durationText}
                </span>
              )}
            </div>

            {/* Note */}
            {entry.note && <MarkdownText text={entry.note} as="div" className="text-(--color-muted) my-1 text-(length:--font-size-callout)" />}

            {/* Body: description + locations + info boxes */}
            {hasBody && (
              <div className="grid grid-rows-[1fr] py-1 text-(length:--font-size-body) leading-relaxed transition-[grid-template-rows] duration-(--transition-duration-normal) ease-(--transition-timing-function-apple) [&>*]:overflow-hidden">
                {entry.description && <MarkdownText text={entry.description} as="div" className="text-(--color-muted) my-1 text-(length:--font-size-callout)" />}
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
          </div>{/* end card */}
        </div>{/* end segment */}
      </div>{/* end event */}

      {/* ---- Travel segment to next entry ---- */}
      {travel && travelText && (
        <div className="ml-3 py-2 pl-4 border-0 border-l-2 border-dashed border-(--color-border)">
          <div className="flex items-center gap-2 py-2 px-4 text-footnote text-muted bg-accent-bg rounded-sm cursor-default">
            {travelType && (
              <span className="inline-flex items-center [&_.svg-icon]:w-[1.1em] [&_.svg-icon]:h-[1.1em]">
                <Icon name={travelType} />
              </span>
            )}
            <span className="flex-1">{travelText}</span>
          </div>
        </div>
      )}
    </>
  );
});

export default TimelineEvent;
