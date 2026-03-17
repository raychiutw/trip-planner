/* ===== Restaurant Component ===== */
/* Renders a single restaurant recommendation card (used inside InfoBox and standalone) */

import Icon from '../shared/Icon';
import MapLinks, { type MapLocation } from './MapLinks';
import { escUrl } from '../../lib/sanitize';

/** Restaurant data shape from dist JSON infoBoxes.restaurants[]. */
export interface RestaurantData {
  name: string;
  category?: string | null;
  hours?: string | null;
  price?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
  description?: string | null;
  note?: string | null;
  googleRating?: number | null;
  location?: MapLocation | null;
}

interface RestaurantProps {
  restaurant: RestaurantData;
}

export default function Restaurant({ restaurant: r }: RestaurantProps) {
  const resUrl = escUrl(r.reservationUrl);

  // Build meta line: hours | reservation
  const hasHours = !!r.hours;
  const hasReservation = !!r.reservation;
  const showMeta = hasHours || hasReservation;

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
          {hasHours && hasReservation && ' ｜ '}
          {hasReservation && (
            <>
              <Icon name="phone" />{' '}
              {resUrl ? (
                <a href={resUrl} target="_blank" rel="noopener noreferrer">
                  {r.reservation}
                </a>
              ) : (
                r.reservation
              )}
            </>
          )}
        </span>
      )}
    </div>
  );
}
