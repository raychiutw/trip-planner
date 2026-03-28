/**
 * Maps raw API day response data to component-expected shapes.
 * POI Schema V2: API returns merged pois + trip_pois rows.
 */

import type { TimelineEntryData, TravelData } from '../components/trip/TimelineEvent';
import type { NavLocation } from '../components/trip/MapLinks';
import type { InfoBoxData } from '../components/trip/InfoBox';
import type { RestaurantData } from '../components/trip/Restaurant';
import type { ShopData } from '../components/trip/Shop';
import type { HotelData } from '../components/trip/Hotel';

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

function formatTravelText(travel: Record<string, unknown>): string {
  const desc = (travel.desc as string) || '';
  const min = travel.min as number | null;
  if (desc && min) return `${desc}（${min} 分）`;
  if (desc) return desc;
  if (min) return `${min} 分`;
  return '';
}

/* ===== Restaurant (from merged POI) ===== */

function toRestaurantData(r: Record<string, unknown>): RestaurantData {
  return {
    name: (r.name as string) || '',
    category: (r.category as string) ?? null,
    hours: (r.hours as string) ?? null,
    price: (r.price as string) ?? null,
    reservation: (r.reservation as string) ?? null,
    reservationUrl: ((r.reservation_url ?? r.reservationUrl) as string) ?? null,
    description: (r.description as string) ?? null,
    note: (r.note as string) ?? null,
    googleRating: ((r.google_rating ?? r.googleRating) as number) ?? null,
    location: buildLocation(r.maps as string, r.mapcode as string, r.name as string, r.lat as number, r.lng as number),
  };
}

/* ===== Shopping (from merged POI) ===== */

function toShopData(s: Record<string, unknown>): ShopData {
  const raw = s.must_buy ?? s.mustBuy;
  let mustBuy: string[] | null = null;
  if (typeof raw === 'string' && raw) {
    mustBuy = raw.split(/[,、]/).map((v) => v.trim()).filter(Boolean);
  } else if (Array.isArray(raw)) {
    mustBuy = raw;
  }

  return {
    name: (s.name as string) || '',
    category: (s.category as string) ?? null,
    hours: (s.hours as string) ?? null,
    mustBuy,
    description: (s.description as string) ?? null,
    note: (s.note as string) ?? null,
    googleRating: ((s.google_rating ?? s.googleRating) as number) ?? null,
    location: buildLocation(s.maps as string, s.mapcode as string, s.name as string, s.lat as number, s.lng as number),
  };
}

/* ===== Timeline Entry ===== */

export function toTimelineEntry(raw: object): TimelineEntryData {
  const entry = raw as Record<string, unknown>;
  const travel = entry.travel as Record<string, unknown> | null;
  const travelData: TravelData | null = travel
    ? { type: (travel.type as string) || '', text: formatTravelText(travel) }
    : null;

  const locations: NavLocation[] = [];
  if (entry.maps || entry.mapcode) {
    locations.push({
      name: (entry.title as string) || undefined,
      googleQuery: (entry.maps as string) || undefined,
      mapcode: (entry.mapcode as string) || undefined,
    });
  }

  const infoBoxes: InfoBoxData[] = [];
  const restaurants = (entry.restaurants ?? []) as Record<string, unknown>[];
  if (restaurants.length > 0) {
    infoBoxes.push({
      type: 'restaurants',
      restaurants: restaurants.map(toRestaurantData),
    });
  }
  const shopping = (entry.shopping ?? []) as Record<string, unknown>[];
  if (shopping.length > 0) {
    infoBoxes.push({
      type: 'shopping',
      shops: shopping.map(toShopData),
    });
  }

  return {
    time: (entry.time as string) ?? null,
    title: (entry.title as string) ?? null,
    description: (entry.description as string) ?? null,
    note: (entry.note as string) ?? null,
    googleRating: ((entry.google_rating ?? entry.googleRating) as number) ?? null,
    source: (entry.source as string) ?? null,
    travel: travelData,
    locations: locations.length > 0 ? locations : null,
    infoBoxes: infoBoxes.length > 0 ? infoBoxes : null,
  };
}

/* ===== Hotel (from merged POI — V2 flattened fields) ===== */

export function toHotelData(raw: object): HotelData {
  const hotel = raw as Record<string, unknown>;
  const description = (hotel.description as string) ?? null;

  // V2: breakfast is flattened into breakfast_included + breakfast_note
  let breakfast: { included?: boolean; note?: string | null } | null = null;
  const bfIncluded = hotel.breakfast_included ?? hotel.breakfastIncluded;
  const bfNote = (hotel.breakfast_note ?? hotel.breakfastNote) as string | null;
  if (bfIncluded != null || bfNote) {
    breakfast = {
      included: bfIncluded === 1 ? true : bfIncluded === 0 ? false : undefined,
      note: bfNote,
    };
  } else {
    // Legacy: breakfast may still be JSON string from old API
    const rawBf = hotel.breakfast;
    if (typeof rawBf === 'string' && rawBf) {
      try { breakfast = JSON.parse(rawBf); } catch { breakfast = { included: true, note: rawBf }; }
    } else if (rawBf && typeof rawBf === 'object') {
      breakfast = rawBf as { included?: boolean; note?: string | null };
    }
  }

  const infoBoxes: InfoBoxData[] = [];

  // V2: parking is an array of merged POI objects
  const parkingArr = hotel.parking as Record<string, unknown>[] | null;
  if (Array.isArray(parkingArr) && parkingArr.length > 0) {
    for (const p of parkingArr) {
      infoBoxes.push({
        type: 'parking',
        title: (p.name as string) || '停車場',
        price: (p.description as string) ?? null, // parking description often contains price
        note: (p.note as string) ?? null,
        location: buildLocation(p.maps as string, p.mapcode as string, p.name as string, p.lat as number, p.lng as number),
      });
    }
  } else if (hotel.parking && typeof hotel.parking === 'object' && !Array.isArray(hotel.parking)) {
    // Legacy: parking was a single object
    const parking = hotel.parking as Record<string, unknown>;
    infoBoxes.push({
      type: 'parking',
      title: ((parking.info ?? parking.name) as string) || '停車場',
      price: (parking.price as string) ?? null,
      note: (parking.note as string) ?? null,
      location: buildLocation(parking.maps as string, parking.mapcode as string, (parking.name as string) ?? null),
    });
  }

  // Hotel shopping from trip_pois (passed as hotel.shopping)
  const shopping = (hotel.shopping ?? []) as Record<string, unknown>[];
  if (shopping.length > 0) {
    infoBoxes.push({
      type: 'shopping',
      shops: shopping.map(toShopData),
    });
  }

  return {
    name: (hotel.name as string) || '',
    checkout: ((hotel.checkout as string) ?? null),
    description,
    breakfast,
    note: (hotel.note as string) ?? null,
    infoBoxes: infoBoxes.length > 0 ? infoBoxes : null,
  };
}
