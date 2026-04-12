/* ===== Restaurant Component ===== */
/* Renders a single restaurant recommendation card (used inside InfoBox and standalone) */

import { memo } from 'react';
import Icon from '../shared/Icon';
import MarkdownText from '../shared/MarkdownText';
import MapLinks, { type MapLocation } from './MapLinks';
import { escUrl } from '../../lib/sanitize';

/** Structured reservation info (JSON format in D1). */
interface ReservationInfo {
  available?: string;
  method?: string;
  url?: string;
  phone?: string;
  recommended?: boolean;
}

/** Restaurant data shape from D1 API. */
export interface RestaurantData {
  name: string;
  sortOrder?: number | null;
  category?: string | null;
  hours?: string | null;
  price?: string | null;
  reservation?: string | ReservationInfo | null;
  reservationUrl?: string | null;
  description?: string | null;
  note?: string | null;
  googleRating?: number | null;
  location?: MapLocation | null;
}

interface RestaurantProps {
  restaurant: RestaurantData;
}

/** Parse reservation field — may be JSON string, object, or plain string. */
function parseReservation(raw: string | ReservationInfo | null | undefined): ReservationInfo | string | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  // Try JSON parse
  if (typeof raw === 'string' && raw.startsWith('{')) {
    try { return JSON.parse(raw) as ReservationInfo; } catch { /* fallback to string */ }
  }
  return raw;
}

/** Render reservation info based on type. */
function ReservationDisplay({ data, fallbackUrl }: { data: ReservationInfo | string; fallbackUrl?: string }) {
  // Plain string — legacy format
  if (typeof data === 'string') {
    const url = escUrl(fallbackUrl);
    return (
      <>
        <Icon name="phone" />{' '}
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">{data}</a>
        ) : (
          data
        )}
      </>
    );
  }

  // JSON object — structured format
  if (data.available === 'no') return null;

  if (data.method === 'website' && data.url) {
    const url = escUrl(data.url);
    return url ? (
      <>
        <Icon name="phone" />{' '}
        <a href={url} target="_blank" rel="noopener noreferrer">建議訂位</a>
      </>
    ) : null;
  }

  if (data.method === 'phone' && data.phone) {
    return (
      <>
        <Icon name="phone" />{' '}
        <a href={`tel:${data.phone}`}>{data.phone}</a>
      </>
    );
  }

  return null;
}

export const Restaurant = memo(function Restaurant({ restaurant: r }: RestaurantProps) {
  const parsed = parseReservation(r.reservation);
  const reservationEl = parsed ? (
    <ReservationDisplay data={parsed} fallbackUrl={r.reservationUrl ?? undefined} />
  ) : null;

  // Build meta segments: rating · price · hours
  const metaParts: string[] = [];
  if (typeof r.googleRating === 'number') metaParts.push(`★ ${r.googleRating.toFixed(1)}`);
  if (r.price) metaParts.push(r.price);
  if (r.hours) metaParts.push(r.hours);

  return (
    <div className="p-3 px-4 leading-normal bg-accent-subtle rounded-sm my-2 last:mb-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-accent text-headline">
          {r.name}
        </span>
        {r.category && <span className="text-footnote text-muted bg-secondary py-1 px-2 rounded-full">{r.category}</span>}
        {r.location && <MapLinks location={r.location} inline />}
      </div>
      {metaParts.length > 0 && (
        <div className="text-footnote text-muted mt-1">
          {metaParts.join(' · ')}
        </div>
      )}
      {r.description && <MarkdownText text={r.description} as="div" className="text-callout text-muted mt-1 line-clamp-2" inline />}
      {r.note && <MarkdownText text={r.note} as="div" className="text-callout text-muted mt-1" inline />}
      {reservationEl && (
        <span className="block mt-1 text-callout text-muted">
          {reservationEl}
        </span>
      )}
    </div>
  );
});

export default Restaurant;
