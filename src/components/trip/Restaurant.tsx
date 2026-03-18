/* ===== Restaurant Component ===== */
/* Renders a single restaurant recommendation card (used inside InfoBox and standalone) */

import Icon from '../shared/Icon';
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

export default function Restaurant({ restaurant: r }: RestaurantProps) {
  const parsed = parseReservation(r.reservation);
  const hasHours = !!r.hours;
  const reservationEl = parsed ? (
    <ReservationDisplay data={parsed} fallbackUrl={r.reservationUrl ?? undefined} />
  ) : null;
  const showMeta = hasHours || !!reservationEl;

  return (
    <div className="restaurant-choice">
      {r.category && <strong>{r.category}：</strong>}
      {r.name}
      {typeof r.googleRating === 'number' && (
        <>{' '}<span className="rating">★ {r.googleRating.toFixed(1)}</span></>
      )}
      {r.description && <>{' — '}{r.description}</>}
      {r.price && <>，{r.price}</>}
      <br />
      {r.location && <MapLinks location={r.location} inline />}
      {showMeta && (
        <span className="restaurant-meta">
          {hasHours && (
            <><Icon name="clock" /> {r.hours}</>
          )}
          {hasHours && reservationEl && ' ｜ '}
          {reservationEl}
        </span>
      )}
    </div>
  );
}
