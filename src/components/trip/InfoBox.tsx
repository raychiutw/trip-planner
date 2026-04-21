/* ===== InfoBox Component ===== */
/* Renders an info box — tips, notes, parking, restaurants, shopping, gas stations, etc. */

import { memo, useState } from 'react';
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
// Shared styles (eyebrow heading, backup row, generic box surface)
// ---------------------------------------------------------------------------

const INFOBOX_STYLES = `
.infobox-block { margin: 14px 0; }
.infobox-block:last-child { margin-bottom: 0; }
.infobox-heading {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--font-size-eyebrow); font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 8px;
}
.infobox-heading svg { color: var(--color-accent); }
.infobox-surface {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 12px 14px;
}
.infobox-surface--muted {
  background: var(--color-secondary);
}
.infobox-backup-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  margin-top: 8px;
  cursor: pointer;
  color: var(--color-foreground);
  transition: border-color 160ms var(--transition-timing-function-apple),
              background-color 160ms var(--transition-timing-function-apple);
  font-size: 14px;
}
.infobox-backup-row:hover {
  border-color: var(--color-accent);
  background: var(--color-hover);
}
.infobox-backup-row__name { font-weight: 500; }
.infobox-backup-row__side {
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--color-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.infobox-backup-row__chev {
  display: inline-block; transition: transform 160ms var(--transition-timing-function-apple);
  color: var(--color-muted);
  font-size: 14px; line-height: 1;
}
.infobox-backup-row[aria-expanded="true"] .infobox-backup-row__chev { transform: rotate(90deg); color: var(--color-accent); }
.infobox-grid { display: flex; flex-direction: column; gap: 8px; }
@media (min-width: 768px) {
  .infobox-grid[data-cols="2"] { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .infobox-grid[data-cols="3"] { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
}
`;

// ---------------------------------------------------------------------------
// Sub-renderers per box type
// ---------------------------------------------------------------------------

function ReservationBox({ box }: { box: InfoBoxData }) {
  return (
    <div className="infobox-block">
      <style>{INFOBOX_STYLES}</style>
      {box.title && (
        <div className="infobox-heading">
          <Icon name="info" />{safeText(box.title)}
        </div>
      )}
      <div className="infobox-surface">
        {box.items && box.items.length > 0 &&
          box.items.filter((item): item is string => typeof item === 'string').map((item, i) => (
            <div key={i} className="text-body leading-relaxed">{safeText(item)}</div>
          ))
        }
        {box.notes && <MarkdownText text={safeText(box.notes)} as="div" className="text-callout text-muted mt-1" />}
      </div>
    </div>
  );
}

function ParkingBox({ box }: { box: InfoBoxData }) {
  return (
    <div className="infobox-block">
      <style>{INFOBOX_STYLES}</style>
      <div className="infobox-heading">
        <Icon name="parking" />停車資訊
      </div>
      <div className="infobox-surface">
        <div className="flex items-center gap-2 flex-wrap">
          {box.title && <strong className="font-semibold">{safeText(box.title)}</strong>}
          {box.price && <span className="text-footnote text-muted">{safeText(box.price)}</span>}
          {box.location && <MapLinks location={box.location} inline />}
        </div>
        {box.note && (
          <MarkdownText text={safeText(box.note)} as="div" className="mt-2 text-footnote text-muted leading-relaxed" inline />
        )}
      </div>
    </div>
  );
}

function SouvenirBox({ box }: { box: InfoBoxData }) {
  const items = (box.items ?? []).filter((item): item is SouvenirItem => typeof item === 'object' && item !== null);
  return (
    <div className="infobox-block">
      <style>{INFOBOX_STYLES}</style>
      <div className="infobox-heading">
        <Icon name="gift" />{box.title ? safeText(box.title) : '伴手禮'}
      </div>
      <div className="infobox-surface">
        {items.map((item, i) => {
          const itemUrl = escUrl(item.url);
          return (
            <div key={i} className="py-1 text-body leading-relaxed">
              <Icon name="gift" />{' '}
              {itemUrl ? (
                <a href={itemUrl} target="_blank" rel="noopener noreferrer" className="text-foreground font-semibold underline">{item.name}</a>
              ) : (
                <span className="font-medium">{item.name}</span>
              )}
              {item.note && <span className="text-muted">（{item.note}）</span>}
              {item.location && <>{' '}<MapLinks location={item.location} inline /></>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RestaurantsBox({ box }: { box: InfoBoxData }) {
  const rItems = box.restaurants ?? [];
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (rItems.length === 0) return null;

  const heading = box.title || '推薦餐廳';

  // Single restaurant OR legacy title override — flat render
  if (rItems.length === 1 || box.title) {
    return (
      <div className="infobox-block">
        <style>{INFOBOX_STYLES}</style>
        <div className="infobox-heading">
          <Icon name="utensils" />{heading}
        </div>
        {rItems.map((r, i) => (
          <Restaurant key={i} restaurant={r} variant={i === 0 && rItems.length > 1 ? 'hero' : 'standard'} />
        ))}
      </div>
    );
  }

  // Multiple restaurants — hero (first by sortOrder) + backup rows
  const sorted = [...rItems].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  const hero = sorted[0]!;
  const backups = sorted.slice(1);

  return (
    <div className="infobox-block">
      <style>{INFOBOX_STYLES}</style>
      <div className="infobox-heading">
        <Icon name="utensils" />推薦餐廳
      </div>
      <Restaurant restaurant={hero} variant="hero" />
      {backups.length > 0 && (
        <div className="mt-2">
          <div className="text-caption text-muted mb-1 pl-1" style={{ letterSpacing: '0.1em' }}>備選</div>
          {backups.map((r, i) => {
            const isOpen = expandedIdx === i;
            return (
              <div key={r.name}>
                <button
                  type="button"
                  className="infobox-backup-row w-full text-left"
                  aria-expanded={isOpen}
                  onClick={() => setExpandedIdx(isOpen ? null : i)}
                >
                  <span className="infobox-backup-row__name">{r.name}</span>
                  <span className="infobox-backup-row__side">
                    {r.category && <span>{r.category}</span>}
                    {typeof r.googleRating === 'number' && <span>★ {r.googleRating.toFixed(1)}</span>}
                    <span className="infobox-backup-row__chev">›</span>
                  </span>
                </button>
                {isOpen && <Restaurant restaurant={r} variant="standard" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShoppingBox({ box }: { box: InfoBoxData }) {
  const sItems = box.shops ?? [];
  if (sItems.length === 0) return null;
  const heading = box.title || (sItems.length > 1 ? '推薦購物' : '附近購物');
  const cols = sItems.length >= 3 ? 2 : 1;

  return (
    <div className="infobox-block">
      <style>{INFOBOX_STYLES}</style>
      <div className="infobox-heading">
        <Icon name="shopping" />{heading}
      </div>
      <div className="infobox-grid" data-cols={cols}>
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
    <div className="infobox-block">
      <style>{INFOBOX_STYLES}</style>
      <div className="infobox-heading">
        <Icon name="gas-station" />{gsTitle}
        {typeof box.googleRating === 'number' && (
          <span className="ml-1 text-accent">★ {box.googleRating.toFixed(1)}</span>
        )}
      </div>
      <div className="infobox-surface">
        {st && (
          <>
            <strong className="font-semibold">{st.name}</strong>
            {st.address && <div className="text-footnote text-muted mt-1">{st.address}</div>}
            {st.hours && <div className="text-footnote text-muted mt-1"><Icon name="clock" /> {st.hours}</div>}
            {st.service && <div className="text-footnote text-muted mt-1">{st.service}</div>}
            {st.phone && <div className="text-footnote text-muted mt-1"><Icon name="phone" /> {st.phone}</div>}
            {st.location && <div className="mt-2"><MapLinks location={st.location} inline /></div>}
          </>
        )}
      </div>
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
        return <MarkdownText text={box.content} as="div" className="my-2 text-body leading-relaxed" />;
      }
      return null;
  }
});

export default InfoBox;
