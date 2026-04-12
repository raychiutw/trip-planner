/**
 * Maps raw API day response data to component-expected shapes.
 * POI Schema: API returns merged pois + trip_pois rows.
 */

import type { TimelineEntryData, TravelData } from '../components/trip/TimelineEvent';
import type { NavLocation } from '../components/trip/MapLinks';
import type { InfoBoxData } from '../components/trip/InfoBox';
import type { RestaurantData } from '../components/trip/Restaurant';
import type { ShopData } from '../components/trip/Shop';
import type { HotelData } from '../components/trip/Hotel';

/* ===== Raw input interfaces (accept both camelCase and snake_case) ===== */

/** Raw restaurant POI as returned by the API (merged pois + trip_pois). */
interface RawRestaurant {
  name?: string | null;
  sort_order?: number | null;
  category?: string | null;
  hours?: string | null;
  price?: string | null;
  reservation?: string | null;
  reservation_url?: string | null;
  reservationUrl?: string | null;
  description?: string | null;
  note?: string | null;
  google_rating?: number | null;
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
  must_buy?: string | string[] | null;
  mustBuy?: string | string[] | null;
  description?: string | null;
  note?: string | null;
  google_rating?: number | null;
  googleRating?: number | null;
  maps?: string | null;
  mapcode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** Raw parking POI (array element from merged trip_pois). */
interface RawParking {
  name?: string | null;
  description?: string | null;
  note?: string | null;
  price?: string | null;
  info?: string | null;
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

/** Raw timeline entry as returned by the API. */
interface RawEntry {
  time?: string | null;
  title?: string | null;
  description?: string | null;
  note?: string | null;
  google_rating?: number | null;
  googleRating?: number | null;
  source?: string | null;
  maps?: string | null;
  mapcode?: string | null;
  travel?: RawTravel | null;
  restaurants?: RawRestaurant[];
  shopping?: RawShop[];
}

/** Raw hotel POI as returned by the API (flattened pois + trip_pois fields). */
interface RawHotel {
  name?: string | null;
  checkout?: string | null;
  description?: string | null;
  note?: string | null;
  breakfast?: string | { included?: boolean; note?: string | null } | null;
  breakfast_included?: number | null;
  breakfastIncluded?: number | null;
  breakfast_note?: string | null;
  breakfastNote?: string | null;
  parking?: RawParking[] | RawParking | null;
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
    sortOrder: r.sort_order ?? null,
    category: r.category ?? null,
    hours: r.hours ?? null,
    price: r.price ?? null,
    reservation: r.reservation ?? null,
    reservationUrl: (r.reservation_url ?? r.reservationUrl) ?? null,
    description: r.description ?? null,
    note: r.note ?? null,
    googleRating: (r.google_rating ?? r.googleRating) ?? null,
    location: buildLocation(r.maps ?? null, r.mapcode ?? null, r.name ?? null, r.lat ?? null, r.lng ?? null),
  };
}

/* ===== Shopping (from merged POI) ===== */

function toShopData(s: RawShop): ShopData {
  const raw = s.must_buy ?? s.mustBuy;
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
    googleRating: (s.google_rating ?? s.googleRating) ?? null,
    location: buildLocation(s.maps ?? null, s.mapcode ?? null, s.name ?? null, s.lat ?? null, s.lng ?? null),
  };
}

/* ===== Timeline Entry ===== */

export function toTimelineEntry(raw: RawEntry): TimelineEntryData {
  const travel = raw.travel ?? null;
  const travelData: TravelData | null = travel
    ? { type: travel.type || '', text: formatTravelText(travel) }
    : null;

  const locations: NavLocation[] = [];
  if (raw.maps || raw.mapcode) {
    locations.push({
      name: raw.title || undefined,
      googleQuery: raw.maps || undefined,
      mapcode: raw.mapcode || undefined,
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
    time: raw.time ?? null,
    title: raw.title ?? null,
    description: raw.description ?? null,
    note: raw.note ?? null,
    googleRating: (raw.google_rating ?? raw.googleRating) ?? null,
    source: raw.source ?? null,
    travel: travelData,
    locations: locations.length > 0 ? locations : null,
    infoBoxes: infoBoxes.length > 0 ? infoBoxes : null,
  };
}

/* ===== Hotel (from merged pois + trip_pois) ===== */

export function toHotelData(raw: RawHotel): HotelData {
  const description = raw.description ?? null;

  // breakfast is flattened into breakfast_included + breakfast_note
  let breakfast: { included?: boolean; note?: string | null } | null = null;
  const bfIncluded = raw.breakfast_included ?? raw.breakfastIncluded;
  const bfNote = raw.breakfast_note ?? raw.breakfastNote ?? null;
  if (bfIncluded != null || bfNote) {
    breakfast = {
      included: bfIncluded === 1 ? true : bfIncluded === 0 ? false : undefined,
      note: bfNote,
    };
  } else {
    // Legacy: breakfast may still be JSON string from old API
    const rawBf = raw.breakfast;
    if (typeof rawBf === 'string' && rawBf) {
      try { breakfast = JSON.parse(rawBf) as { included?: boolean; note?: string | null }; } catch { breakfast = { included: true, note: rawBf }; }
    } else if (rawBf && typeof rawBf === 'object') {
      breakfast = rawBf;
    }
  }

  const infoBoxes: InfoBoxData[] = [];

  // parking is an array of merged POI objects
  const parkingVal = raw.parking;
  if (Array.isArray(parkingVal) && parkingVal.length > 0) {
    for (const p of parkingVal as RawParking[]) {
      infoBoxes.push({
        type: 'parking',
        title: p.name || '停車場',
        price: p.description ?? null,
        note: p.note ?? null,
        location: buildLocation(p.maps ?? null, p.mapcode ?? null, p.name ?? null, p.lat ?? null, p.lng ?? null),
      });
    }
  } else if (parkingVal && typeof parkingVal === 'object' && !Array.isArray(parkingVal)) {
    // Legacy: parking was a single object
    const parking = parkingVal as RawParking;
    infoBoxes.push({
      type: 'parking',
      title: (parking.info ?? parking.name) || '停車場',
      price: parking.price ?? null,
      note: parking.note ?? null,
      location: buildLocation(parking.maps ?? null, parking.mapcode ?? null, parking.name ?? null),
    });
  }

  // Hotel shopping from trip_pois (passed as hotel.shopping)
  const shopping = raw.shopping ?? [];
  if (shopping.length > 0) {
    infoBoxes.push({
      type: 'shopping',
      shops: shopping.map(toShopData),
    });
  }

  return {
    name: raw.name || '',
    checkout: raw.checkout ?? null,
    description,
    breakfast,
    note: raw.note ?? null,
    infoBoxes: infoBoxes.length > 0 ? infoBoxes : null,
  };
}
