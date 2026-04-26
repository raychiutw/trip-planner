/**
 * Maps raw API day response data to component-expected shapes.
 * POI Schema: API returns merged pois + trip_pois rows.
 */

import type { TimelineEntryData, TravelData, PoiPhoto } from '../components/trip/TimelineEvent';
import type { NavLocation } from '../components/trip/MapLinks';
import type { InfoBoxData } from '../components/trip/InfoBox';
import type { RestaurantData } from '../components/trip/Restaurant';
import type { ShopData } from '../components/trip/Shop';
import type { Day, Entry } from '../types/trip';

/* ===== Entry lookup helpers (shared across pages/components) ===== */

export interface DayEntryContext {
  entry: Entry;
  dayNum: number;
  date: string | null;
  label: string | null;
}

/** Linear scan all days for a matching entry id. Returns null if not found or id invalid. */
export function findEntryInDays(
  allDays: Record<number, Day>,
  entryId: number,
): DayEntryContext | null {
  if (!Number.isFinite(entryId)) return null;
  for (const dayNum of Object.keys(allDays).map((n) => Number(n))) {
    const day = allDays[dayNum];
    if (!day?.timeline) continue;
    const entry = day.timeline.find((e) => e.id === entryId);
    if (entry) return { entry, dayNum, date: day.date ?? null, label: day.label ?? null };
  }
  return null;
}

/** Parse a YYYY-MM-DD string as a local-time Date. Returns null on invalid/empty.
 *  Rejects rollovers like '2026-02-30' (JS would silently interpret as Mar 2). */
export function parseLocalDate(date: string | null | undefined): Date | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) return null;
  return d;
}

/** Format a YYYY-MM-DD date string as "M/D" in local time. Empty string on invalid. */
export function formatDateLabel(date: string | null | undefined): string {
  const d = parseLocalDate(date);
  return d ? `${d.getMonth() + 1}/${d.getDate()}` : '';
}

/* ===== Raw input interfaces (camelCase, matching API response from mergePoi) ===== */

/** Raw restaurant POI as returned by the API (merged pois + trip_pois). */
interface RawRestaurant {
  name?: string | null;
  sortOrder?: number | null;
  category?: string | null;
  hours?: string | null;
  price?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
  description?: string | null;
  note?: string | null;
  googleRating?: number | null;
  maps?: string | null;
  mapcode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** Raw shopping POI as returned by the API. */
interface RawShop {
  name?: string | null;
  category?: string | null;
  hours?: string | null;
  mustBuy?: string | string[] | null;
  description?: string | null;
  note?: string | null;
  googleRating?: number | null;
  maps?: string | null;
  mapcode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** Raw travel object nested in a timeline entry. */
interface RawTravel {
  type?: string | null;
  desc?: string | null;
  min?: number | null;
}

/** Raw POI (Phase 2) joined onto entries via trip_entries.poi_id. */
interface RawEntryPoi {
  id?: number | null;
  type?: string | null;
  name?: string | null;
  maps?: string | null;
  mapcode?: string | null;
  lat?: number | null;
  lng?: number | null;
  googleRating?: number | null;
  /** v2.12 Wave 3：JSON-encoded TEXT — array of { url, thumbUrl?, caption?, source?, attribution? } */
  photos?: string | null;
}

/** Raw timeline entry as returned by the API (Phase 3：spatial 欄位只存在 poi). */
interface RawEntry {
  id?: number | null;
  time?: string | null;
  title?: string | null;
  description?: string | null;
  note?: string | null;
  source?: string | null;
  travel?: RawTravel | null;
  /** JOIN pois via poi_id — spatial source of truth */
  poi?: RawEntryPoi | null;
  restaurants?: RawRestaurant[];
  shopping?: RawShop[];
}

/* ===== Helpers ===== */

function buildLocation(
  maps?: string | null,
  mapcode?: string | null,
  name?: string | null,
  _lat?: number | null,
  _lng?: number | null,
): NavLocation | null {
  if (!maps && !mapcode && !_lat) return null;
  const isUrl = maps ? /^https?:/i.test(maps) : false;
  const nameValue: string | undefined =
    (name ?? undefined) || (!isUrl && maps ? maps : undefined) || undefined;
  return {
    name: nameValue,
    googleQuery: isUrl ? (maps ?? undefined) : undefined,
    mapcode: mapcode || undefined,
  };
}

function formatTravelText(travel: RawTravel): string {
  const desc = travel.desc || '';
  const min = travel.min ?? null;
  if (desc && min) return `${desc}（${min} 分）`;
  if (desc) return desc;
  if (min) return `${min} 分`;
  return '';
}

/* ===== Restaurant (from merged POI) ===== */

function toRestaurantData(r: RawRestaurant): RestaurantData {
  return {
    name: r.name || '',
    sortOrder: r.sortOrder ?? null,
    category: r.category ?? null,
    hours: r.hours ?? null,
    price: r.price ?? null,
    reservation: r.reservation ?? null,
    reservationUrl: r.reservationUrl ?? null,
    description: r.description ?? null,
    note: r.note ?? null,
    googleRating: r.googleRating ?? null,
    location: buildLocation(r.maps ?? null, r.mapcode ?? null, r.name ?? null, r.lat ?? null, r.lng ?? null),
  };
}

/* ===== Shopping (from merged POI) ===== */

function toShopData(s: RawShop): ShopData {
  const raw = s.mustBuy;
  let mustBuy: string[] | null = null;
  if (typeof raw === 'string' && raw) {
    mustBuy = raw.split(/[,、]/).map((v) => v.trim()).filter(Boolean);
  } else if (Array.isArray(raw)) {
    mustBuy = raw;
  }

  return {
    name: s.name || '',
    category: s.category ?? null,
    hours: s.hours ?? null,
    mustBuy,
    description: s.description ?? null,
    note: s.note ?? null,
    googleRating: s.googleRating ?? null,
    location: buildLocation(s.maps ?? null, s.mapcode ?? null, s.name ?? null, s.lat ?? null, s.lng ?? null),
  };
}

/* ===== Timeline Entry ===== */

export function toTimelineEntry(raw: RawEntry): TimelineEntryData {
  const travel = raw.travel ?? null;
  const travelData: TravelData | null = travel
    ? { type: travel.type || '', text: formatTravelText(travel) }
    : null;

  // Phase 3：spatial 欄位只從 POI master 取（entry 已不存這些）
  const poi = raw.poi ?? null;
  const effMaps = poi?.maps ?? null;
  const effMapcode = poi?.mapcode ?? null;
  const effGoogleRating = poi?.googleRating ?? null;
  // v2.12 Wave 3：parse pois.photos JSON 字串。malformed → 視為 null（不 throw）。
  const effPhotos: PoiPhoto[] | null = parsePhotos(poi?.photos);

  const locations: NavLocation[] = [];
  if (effMaps || effMapcode) {
    locations.push({
      name: raw.title || undefined,
      googleQuery: effMaps || undefined,
      mapcode: effMapcode || undefined,
    });
  }

  const infoBoxes: InfoBoxData[] = [];
  const restaurants = raw.restaurants ?? [];
  if (restaurants.length > 0) {
    infoBoxes.push({
      type: 'restaurants',
      restaurants: restaurants.map(toRestaurantData),
    });
  }
  const shopping = raw.shopping ?? [];
  if (shopping.length > 0) {
    infoBoxes.push({
      type: 'shopping',
      shops: shopping.map(toShopData),
    });
  }

  return {
    id: raw.id ?? null,
    time: raw.time ?? null,
    title: raw.title ?? null,
    description: raw.description ?? null,
    note: raw.note ?? null,
    googleRating: effGoogleRating,
    source: raw.source ?? null,
    travel: travelData,
    locations: locations.length > 0 ? locations : null,
    infoBoxes: infoBoxes.length > 0 ? infoBoxes : null,
    photos: effPhotos,
  };
}

/**
 * Parse `pois.photos` JSON-encoded TEXT column. Returns null on missing /
 * empty / malformed input — frontend then falls back to placeholder UI.
 */
function parsePhotos(raw: string | null | undefined): PoiPhoto[] | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid: PoiPhoto[] = parsed.filter(
      (p): p is PoiPhoto => p && typeof p === 'object' && typeof (p as { url?: unknown }).url === 'string',
    );
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

