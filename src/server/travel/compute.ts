/**
 * Travel compute orchestrator — ORS primary, Haversine fallback.
 *
 * Used by:
 *   - POST /api/trips/:id/recompute-travel (commit 6) for batch recompute
 *     when entries are reordered.
 *   - Future: real-time pin distance overlays on /map page.
 *
 * Returns `{distance_m, duration_s, source}`. `source` traces which path
 * produced the answer — ORS (real road network), Haversine (straight-line
 * × factor + nominal speed), or manual (caller-provided override, e.g.
 * tp-* skill writes specific value).
 */

import { directions, type OrsProfile } from '../routing/ors';

export type TravelMode = 'driving' | 'walking' | 'transit';
export type TravelSource = 'ors' | 'osrm' | 'haversine' | 'manual';

export interface TravelResult {
  distance_m: number;
  duration_s: number;
  source: TravelSource;
}

/** Map our trip-level mode to an ORS profile (transit not supported yet by ORS free). */
function modeToOrsProfile(mode: TravelMode): OrsProfile | null {
  switch (mode) {
    case 'driving':
      return 'driving-car';
    case 'walking':
      return 'foot-walking';
    case 'transit':
      // ORS free tier doesn't include transit. Caller will fall back to Haversine.
      return null;
  }
}

/**
 * Haversine great-circle distance × road factor (1.3) for an estimate that's
 * usable when ORS is unavailable. Speed assumptions: driving 50 km/h,
 * walking 5 km/h, transit 30 km/h. These are deliberately conservative —
 * rather under-estimate travel time than mislead user.
 */
const ROAD_FACTOR = 1.3;
const NOMINAL_KMH: Record<TravelMode, number> = {
  driving: 50,
  walking: 5,
  transit: 30,
};

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371_000;       // Earth radius (m)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function haversineEstimate(opts: {
  mode: TravelMode;
  origin: { lat: number; lng: number };
  dest: { lat: number; lng: number };
}): TravelResult {
  const straight = haversineMeters(opts.origin, opts.dest);
  const distance_m = Math.round(straight * ROAD_FACTOR);
  const speedMs = (NOMINAL_KMH[opts.mode] * 1000) / 3600;
  const duration_s = Math.round(distance_m / speedMs);
  return { distance_m, duration_s, source: 'haversine' };
}

/**
 * Try ORS first. If apiKey missing, ORS unreachable, or no route, fall back
 * to Haversine. Always returns a result (never throws — failure mode is
 * degraded estimate, not error).
 */
export async function computeTravel(opts: {
  orsApiKey?: string;
  mode: TravelMode;
  origin: { lat: number; lng: number };
  dest: { lat: number; lng: number };
}): Promise<TravelResult> {
  // No coordinates → Haversine returns NaN; let caller handle by skipping.
  if (
    !Number.isFinite(opts.origin.lat) || !Number.isFinite(opts.origin.lng) ||
    !Number.isFinite(opts.dest.lat) || !Number.isFinite(opts.dest.lng)
  ) {
    return { distance_m: 0, duration_s: 0, source: 'haversine' };
  }

  const profile = modeToOrsProfile(opts.mode);
  if (opts.orsApiKey && profile) {
    try {
      const ors = await directions({
        apiKey: opts.orsApiKey,
        profile,
        origin: opts.origin,
        dest: opts.dest,
      });
      if (ors) return { ...ors, source: 'ors' };
    } catch {
      // Fall through to Haversine — never let routing failure block trip render.
    }
  }
  return haversineEstimate({ mode: opts.mode, origin: opts.origin, dest: opts.dest });
}
