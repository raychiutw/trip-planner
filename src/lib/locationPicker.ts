/**
 * locationPicker — pure helpers for <LocationPickerMap> (v2.31.94).
 *
 * Imperative wiring (idle listener / CSS overlay / panBy arrow keys) lives in
 * the component file; this module hosts the pure math + fallback logic so it
 * can be unit-tested without spinning up Google Maps JS.
 */

export interface Coord {
  lat: number;
  lng: number;
}

const TOKYO_STATION: Coord = { lat: 35.6812, lng: 139.7671 };
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const TILE_SIZE = 256;
/** Target meters per keypress per design doc Open Q #3 ergonomic test. */
const ARROW_KEY_TARGET_METERS = 10;

export function isValidCoord(c: Coord | null | undefined): c is Coord {
  if (!c) return false;
  if (typeof c.lat !== 'number' || typeof c.lng !== 'number') return false;
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false;
  if (c.lat < -90 || c.lat > 90) return false;
  if (c.lng < -180 || c.lng > 180) return false;
  return true;
}

/**
 * Web Mercator meters-per-pixel at given zoom + latitude.
 *
 * Formula: m/px = (earth circumference × cos(lat)) / (tileSize × 2^zoom)
 */
function metersPerPixel(zoom: number, latitudeDeg: number): number {
  const cos = Math.cos((latitudeDeg * Math.PI) / 180);
  return (EARTH_CIRCUMFERENCE_M * Math.abs(cos)) / (TILE_SIZE * 2 ** zoom);
}

/**
 * Pixel offset for one arrow-key nudge, targeting ~10 meters per keypress.
 *
 * At zoom 14 mid-latitude: ~1-2 px (about one building) — feels precise.
 * At zoom 17: ~8 px — finger-friendly fine-tune.
 * Floor at 1 px to keep the action visible.
 */
export function computeArrowKeyStepPixels(zoom: number, latitudeDeg: number): number {
  if (!Number.isFinite(zoom) || !Number.isFinite(latitudeDeg)) return 1;
  const mppx = metersPerPixel(zoom, latitudeDeg);
  if (!Number.isFinite(mppx) || mppx <= 0) return 1;
  const step = Math.round(ARROW_KEY_TARGET_METERS / mppx);
  return Math.max(1, step);
}

export interface SelectDefaultCenterOptions {
  prevEntry?: Coord | null;
  tripDestinations?: Array<Coord | null | undefined>;
  /** Optional trip center fallback (geographic centroid). */
  tripCenter?: Coord | null;
}

/**
 * Resolve the initial map center for the picker.
 *
 * Fallback chain per design doc:
 *   1. prevEntry (most recent map context)
 *   2. trip.destinations[0..N] (first valid)
 *   3. trip.center (geographic centroid)
 *   4. Tokyo Station hard fallback (globally useful, non-region-specific)
 */
export function selectDefaultCenter(opts: SelectDefaultCenterOptions): Coord {
  if (isValidCoord(opts.prevEntry ?? null)) return opts.prevEntry!;
  for (const dest of opts.tripDestinations ?? []) {
    if (isValidCoord(dest ?? null)) return dest!;
  }
  if (isValidCoord(opts.tripCenter ?? null)) return opts.tripCenter!;
  return TOKYO_STATION;
}
