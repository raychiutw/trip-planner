/* ===== Shop Component ===== */
/* Renders a single shopping recommendation card (used inside InfoBox) */

import { memo } from 'react';
import Icon from '../shared/Icon';
import MarkdownText from '../shared/MarkdownText';
import MapLinks, { type MapLocation } from './MapLinks';

/** Shop data shape from dist JSON infoBoxes.shops[]. */
export interface ShopData {
  name: string;
  category?: string | null;
  hours?: string | null;
  mustBuy?: string[] | null;
  description?: string | null;
  note?: string | null;
  googleRating?: number | null;
  location?: MapLocation | null;
}

interface ShopProps {
  shop: ShopData;
}

const Shop = memo(function Shop({ shop }: ShopProps) {
  return (
    <div className="p-3 px-4 leading-normal bg-accent-subtle rounded-sm my-2 last:mb-0">
      {shop.category && <strong>{shop.category}：</strong>}
      {shop.name}
      {typeof shop.googleRating === 'number' && (
        <>{' '}<span className="text-accent text-caption shrink-0">★ {shop.googleRating.toFixed(1)}</span></>
      )}
      <br />
      {shop.location && <MapLinks location={shop.location} inline />}
      {shop.hours && (
        <span className="block mt-1 text-callout text-muted">
          <Icon name="clock" /> {shop.hours}
        </span>
      )}
      {shop.mustBuy && shop.mustBuy.length > 0 && (
        <div className="mt-1 text-callout">
          <Icon name="gift" /> 必買：{shop.mustBuy.join('、')}
        </div>
      )}
      {shop.description && (
        <MarkdownText text={shop.description} as="div" className="mt-1 text-callout text-muted" inline />
      )}
      {shop.note && (
        <MarkdownText text={shop.note} as="div" className="mt-1 text-callout text-muted" inline />
      )}
    </div>
  );
});

export default Shop;
