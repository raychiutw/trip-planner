/**
 * GET /api/poi-search?q=<query>&limit=<n>
 *
 * Proxy to OSM Nominatim search. Response has `Cache-Control: public, max-age=86400`
 * so the Cloudflare edge caches identical queries for 24h automatically.
 *
 * Response: { results: Array<{ osm_id, name, address, lat, lng, category }> }
 * On Nominatim failure: 502 (or 503 if upstream 503) with { error: "upstream_failed" }.
 */
import { AppError } from './_errors';

interface NominatimResult {
  place_id: number;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  /** addressdetails=1 時 Nominatim 回傳的 address breakdown。 */
  address?: {
    country?: string;
    country_code?: string;  // ISO 3166-1 alpha-2 (lowercase, 例：'jp', 'tw')
    state?: string;
    city?: string;
    town?: string;
  };
}

export interface PoiSearchResult {
  osm_id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  /** PR-BB 2026-04-26：ISO 3166-1 alpha-2 大寫（'JP' / 'TW' / 'KR' 等）。
   * NewTripModal 的 destination autocomplete 用此值取代原本 detectCountries()
   * keyword regex 猜測 — 直接拿 OSM 真實 country code 更精準。 */
  country?: string;
  /** Country full name（中文 / 英文都可能，看 Accept-Language 而定）。 */
  country_name?: string;
}

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q')?.trim();
  const limitParam = url.searchParams.get('limit');

  if (!q || q.length < 2) {
    throw new AppError('DATA_VALIDATION', 'query (q) 至少 2 個字元');
  }
  if (q.length > 200) {
    throw new AppError('DATA_VALIDATION', 'query (q) 過長（max 200）');
  }

  const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 50);

  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
  nominatimUrl.searchParams.set('q', q);
  nominatimUrl.searchParams.set('format', 'json');
  nominatimUrl.searchParams.set('addressdetails', '1');
  nominatimUrl.searchParams.set('limit', String(limit));

  const upstream = await fetch(nominatimUrl.toString(), {
    headers: {
      'User-Agent': 'Tripline/1.0 (https://trip-planner-dby.pages.dev)',
      'Accept-Language': 'zh-TW, zh, en',
    },
  });

  if (!upstream.ok) {
    return jsonResponse(
      { error: 'upstream_failed', status: upstream.status },
      upstream.status === 503 ? 503 : 502,
    );
  }

  const raw = await upstream.json<NominatimResult[]>();
  const results: PoiSearchResult[] = raw.map((r) => ({
    osm_id: r.osm_id,
    name: r.name ?? r.display_name.split(',')[0]?.trim() ?? r.display_name,
    address: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    category: r.class ?? r.type ?? 'poi',
    country: r.address?.country_code?.toUpperCase(),
    country_name: r.address?.country,
  }));

  return jsonResponse({ results }, 200, {
    'Cache-Control': `public, max-age=86400`,
  });
};
