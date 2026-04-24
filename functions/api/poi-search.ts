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
}

export interface PoiSearchResult {
  osm_id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
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
  }));

  return jsonResponse({ results }, 200, {
    'Cache-Control': `public, max-age=86400`,
  });
};
