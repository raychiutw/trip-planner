/**
 * GET /api/poi-search?q=<query>&region=<JP|TW|KR>&limit=<n>
 *
 * v2.23.0 google-maps-migration: 改打 Google Places Text Search (replaces OSM Nominatim).
 * D1 cache 24h（pois_search_cache table）— identical (query+region) within 24h hits cache.
 *
 * Response: { results: Array<{ place_id, name, address, lat, lng, category, country, country_name }> }
 *
 * Failures: any Google upstream error → 502 MAPS_UPSTREAM_FAILED (no fallback per P11).
 *           kill switch active → 503 MAPS_LOCKED.
 *
 * Cache-Control: private, max-age=300 — 短 edge cache 因為 D1 cache 24h，edge 5min 即可。
 */
import { AppError } from './_errors';
import { assertGoogleAvailable } from './_maps_lock';
import { searchPlaces, type PlacesSearchTextResult } from '../../src/server/maps/google-client';
import { getCachedSearch, setCachedSearch } from '../../src/lib/maps/cache';
import { regionToLocationBias } from '../../src/lib/maps/region';
import type { Env } from './_types';

export type PoiSearchResult = PlacesSearchTextResult;

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q')?.trim();
  const regionRaw = url.searchParams.get('region')?.trim() || undefined;
  // 兼容 v2.23.3：region 可能是 ISO code (e.g. "JP") 或 city 中文 ("東京")。
  // city 中文 → locationBias circle（強制 city-level bias）；ISO → regionCode only（弱 ranking 提示）
  const cityBias = regionToLocationBias(regionRaw);
  const region = cityBias?.countryCode ?? regionRaw?.toUpperCase();
  const limitParam = url.searchParams.get('limit');

  if (!q || q.length < 2) {
    throw new AppError('DATA_VALIDATION', 'query (q) 至少 2 個字元');
  }
  if (q.length > 200) {
    throw new AppError('DATA_VALIDATION', 'query (q) 過長（max 200）');
  }
  const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 20);

  const apiKey = context.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // Misconfiguration is treated as upstream failure — operations sees 502 + alert.
    throw new AppError('MAPS_UPSTREAM_FAILED', 'GOOGLE_MAPS_API_KEY not configured');
  }

  await assertGoogleAvailable(context.env.DB);

  // D1 cache check
  const cached = await getCachedSearch(context.env.DB, q, region);
  if (cached) {
    return jsonResponse(
      { results: cached.slice(0, limit) },
      200,
      { 'Cache-Control': 'private, max-age=300', 'X-Cache': 'HIT' },
    );
  }

  const results = await searchPlaces(apiKey, q, region, limit, cityBias);

  // Fire-and-forget cache write — don't block response
  context.waitUntil(setCachedSearch(context.env.DB, q, region, results));

  return jsonResponse(
    { results },
    200,
    { 'Cache-Control': 'private, max-age=300', 'X-Cache': 'MISS' },
  );
};
