/**
 * google-client.ts — Unified Google Maps Platform API client.
 *
 * Endpoints used:
 *   - Places API (New) v1
 *     - POST /v1/places:searchText        → /api/poi-search
 *     - GET  /v1/places/{place_id}        → Place Details (rating, hours, status)
 *   - Directions API
 *     - POST /v1/directions               → /api/route, /api/trips/[id]/recompute-travel
 *   - Geocoding API
 *     - GET  /maps/api/geocode/json       → /api/geocode (server-side reverse)
 *
 * ## Failure mode (autoplan C2 — no fallback per P11)
 *
 * 任何 upstream failure (timeout / 5xx / parse error / Google quota deny) 一律 throw
 * MAPS_UPSTREAM_FAILED (502)。**NO** OSM / Mapbox / ORS / Haversine fallback。Frontend
 * 顯示 PageErrorState 「服務暫停」+ 重試按鈕。
 *
 * ## Auth
 *
 * Single API key via env GOOGLE_MAPS_API_KEY。Server-side key (X-Goog-Api-Key header).
 * 不 referrer-restrict — 因為從 CF Workers backend 呼叫。Frontend Maps JS 用獨立的
 * GOOGLE_MAPS_BROWSER_KEY (HTTP referrer = trip-planner-dby.pages.dev)。
 *
 * ## Field masks
 *
 * Places API (New) requires X-Goog-FieldMask header to control response shape +
 * billing tier. We use minimal masks per call site to avoid unnecessary cost.
 */
import { AppError } from '../../../functions/api/_errors';

const PLACES_BASE = 'https://places.googleapis.com';
const DIRECTIONS_BASE = 'https://routes.googleapis.com';

const TIMEOUT_MS = 8_000;

/** Throw MAPS_UPSTREAM_FAILED with a one-line detail. */
function fail(detail: string): never {
  throw new AppError('MAPS_UPSTREAM_FAILED', detail);
}

/** Google Places business_status enum (3 values per Places API spec). */
export type GoogleBusinessStatus = 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    fail(`fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Places API — Search Text
// ---------------------------------------------------------------------------

export interface PlacesSearchTextResult {
  /** Google canonical place id, e.g. "ChIJ..." */
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Google primary type, e.g. "restaurant" / "tourist_attraction" */
  category: string;
  /** ISO 3166-1 alpha-2 uppercase, e.g. "JP" */
  country?: string;
  /** Country localized name, e.g. "日本" */
  country_name?: string;
  /** Google rating 1-5, optional */
  rating?: number;
  business_status?: GoogleBusinessStatus;
}

interface PlacesSearchTextResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
    addressComponents?: Array<{
      shortText?: string;
      longText?: string;
      types?: string[];
    }>;
    rating?: number;
    businessStatus?: string;
  }>;
}

const SEARCH_TEXT_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.addressComponents',
  'places.rating',
  'places.businessStatus',
].join(',');

/**
 * Places API (New) — POST /v1/places:searchText
 *
 * @param query    自然語言查詢字串（中文 / 英文都 OK，Places 自動 detect）
 * @param region   ISO 3166-1 alpha-2 lowercase 限制搜尋區域，e.g. "jp"
 * @param maxCount 1–20，預設 10
 */
export async function searchPlaces(
  apiKey: string,
  query: string,
  region?: string,
  maxCount = 10,
): Promise<PlacesSearchTextResult[]> {
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: Math.min(Math.max(maxCount, 1), 20),
    languageCode: 'zh-TW',
  };
  if (region) body.regionCode = region.toLowerCase();

  const res = await fetchWithTimeout(`${PLACES_BASE}/v1/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': SEARCH_TEXT_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`Places searchText ${res.status}`);

  const json = (await res.json().catch(() => null)) as PlacesSearchTextResponse | null;
  if (!json) fail('Places searchText invalid JSON');
  if (!json.places) return [];

  return json.places
    .filter((p) => p.id && p.location && p.displayName?.text)
    .map((p) => {
      const country = p.addressComponents?.find((c) => c.types?.includes('country'));
      return {
        place_id: p.id,
        name: p.displayName!.text,
        address: p.formattedAddress || '',
        lat: p.location!.latitude,
        lng: p.location!.longitude,
        category: p.primaryType || '',
        country: country?.shortText?.toUpperCase(),
        country_name: country?.longText,
        rating: p.rating,
        business_status: p.businessStatus as GoogleBusinessStatus | undefined,
      };
    });
}

// ---------------------------------------------------------------------------
// Places API — Place Details (lifecycle refresh)
// ---------------------------------------------------------------------------

export interface PlaceDetailsResult {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  business_status: GoogleBusinessStatus;
  /** Open hours weekday descriptions, e.g. ["週一: 11:00 – 22:00", ...] */
  weekday_descriptions?: string[];
  phone?: string;
}

const PLACE_DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'businessStatus',
  'regularOpeningHours.weekdayDescriptions',
  'internationalPhoneNumber',
].join(',');

/**
 * Places API (New) — GET /v1/places/{place_id}
 *
 * Used by:
 *   - scripts/google-poi-initial-backfill.ts (one-time after migration 0051)
 *   - scripts/google-poi-refresh-30d.ts (daily 30d refresh job)
 *   - tp-* skills via mac mini cron
 *
 * Returns null if Google returns 404 NOT_FOUND（POI delisted from Google Maps）—
 * caller should mark `pois.status = 'missing'`. Throws MAPS_UPSTREAM_FAILED on
 * other errors.
 */
export async function getPlaceDetails(
  apiKey: string,
  placeId: string,
): Promise<PlaceDetailsResult | null> {
  const res = await fetchWithTimeout(
    `${PLACES_BASE}/v1/places/${encodeURIComponent(placeId)}?languageCode=zh-TW`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACE_DETAILS_FIELD_MASK,
      },
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) fail(`Place details ${res.status}`);

  const json = (await res.json().catch(() => null)) as {
    id?: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    rating?: number;
    businessStatus?: string;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    internationalPhoneNumber?: string;
  } | null;

  if (!json?.id || !json.location || !json.displayName?.text) {
    fail('Place details invalid JSON');
  }

  return {
    place_id: json.id,
    name: json.displayName!.text,
    address: json.formattedAddress || '',
    lat: json.location!.latitude,
    lng: json.location!.longitude,
    rating: json.rating,
    business_status: (json.businessStatus as GoogleBusinessStatus | undefined) || 'OPERATIONAL',
    weekday_descriptions: json.regularOpeningHours?.weekdayDescriptions,
    phone: json.internationalPhoneNumber,
  };
}

// ---------------------------------------------------------------------------
// Routes API — computeRoutes (replaces Mapbox Directions)
// ---------------------------------------------------------------------------

export interface ComputeRouteResult {
  /** Encoded polyline (Google encoded polyline algorithm format) */
  polyline: string;
  /** Total distance in meters */
  distance_meters: number;
  /** Total duration in seconds */
  duration_seconds: number;
}

export type TravelMode = 'DRIVE' | 'WALK' | 'TRANSIT' | 'BICYCLE';

const ROUTES_FIELD_MASK = [
  'routes.polyline.encodedPolyline',
  'routes.distanceMeters',
  'routes.duration',
].join(',');

/**
 * Routes API v2 — POST /directions/v2:computeRoutes
 *
 * Used by:
 *   - /api/route (single from-to)
 *   - /api/trips/[id]/recompute-travel (batch)
 *
 * Throws MAPS_UPSTREAM_FAILED on any failure（NO Haversine fallback per P11/T13）.
 */
export async function computeRoute(
  apiKey: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: TravelMode = 'DRIVE',
): Promise<ComputeRouteResult> {
  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: mode,
    polylineQuality: 'OVERVIEW',
    computeAlternativeRoutes: false,
    languageCode: 'zh-TW',
    units: 'METRIC',
  };

  const res = await fetchWithTimeout(`${DIRECTIONS_BASE}/directions/v2:computeRoutes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': ROUTES_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`Routes ${res.status}`);

  const json = (await res.json().catch(() => null)) as {
    routes?: Array<{
      polyline?: { encodedPolyline?: string };
      distanceMeters?: number;
      duration?: string; // e.g. "1234s"
    }>;
  } | null;

  const route = json?.routes?.[0];
  if (!route?.polyline?.encodedPolyline || typeof route.distanceMeters !== 'number') {
    fail('Routes empty result');
  }

  const durationStr = route.duration || '0s';
  const durationSeconds = parseInt(durationStr.replace(/s$/, ''), 10) || 0;

  return {
    polyline: route.polyline!.encodedPolyline!,
    distance_meters: route.distanceMeters!,
    duration_seconds: durationSeconds,
  };
}

// Geocoding reverse lookup intentionally omitted — add when /api/geocode endpoint ships.
