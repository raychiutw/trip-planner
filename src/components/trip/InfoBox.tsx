/* ===== InfoBox Component ===== */
/* Renders an info box — tips, notes, parking, restaurants, shopping, gas stations, etc. */

import { memo } from 'react';
import Icon from '../shared/Icon';
import MarkdownText from '../shared/MarkdownText';
import MapLinks, { type MapLocation } from './MapLinks';
import Restaurant, { type RestaurantData } from './Restaurant';
import Shop, { type ShopData } from './Shop';
import { escUrl } from '../../lib/sanitize';

// ---------------------------------------------------------------------------
// Safe text extraction — API may return objects like {text, checked} or {label, text}
// ---------------------------------------------------------------------------

function safeText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.label === 'string' && typeof obj.text === 'string') return `${obj.label}: ${obj.text}`;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.name === 'string') return obj.name;
  }
  return String(value);
}

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
  note?: string | null;
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
  if (count === 1) return 'flex flex-col md:grid md:grid-cols-1 md:gap-2';
  return count % 2 === 0 ? 'flex flex-col md:grid md:grid-cols-2 md:gap-2' : 'flex flex-col md:grid md:grid-cols-3 md:gap-2';
}

// ---------------------------------------------------------------------------
// Sub-renderers per box type
// ---------------------------------------------------------------------------

function ReservationBox({ box }: { box: InfoBoxData }) {
  return (
    <div className="my-2 py-2 px-3 rounded-sm text-body leading-relaxed bg-accent-bg">
      {box.title && <><strong className="font-semibold">{safeText(box.title)}</strong><br /></>}
      {box.items && box.items.length > 0 &&
        box.items.filter((item): item is string => typeof item === 'string').map((item, i) => (
          <span key={i}>{safeText(item)}<br /></span>
        ))
      }
      {box.notes && <MarkdownText text={safeText(box.notes)} as="div" />}
    </div>
  );
}

function ParkingBox({ box }: { box: InfoBoxData }) {
  return (
    <div className="my-2 py-2 px-3 rounded-sm text-body leading-relaxed bg-accent-bg">
      <div>
        {box.title && (
          <><Icon name="parking" /> <strong className="font-semibold">{safeText(box.title)}</strong></>
        )}
        {box.price && <>：{safeText(box.price)}</>}
        {box.location && <>{' '}<MapLinks location={box.location} inline /></>}
      </div>
      {box.note && (
        <MarkdownText text={safeText(box.note)} as="div" className="mt-2 text-footnote text-muted leading-relaxed" inline />
      )}
    </div>
  );
}

function SouvenirBox({ box }: { box: InfoBoxData }) {
  // items here are SouvenirItem objects (not strings)
  const items = (box.items ?? []).filter((item): item is SouvenirItem => typeof item === 'object' && item !== null);
  return (
    <div className="my-2 py-2 px-3 rounded-sm text-body leading-relaxed bg-accent-bg">
      {box.title && <><Icon name="gift" /> <strong className="font-semibold">{safeText(box.title)}</strong><br /></>}
      {items.map((item, i) => {
        const itemUrl = escUrl(item.url);
        return (
          <span key={i}>
            <Icon name="gift" />{' '}
            {itemUrl ? (
              <a href={itemUrl} target="_blank" rel="noopener noreferrer" className="text-foreground font-semibold underline">{item.name}</a>
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
    <div className="my-2 py-2 px-3 rounded-sm text-body leading-relaxed bg-accent-bg">
      <Icon name="utensils" /> <strong className="font-semibold">{rTitle}：</strong>
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
    <div className="my-2 py-2 px-3 rounded-sm text-body leading-relaxed bg-accent-bg">
      <Icon name="shopping" /> <strong className="font-semibold">{sTitle}：</strong>
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
    <div className="my-2 py-2 px-3 rounded-sm text-body leading-relaxed bg-accent-bg">
      <Icon name="gas-station" /> <strong className="font-semibold">{gsTitle}</strong>
      {typeof box.googleRating === 'number' && (
        <>{' '}<span className="text-accent text-caption shrink-0">★ {box.googleRating.toFixed(1)}</span></>
      )}
      {st && (
        <div className="mt-2">
          <strong className="font-semibold">{st.name}</strong><br />
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
        return <MarkdownText text={box.content} as="div" className="my-2 py-2 px-3 rounded-sm text-body leading-relaxed" />;
      }
      return null;
  }
});

export default InfoBox;
