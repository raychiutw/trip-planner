/* ===== InfoBox Component ===== */
/* Renders an info box — tips, notes, parking, restaurants, shopping, gas stations, etc. */

import { memo } from 'react';
import Icon from '../shared/Icon';
import MapLinks, { type MapLocation } from './MapLinks';
import Restaurant, { type RestaurantData } from './Restaurant';
import Shop, { type ShopData } from './Shop';
import { escUrl } from '../../lib/sanitize';

// ---------------------------------------------------------------------------
// Souvenir item shape
// ---------------------------------------------------------------------------

interface SouvenirItem {
  name: string;
  url?: string | null;
  note?: string | null;
  location?: MapLocation | null;
}

// ---------------------------------------------------------------------------
// Gas station shape
// ---------------------------------------------------------------------------

interface GasStationDetail {
  name: string;
  address?: string | null;
  hours?: string | null;
  service?: string | null;
  phone?: string | null;
  location?: MapLocation | null;
}

// ---------------------------------------------------------------------------
// InfoBox data — union of all known box types
// ---------------------------------------------------------------------------

export type InfoBoxType = 'reservation' | 'parking' | 'souvenir' | 'restaurants' | 'shopping' | 'gasStation';

export interface InfoBoxData {
  type: InfoBoxType;
  title?: string | null;
  content?: string | null;

  /* reservation */
  items?: (string | SouvenirItem)[] | null;
  notes?: string | null;

  /* parking */
  price?: string | null;
  location?: MapLocation | null;

  /* souvenir */
  // items is reused (string[] for reservation, SouvenirItem[] for souvenir)
  // We handle the polymorphism inside the component.

  /* restaurants */
  restaurants?: RestaurantData[] | null;

  /* shopping */
  shops?: ShopData[] | null;

  /* gasStation */
  googleRating?: number | null;
  station?: GasStationDetail | null;
}

// ---------------------------------------------------------------------------
// Grid helper — mirrors gridClass() in app.js
// ---------------------------------------------------------------------------

function gridClass(count: number): string {
  if (count === 1) return 'info-box-grid grid-1';
  return count % 2 === 0 ? 'info-box-grid grid-even' : 'info-box-grid grid-odd';
}

// ---------------------------------------------------------------------------
// Sub-renderers per box type
// ---------------------------------------------------------------------------

function ReservationBox({ box }: { box: InfoBoxData }) {
  return (
    <div className="info-box reservation">
      {box.title && <><strong>{box.title}</strong><br /></>}
      {box.items && box.items.length > 0 &&
        box.items.filter((item): item is string => typeof item === 'string').map((item, i) => (
          <span key={i}>{item}<br /></span>
        ))
      }
      {box.notes && <>{box.notes}</>}
    </div>
  );
}

function ParkingBox({ box }: { box: InfoBoxData }) {
  return (
    <div className="info-box parking">
      {box.title && (
        <><Icon name="parking" /> <strong>{box.title}</strong></>
      )}
      {box.price && <>：{box.price}</>}
      {box.location && <>{' '}<MapLinks location={box.location} inline /></>}
    </div>
  );
}

function SouvenirBox({ box }: { box: InfoBoxData }) {
  // items here are SouvenirItem objects (not strings)
  const items = (box.items ?? []).filter((item): item is SouvenirItem => typeof item === 'object' && item !== null);
  return (
    <div className="info-box souvenir">
      {box.title && <><Icon name="gift" /> <strong>{box.title}</strong><br /></>}
      {items.map((item, i) => {
        const itemUrl = escUrl(item.url);
        return (
          <span key={i}>
            <Icon name="gift" />{' '}
            {itemUrl ? (
              <a href={itemUrl} target="_blank" rel="noopener noreferrer">{item.name}</a>
            ) : (
              item.name
            )}
            {item.note && <>（{item.note}）</>}
            {item.location && <>{' '}<MapLinks location={item.location} inline /></>}
            <br />
          </span>
        );
      })}
    </div>
  );
}

function RestaurantsBox({ box }: { box: InfoBoxData }) {
  const rItems = box.restaurants ?? [];
  const rTitle = box.title || (rItems.length > 1 ? `${rItems.length}選一` : '推薦餐廳');
  return (
    <div className="info-box restaurants">
      <Icon name="utensils" /> <strong>{rTitle}：</strong>
      <div className={gridClass(rItems.length)}>
        {rItems.map((r, i) => (
          <Restaurant key={i} restaurant={r} />
        ))}
      </div>
    </div>
  );
}

function ShoppingBox({ box }: { box: InfoBoxData }) {
  const sItems = box.shops ?? [];
  const sTitle = box.title || (sItems.length > 1 ? '推薦購物' : '附近購物');
  return (
    <div className="info-box shopping">
      <Icon name="shopping" /> <strong>{sTitle}：</strong>
      <div className={gridClass(sItems.length)}>
        {sItems.map((s, i) => (
          <Shop key={i} shop={s} />
        ))}
      </div>
    </div>
  );
}

function GasStationBox({ box }: { box: InfoBoxData }) {
  const gsTitle = box.title || '加油站';
  const st = box.station;
  return (
    <div className="info-box gas-station">
      <Icon name="gas-station" /> <strong>{gsTitle}</strong>
      {typeof box.googleRating === 'number' && (
        <>{' '}<span className="rating">★ {box.googleRating.toFixed(1)}</span></>
      )}
      {st && (
        <div className="gas-station-detail">
          <strong>{st.name}</strong><br />
          {st.address && <>{st.address}<br /></>}
          {st.hours && <><Icon name="clock" /> {st.hours}<br /></>}
          {st.service && <>{st.service}<br /></>}
          {st.phone && <><Icon name="phone" /> {st.phone}</>}
          {st.location && <><br /><MapLinks location={st.location} inline /></>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main InfoBox component
// ---------------------------------------------------------------------------

interface InfoBoxProps {
  box: InfoBoxData;
}

export const InfoBox = memo(function InfoBox({ box }: InfoBoxProps) {
  switch (box.type) {
    case 'reservation':
      return <ReservationBox box={box} />;
    case 'parking':
      return <ParkingBox box={box} />;
    case 'souvenir':
      return <SouvenirBox box={box} />;
    case 'restaurants':
      return <RestaurantsBox box={box} />;
    case 'shopping':
      return <ShoppingBox box={box} />;
    case 'gasStation':
      return <GasStationBox box={box} />;
    default:
      if (box.content) {
        return <div className="info-box">{box.content}</div>;
      }
      return null;
  }
});

export default InfoBox;
