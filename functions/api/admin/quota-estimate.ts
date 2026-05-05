/**
 * GET /api/admin/quota-estimate
 *
 * Returns 24h Google Maps API request counts per service. Used by
 * scripts/google-quota-monitor.ts to estimate MTD spend.
 *
 * v1 implementation: counts cache rows by service from `pois_search_cache`
 * + counts /api/route + /api/poi-search hits from `api_logs` if available.
 * This is an APPROXIMATION — full Cloud Monitoring API integration deferred
 * to v2.24.0 (TODO).
 *
 * Auth: admin only.
 *
 * Response: Array<{ service: string, count_24h: number }>
 *   Services: search_text / place_details / directions / maps_js / geocoding / autocomplete
 */
import { AppError } from '../_errors';
import { requireAuth } from '../_auth';
import type { Env } from '../_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  if (!auth.isAdmin) throw new AppError('PERM_ADMIN_ONLY');

  const db = context.env.DB;

  // Search Text: count cache misses fetched in last 24h (cache HIT vs MISS proxy).
  // pois_search_cache fetched_at within 24h tells us how many fresh searches landed.
  const search = await db.prepare(
    `SELECT COUNT(*) AS n FROM pois_search_cache
     WHERE fetched_at > datetime('now', '-1 day')`,
  ).first<{ n: number }>();

  // Place Details: count POIs whose status_checked_at is within 24h
  const details = await db.prepare(
    `SELECT COUNT(*) AS n FROM pois
     WHERE status_checked_at IS NOT NULL
       AND status_checked_at > datetime('now', '-1 day')`,
  ).first<{ n: number }>();

  // Directions / Maps JS / Geocoding / Autocomplete — no D1 trace yet.
  // Return rough estimates based on Ray's typical scale (50-100 trip views/day).
  // Real values to be filled by Cloud Monitoring API in v2.24.0.

  return new Response(
    JSON.stringify([
      { service: 'search_text', count_24h: search?.n || 0 },
      { service: 'place_details', count_24h: details?.n || 0 },
      { service: 'directions', count_24h: 50 }, // placeholder estimate
      { service: 'maps_js', count_24h: 20 },    // placeholder estimate
      { service: 'geocoding', count_24h: 5 },   // placeholder estimate
      { service: 'autocomplete', count_24h: 10 }, // placeholder estimate
    ]),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
