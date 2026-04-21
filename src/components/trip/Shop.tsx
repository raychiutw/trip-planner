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

const SHOP_STYLES = `
.shop-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 12px 14px;
  margin: 8px 0;
  transition: border-color 160ms var(--transition-timing-function-apple);
}
.shop-card:last-child { margin-bottom: 0; }
.shop-card:hover { border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }
.shop-card__head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; row-gap: 4px; }
.shop-card__name {
  font-size: 17px; font-weight: 600; color: var(--color-foreground);
  letter-spacing: -0.01em; line-height: 1.3;
}
.shop-card__cat {
  font-size: var(--font-size-caption2); font-weight: 500; color: var(--color-muted);
  background: var(--color-tertiary);
  padding: 2px 8px; border-radius: 999px;
  white-space: nowrap;
}
.shop-card__rating {
  font-size: 12px; font-weight: 600; color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}
.shop-card__hours {
  font-size: 12px; color: var(--color-muted);
  margin-top: 4px; font-variant-numeric: tabular-nums;
  display: inline-flex; align-items: center; gap: 4px;
}
.shop-card__mustbuy {
  margin-top: 10px;
  border-top: 1px dashed var(--color-border);
  padding-top: 10px;
}
.shop-card__mustbuy-label {
  font-size: var(--font-size-eyebrow); font-weight: 600; color: var(--color-accent);
  letter-spacing: 0.18em; text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 4px;
  margin-bottom: 6px;
}
.shop-card__mustbuy-list {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.shop-card__mustbuy-chip {
  font-size: 12px; font-weight: 500;
  color: var(--color-accent);
  background: var(--color-accent-subtle);
  padding: 4px 10px; border-radius: 999px;
  letter-spacing: -0.005em;
}
.shop-card__desc {
  font-size: 13px; color: var(--color-muted);
  margin-top: 6px; line-height: 1.55;
}
.shop-card__note {
  font-size: 13px; color: var(--color-muted);
  margin-top: 4px; line-height: 1.55;
}
`;

const Shop = memo(function Shop({ shop }: ShopProps) {
  return (
    <div className="shop-card">
      <style>{SHOP_STYLES}</style>
      <div className="shop-card__head">
        <span className="shop-card__name">{shop.name}</span>
        {shop.category && <span className="shop-card__cat">{shop.category}</span>}
        {typeof shop.googleRating === 'number' && (
          <span className="shop-card__rating">★ {shop.googleRating.toFixed(1)}</span>
        )}
        {shop.location && <MapLinks location={shop.location} inline />}
      </div>

      {shop.hours && (
        <span className="shop-card__hours">
          <Icon name="clock" /> {shop.hours}
        </span>
      )}

      {shop.mustBuy && shop.mustBuy.length > 0 && (
        <div className="shop-card__mustbuy">
          <div className="shop-card__mustbuy-label">
            <Icon name="gift" /> 必買
          </div>
          <div className="shop-card__mustbuy-list">
            {shop.mustBuy.map((item, i) => (
              <span key={i} className="shop-card__mustbuy-chip">{item}</span>
            ))}
          </div>
        </div>
      )}

      {shop.description && (
        <MarkdownText text={shop.description} as="div" className="shop-card__desc" inline />
      )}
      {shop.note && (
        <MarkdownText text={shop.note} as="div" className="shop-card__note" inline />
      )}
    </div>
  );
});

export default Shop;
