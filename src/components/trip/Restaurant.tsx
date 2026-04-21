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
  /** Visual variant: 'hero' = emphasized primary pick (accent outline), 'standard' = regular card. Default: 'standard'. */
  variant?: 'hero' | 'standard';
}

const RESTAURANT_STYLES = `
.rest-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 12px 14px;
  margin: 8px 0;
  transition: border-color 160ms var(--transition-timing-function-apple);
}
.rest-card:last-child { margin-bottom: 0; }
.rest-card:hover { border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }
.rest-card[data-variant="hero"] {
  border-color: var(--color-accent);
  background: linear-gradient(180deg, var(--color-accent-subtle) 0%, var(--color-background) 40%);
  padding: 14px 16px;
}
.rest-card__head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; row-gap: 4px; }
.rest-card__name {
  font-size: 17px; font-weight: 600; color: var(--color-accent);
  letter-spacing: -0.01em; line-height: 1.3;
}
.rest-card__cat {
  font-size: var(--font-size-caption2); font-weight: 500; color: var(--color-muted);
  background: var(--color-tertiary);
  padding: 2px 8px; border-radius: 999px;
  white-space: nowrap;
}
.rest-card__meta {
  font-size: 12px; color: var(--color-muted);
  margin-top: 4px; font-variant-numeric: tabular-nums;
}
.rest-card__desc {
  font-size: 14px; color: var(--color-foreground);
  margin-top: 6px; line-height: 1.55;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.rest-card__note {
  font-size: 13px; color: var(--color-muted);
  margin-top: 4px; line-height: 1.55;
}
.rest-card__reserve {
  font-size: 13px; color: var(--color-muted);
  margin-top: 6px; display: inline-flex; align-items: center; gap: 4px;
}
.rest-card__reserve a { color: var(--color-accent); text-decoration: none; }
.rest-card__reserve a:hover { text-decoration: underline; }
`;

/** Parse reservation field — may be JSON string, object, or plain string. */
function parseReservation(raw: string | ReservationInfo | null | undefined): ReservationInfo | string | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string' && raw.startsWith('{')) {
    try { return JSON.parse(raw) as ReservationInfo; } catch { /* fallback to string */ }
  }
  return raw;
}

/** Render reservation info based on type. */
function ReservationDisplay({ data, fallbackUrl }: { data: ReservationInfo | string; fallbackUrl?: string }) {
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

export const Restaurant = memo(function Restaurant({ restaurant: r, variant = 'standard' }: RestaurantProps) {
  const parsed = parseReservation(r.reservation);
  const reservationEl = parsed ? (
    <ReservationDisplay data={parsed} fallbackUrl={r.reservationUrl ?? undefined} />
  ) : null;

  // rating · price · hours
  const metaParts: string[] = [];
  if (typeof r.googleRating === 'number') metaParts.push(`★ ${r.googleRating.toFixed(1)}`);
  if (r.price) metaParts.push(r.price);
  if (r.hours) metaParts.push(r.hours);

  return (
    <div className="rest-card" data-variant={variant}>
      <style>{RESTAURANT_STYLES}</style>
      <div className="rest-card__head">
        <span className="rest-card__name">{r.name}</span>
        {r.category && <span className="rest-card__cat">{r.category}</span>}
        {r.location && <MapLinks location={r.location} inline />}
      </div>
      {metaParts.length > 0 && (
        <div className="rest-card__meta">{metaParts.join(' · ')}</div>
      )}
      {r.description && <MarkdownText text={r.description} as="div" className="rest-card__desc" inline />}
      {r.note && <MarkdownText text={r.note} as="div" className="rest-card__note" inline />}
      {reservationEl && <span className="rest-card__reserve">{reservationEl}</span>}
    </div>
  );
});

export default Restaurant;
