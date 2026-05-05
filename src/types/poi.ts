/**
 * POI (Point of Interest) shared types.
 *
 * Used by NewTripPage / EditTripPage / AddStopPage / ExplorePage POI search +
 * the `usePoiSearch` hook (`src/hooks/usePoiSearch.ts`).
 *
 * v2.23.0 google-maps-migration: OSM Nominatim → Google Places Text Search.
 * Canonical id = `place_id` (Google ChIJ... string). Legacy `osm_id` schema cols
 * 仍存於 D1（forward-fix safety net）但 frontend 只用 place_id。
 */

export interface PoiSearchResult {
  /** Google canonical place id (e.g. "ChIJ..."). v2.23.0+ canonical key. */
  place_id: string;
  name: string;
  /** Human-readable address. */
  address?: string;
  lat: number;
  lng: number;
  /** Google primary type, e.g. "restaurant" / "tourist_attraction". */
  category?: string;
  /** ISO 3166-1 alpha-2 uppercase, e.g. "JP". */
  country?: string;
  /** Country localized name (zh-TW), e.g. "日本". */
  country_name?: string;
  /** Google rating 1-5, optional. */
  rating?: number;
  /** business_status: 'OPERATIONAL' / 'CLOSED_TEMPORARILY' / 'CLOSED_PERMANENTLY' */
  business_status?: string;
}
