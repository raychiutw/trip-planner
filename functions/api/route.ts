/**
 * Route proxy — Mapbox Directions API
 *
 * Frontend fetches /api/route?from=lng,lat&to=lng,lat → Worker fetches Mapbox
 * with server-side token. Token never reaches the browser.
 *
 * Response shape (always HTTP 200 for valid coords):
 *   { polyline: [[lat, lng], ...], duration: seconds|null, distance: meters, approx?: boolean }
 *   approx=true means Mapbox had no driving route (e.g. ferry-only islands);
 *   server returned a Haversine straight-line fallback so frontend can draw
 *   something sensible without extra coordination.
 * Error shape (HTTP 4xx/5xx):
 *   { error: 'code', message?: 'hint' }
 */

import type { Env as BaseEnv } from './_types';

interface Env extends BaseEnv {
  MAPBOX_TOKEN?: string;
}

interface Coord { lng: number; lat: number; }

function parseCoord(raw: string | null): Coord | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return { lng, lat };
}

function errorJson(code: string, status: number, message?: string): Response {
  return new Response(JSON.stringify(message ? { error: code, message } : { error: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Haversine straight-line distance in metres between two lng/lat points. */
function haversineMeters(a: Coord, b: Coord): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function approxResponse(from: Coord, to: Coord): Response {
  return new Response(
    JSON.stringify({
      polyline: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      duration: null,
      distance: Math.round(haversineMeters(from, to)),
      approx: true,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const from = parseCoord(url.searchParams.get('from'));
  const to = parseCoord(url.searchParams.get('to'));
  if (!from || !to) return errorJson('INVALID_COORDS', 400, 'from/to must be lng,lat within range');

  const token = context.env.MAPBOX_TOKEN;
  if (!token) return errorJson('CONFIG_MISSING', 500, 'Mapbox token not configured on server');

  const mapboxUrl =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = await fetch(mapboxUrl);
  } catch {
    // Network/DNS failure reaching Mapbox — fall back to straight line
    return approxResponse(from, to);
  }

  if (res.status === 429) return errorJson('RATE_LIMITED', 429);
  if (!res.ok) {
    // Mapbox 4xx/5xx (quota, bad token, etc.) — fall back rather than bubble up
    return approxResponse(from, to);
  }

  const data = (await res.json()) as {
    routes?: Array<{
      geometry?: { coordinates?: [number, number][] };
      duration?: number;
      distance?: number;
    }>;
  };
  const route = data.routes?.[0];
  // No driving route available (ferry-only island, mid-ocean coord, etc.) — fall back
  if (!route?.geometry?.coordinates) return approxResponse(from, to);

  const polyline = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  return new Response(
    JSON.stringify({
      polyline,
      duration: route.duration ?? null,
      distance: route.distance ?? null,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
};
