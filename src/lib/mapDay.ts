/**
 * Maps raw API day response data to component-expected shapes.
 * Bridges snake_case DB columns → component prop interfaces.
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
): NavLocation | null {
  if (!maps && !mapcode) return null;
  // maps 是 URL 時作為 googleQuery；非 URL（地名）時作為 name fallback，避免產生空查詢 `?q=`
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

/* ===== Restaurant ===== */

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
    googleRating: ((r.rating ?? r.googleRating) as number) ?? null,
    location: buildLocation(r.maps as string, r.mapcode as string, r.name as string),
  };
}

/* ===== Shopping ===== */

function toShopData(s: Record<string, unknown>): ShopData {
  const raw = s.must_buy ?? s.mustBuy;
  let mustBuy: string[] | null = null;
  if (typeof raw === 'string' && raw) {
    mustBuy = raw
      .split(/[,、]/)
      .map((v) => v.trim())
      .filter(Boolean);
  } else if (Array.isArray(raw)) {
    mustBuy = raw;
  }

  return {
    name: (s.name as string) || '',
    category: (s.category as string) ?? null,
    hours: (s.hours as string) ?? null,
    mustBuy,
    note: (s.note as string) ?? null,
    googleRating: ((s.rating ?? s.googleRating) as number) ?? null,
    location: buildLocation(s.maps as string, s.mapcode as string, s.name as string),
  };
}

/* ===== Timeline Entry ===== */

export function toTimelineEntry(entry: Record<string, unknown>): TimelineEntryData {
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
    description: ((entry.body ?? entry.description) as string) ?? null,
    note: (entry.note as string) ?? null,
    googleRating: ((entry.rating ?? entry.googleRating) as number) ?? null,
    source: (entry.source as string) ?? null,
    travel: travelData,
    locations: locations.length > 0 ? locations : null,
    infoBoxes: infoBoxes.length > 0 ? infoBoxes : null,
  };
}

/* ===== Hotel ===== */

export function toHotelData(hotel: Record<string, unknown>): HotelData {
  let details: string[] | null = null;
  if (typeof hotel.details === 'string' && hotel.details) {
    try {
      const parsed = JSON.parse(hotel.details);
      details = Array.isArray(parsed) ? parsed : [hotel.details];
    } catch {
      details = [hotel.details];
    }
  } else if (Array.isArray(hotel.details)) {
    details = hotel.details as string[];
  }

  let breakfast: { included?: boolean; note?: string | null } | null = null;
  const rawBf = hotel.breakfast;
  if (typeof rawBf === 'string' && rawBf) {
    try {
      breakfast = JSON.parse(rawBf);
    } catch {
      breakfast = { included: true, note: rawBf };
    }
  } else if (rawBf && typeof rawBf === 'object') {
    breakfast = rawBf as { included?: boolean; note?: string | null };
  }

  const infoBoxes: InfoBoxData[] = [];
  const parking = (hotel.parking_json ?? hotel.parking) as Record<string, unknown> | null;
  if (parking && typeof parking === 'object') {
    infoBoxes.push({
      type: 'parking',
      title: ((parking.info ?? parking.name) as string) || '停車場',
      price: (parking.price as string) ?? null,
      note: (parking.note as string) ?? null,
      location: buildLocation(
        parking.maps as string,
        parking.mapcode as string,
        (parking.name as string) ?? null,
      ),
    });
  }
  const shopping = (hotel.shopping ?? []) as Record<string, unknown>[];
  if (shopping.length > 0) {
    infoBoxes.push({
      type: 'shopping',
      shops: shopping.map(toShopData),
    });
  }

  return {
    name: (hotel.name as string) || '',
    checkout: (hotel.checkout as string) ?? null,
    details,
    breakfast,
    note: (hotel.note as string) ?? null,
    infoBoxes: infoBoxes.length > 0 ? infoBoxes : null,
  };
}
