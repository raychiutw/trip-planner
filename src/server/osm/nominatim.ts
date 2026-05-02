/**
 * Nominatim — OSM geocoding.
 *
 * Free, no API key. **Strict 1 req/sec rate limit** per OSM usage policy.
 * Caller must throttle. Custom User-Agent required (Nominatim rejects empty
 * or generic User-Agents like "curl/8.x").
 *
 * Docs: https://nominatim.org/release-docs/latest/api/Search/
 *
 * Used by enrich orchestrator (src/server/poi/enrich.ts) to resolve a POI
 * name → lat/lng + osm_id when the POI lacks coordinates or OSM linkage.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Tripline/1.0 (lean.lean@gmail.com)'; // Required by OSM policy.

export interface NominatimResult {
  lat: number;
  lng: number;
  displayName: string;
  osmId: number;
  osmType: 'node' | 'way' | 'relation';
  address: {
    country?: string;
    countryCode?: string;
    state?: string;
    city?: string;
    suburb?: string;
    road?: string;
  };
}

interface RawNominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  osm_id: number;
  osm_type: 'node' | 'way' | 'relation';
  address?: {
    country?: string;
    country_code?: string;
    state?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    road?: string;
  };
}

export async function geocode(query: string): Promise<NominatimResult | null> {
  if (!query || query.trim().length === 0) return null;

  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en,zh-TW,ja' },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Nominatim HTTP ${res.status}`);
    }
    const items = (await res.json()) as RawNominatimItem[];
    const first = items[0];
    if (!first) return null;
    return {
      lat: Number(first.lat),
      lng: Number(first.lon),
      displayName: first.display_name,
      osmId: first.osm_id,
      osmType: first.osm_type,
      address: {
        country: first.address?.country,
        countryCode: first.address?.country_code,
        state: first.address?.state,
        city: first.address?.city ?? first.address?.town ?? first.address?.village,
        suburb: first.address?.suburb,
        road: first.address?.road,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
