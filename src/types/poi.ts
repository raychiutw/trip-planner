/**
 * POI (Point of Interest) shared types.
 *
 * Used by NewTripPage / EditTripPage / AddStopPage / ExplorePage POI search +
 * the `usePoiSearch` hook (`src/hooks/usePoiSearch.ts`).
 *
 * Source backend: `functions/api/poi-search.ts` returns OSM-derived rows
 * (Nominatim + Overpass enrichment). The most permissive shape (EditTripPage)
 * is canonical here so all consumers can reuse without re-typing.
 */

export interface PoiSearchResult {
  osm_id: number;
  osm_type?: 'node' | 'way' | 'relation' | null;
  name: string;
  /** Human-readable address. May be empty for some OSM nodes. */
  address?: string;
  lat: number;
  lng: number;
  /** OSM tag-derived category (e.g. 'tourism', 'amenity'). May be normalised by `mapNominatimCategory`. */
  category?: string;
  /** ISO country code (e.g. 'JP', 'TW'). Optional — Nominatim returns it when zoom>0. */
  country?: string;
  /** Localised country name (e.g. 'Japan', 'Taiwan'). */
  country_name?: string;
}
