/**
 * OpenRouteService — directions/distance API.
 *
 * Free tier: 2,000 req/day, 40 req/min. Requires API key (env ORS_API_KEY).
 *
 * Docs: https://openrouteservice.org/dev/#/api-docs/directions
 *
 * Caller (src/server/travel/compute.ts) wraps this with Haversine fallback
 * when ORS is unreachable, rate-limited, or returns no route.
 */

const ORS_BASE = 'https://api.openrouteservice.org/v2/directions';

export type OrsProfile =
  | 'driving-car'
  | 'driving-hgv'
  | 'foot-walking'
  | 'cycling-regular'
  | 'wheelchair';

export interface OrsResult {
  /** Distance in meters */
  distance_m: number;
  /** Duration in seconds */
  duration_s: number;
}

interface RawOrsResponse {
  routes?: Array<{
    summary?: {
      distance?: number;
      duration?: number;
    };
  }>;
  error?: { code?: number; message?: string };
}

export async function directions(opts: {
  apiKey: string;
  profile: OrsProfile;
  origin: { lat: number; lng: number };
  dest: { lat: number; lng: number };
}): Promise<OrsResult | null> {
  if (!opts.apiKey) throw new Error('ORS_API_KEY required');

  const url = `${ORS_BASE}/${opts.profile}`;
  const body = {
    coordinates: [
      [opts.origin.lng, opts.origin.lat],   // ORS uses [lng, lat] order
      [opts.dest.lng, opts.dest.lat],
    ],
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: opts.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      // 404 = no route found between points; not a transient error
      if (res.status === 404) return null;
      throw new Error(`ORS HTTP ${res.status}`);
    }
    const data = (await res.json()) as RawOrsResponse;
    const route = data.routes?.[0]?.summary;
    if (!route || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
      return null;
    }
    return {
      distance_m: Math.round(route.distance),
      duration_s: Math.round(route.duration),
    };
  } finally {
    clearTimeout(timer);
  }
}
