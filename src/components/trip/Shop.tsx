/* ===== Shop Component ===== */
/* Renders a single shopping recommendation card (used inside InfoBox) */

import Icon from '../shared/Icon';
import MapLinks, { type MapLocation } from './MapLinks';

/** Shop data shape from dist JSON infoBoxes.shops[]. */
export interface ShopData {
  name: string;
  category?: string | null;
  hours?: string | null;
  mustBuy?: string[] | null;
  note?: string | null;
  googleRating?: number | null;
  location?: MapLocation | null;
}

interface ShopProps {
  shop: ShopData;
}

export default function Shop({ shop }: ShopProps) {
  return (
    <div className="restaurant-choice">
      {shop.category && <strong>{shop.category}：</strong>}
      {shop.name}
      {typeof shop.googleRating === 'number' && (
        <>{' '}<span className="rating">★ {shop.googleRating.toFixed(1)}</span></>
      )}
      <br />
      {shop.location && <MapLinks location={shop.location} inline />}
      {shop.hours && (
        <span className="restaurant-meta">
          <Icon name="clock" /> {shop.hours}
        </span>
      )}
      {shop.mustBuy && shop.mustBuy.length > 0 && (
        <div className="shop-must-buy">
          <Icon name="gift" /> 必買：{shop.mustBuy.join('、')}
        </div>
      )}
    </div>
  );
}
