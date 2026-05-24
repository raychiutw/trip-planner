/**
 * mapTypes.ts — pure types for map data + route coords.
 *
 * v2.33.57 round 11: extracted from `src/hooks/useMapData.ts` and
 * `src/hooks/useRoute.ts` to break the lib→hooks reverse import that
 * `src/lib/mapHelpers.ts` would otherwise introduce.
 *
 * Both hooks re-export these types for backward compat (17+ caller 不動)。
 */

export type MapPinType = 'entry' | 'hotel';

export interface MapPin {
  id: number;
  type: MapPinType;
  /** 顯示順序 (1-based)，hotel 用 0 */
  index: number;
  title: string;
  lat: number;
  lng: number;
  time?: string | null;
  googleRating?: number | null;
  travelMin?: number | null;
  travelType?: string | null;
  sortOrder: number;
}

export interface Coord {
  lat: number;
  lng: number;
}
