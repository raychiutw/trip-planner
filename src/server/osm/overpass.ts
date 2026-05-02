/**
 * Overpass API — fetch OSM tags by osm_id/osm_type.
 *
 * Free, fair use. POST Overpass QL queries to the public endpoint.
 * Used by enrich orchestrator to fetch phone/website/opening_hours/cuisine
 * once Nominatim resolves osm_id.
 *
 * Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
 */

const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter';

export interface OsmTags {
  phone?: string;
  website?: string;
  email?: string;
  opening_hours?: string;
  cuisine?: string;
  wikidata?: string;     // 'Q12345'
  wikipedia?: string;    // 'en:Article Title'
  brand?: string;
  amenity?: string;
  tourism?: string;
  shop?: string;
  [k: string]: string | undefined;
}

interface RawOverpassResponse {
  elements?: Array<{ type: string; id: number; tags?: Record<string, string> }>;
}

export async function fetchTags(
  osmId: number,
  osmType: 'node' | 'way' | 'relation',
): Promise<OsmTags | null> {
  // Build Overpass QL query. `[out:json]` returns JSON; `out tags` returns
  // only metadata + tags (no geometry — keeps response tiny).
  const query = `[out:json][timeout:10];${osmType}(${osmId});out tags;`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    // 2026-05-02 fix: 原本送 Content-Type: text/plain 但 body 用
    // `data=<urlencoded>` — 格式不一致導致 Overpass parser 回 406 (Not Acceptable)。
    // poi-enrich-batch v2.19.0 100 個 POI 中 30 個（30%）撞此 bug。
    // 改用 application/x-www-form-urlencoded 對齊 body 格式。
    const res = await fetch(OVERPASS_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Tripline/1.0 (lean.lean@gmail.com)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Overpass HTTP ${res.status}`);
    }
    const data = (await res.json()) as RawOverpassResponse;
    const first = data.elements?.[0];
    if (!first?.tags) return null;
    // OSM tags use canonical lowercase keys + may include `contact:phone`/`contact:website`
    // alternates. Prefer top-level then fall back to contact:* prefix.
    const t = first.tags;
    return {
      phone: t['phone'] ?? t['contact:phone'],
      website: t['website'] ?? t['contact:website'],
      email: t['email'] ?? t['contact:email'],
      opening_hours: t['opening_hours'],
      cuisine: t['cuisine'],
      wikidata: t['wikidata'],
      wikipedia: t['wikipedia'],
      brand: t['brand'],
      amenity: t['amenity'],
      tourism: t['tourism'],
      shop: t['shop'],
    };
  } finally {
    clearTimeout(timer);
  }
}
