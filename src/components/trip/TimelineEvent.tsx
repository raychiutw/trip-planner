/* ===== TimelineEvent — Ocean 4-col stop card ===== */

import { memo } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';
import MarkdownText from '../shared/MarkdownText';
import { NavLinks, type NavLocation } from './MapLinks';
import InfoBox, { type InfoBoxData } from './InfoBox';

/* ===== Helpers ===== */

interface ParsedTime { start: string; end: string; duration: number; }

function parseTimeRange(timeStr?: string | null): ParsedTime {
  if (!timeStr) return { start: '', end: '', duration: 0 };
  const parts = timeStr.split('-');
  const start = (parts[0] ?? '').trim();
  const end = parts.length > 1 ? (parts[1] ?? '').trim() : '';
  let duration = 0;
  if (start && end) {
    const s = start.split(':');
    const e = end.split(':');
    if (s.length === 2 && e.length === 2) {
      duration =
        (parseInt(e[0] ?? '0', 10) * 60 + parseInt(e[1] ?? '0', 10)) -
        (parseInt(s[0] ?? '0', 10) * 60 + parseInt(s[1] ?? '0', 10));
      if (duration < 0) duration += 24 * 60;
    }
  }
  return { start, end, duration };
}

function formatDuration(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Map entry type to an Icon name + zh label. */
function deriveTypeMeta(entry: TimelineEntryData): { icon: string; label: string; accent: boolean } {
  // Infer type from travel data / title / description. Fallback: sight.
  const title = (entry.title ?? '').toLowerCase();
  const desc = (entry.description ?? '').toLowerCase();
  const travelType = (entry.travel && typeof entry.travel === 'object' ? entry.travel.type ?? '' : '').toLowerCase();
  const blob = `${title} ${desc} ${travelType}`;

  // Order matters — most specific first.
  if (/機場|flight|機票/.test(blob)) return { icon: 'plane', label: '飛行', accent: false };
  if (/飯店|旅館|hotel|check[- ]?in|民宿/.test(blob)) return { icon: 'hotel', label: '住宿', accent: false };
  if (/餐|食|restaurant|lunch|dinner|breakfast|用餐/.test(blob)) return { icon: 'fork-knife', label: '用餐', accent: true };
  if (/咖啡|café|cafe|coffee/.test(blob)) return { icon: 'coffee', label: '咖啡', accent: true };
  if (/購物|shopping|mall|market/.test(blob)) return { icon: 'shopping', label: '購物', accent: false };
  if (/開車|drive|car|自駕|租車/.test(blob)) return { icon: 'car', label: '移動', accent: false };
  if (/步行|walk|散步/.test(blob)) return { icon: 'walk', label: '散步', accent: false };
  if (/休息|rest|spa|泡湯/.test(blob)) return { icon: 'coffee', label: '休息', accent: false };
  return { icon: 'location-pin', label: '景點', accent: true };
}

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
  index: number;
  isNow?: boolean;
  isPast?: boolean;
}

/* ===== Component ===== */

export const TimelineEvent = memo(function TimelineEvent({ entry, isNow, isPast }: TimelineEventProps) {
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

  const hasBody =
    entry.description ||
    (entry.locations && entry.locations.length > 0) ||
    (entry.infoBoxes && entry.infoBoxes.length > 0);

  return (
    <>
      <div
        className="ocean-stop"
        data-entry-id={entry.id ?? undefined}
        data-now={isNow || undefined}
        data-past={isPast || undefined}
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
          {hasBody && (
            <div className="mt-2 text-(length:--font-size-body) leading-relaxed">
              {entry.description && <MarkdownText text={entry.description} as="div" className="text-muted text-(length:--font-size-callout) my-1" />}
              {entry.locations && entry.locations.length > 0 && <NavLinks locations={entry.locations} />}
              {entry.infoBoxes && entry.infoBoxes.length > 0 &&
                entry.infoBoxes.map((box, i) => <InfoBox key={i} box={box} />)
              }
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ocean-stop-actions">
          {entry.locations && entry.locations[0]?.googleQuery && (
            <a
              className="ocean-round-btn no-underline"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.locations[0].googleQuery)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="開啟地圖"
              title="開啟地圖"
            >
              <Icon name="location-pin" />
            </a>
          )}
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
