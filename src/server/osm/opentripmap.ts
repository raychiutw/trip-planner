/**
 * OpenTripMap — POI rating (1-7 popularity) + wiki link.
 *
 * Wraps OSM + Wikidata into a single rating signal. Free tier 5,000 req/day,
 * 5 req/sec. Requires API key (env OPENTRIPMAP_API_KEY).
 *
 * Docs: https://opentripmap.io/docs
 *
 * Used by enrich orchestrator to backfill `pois.rating` after the migration
 * cleared old Google ratings (1-5 → NULL → 1-7 from OpenTripMap).
 */

const OPENTRIPMAP_BASE = 'https://api.opentripmap.com/0.1/en/places';

export interface OpenTripMapPlace {
  /** OpenTripMap unique identifier */
  xid: string;
  name: string;
  /** Popularity rate 1-7 (h suffix when wiki present, e.g. '7h' → 7) */
  rate: number;
  /** Has wiki article */
  hasWiki: boolean;
  kinds: string;
  wikidataId?: string;
}

interface RawRadiusItem {
  xid: string;
  name?: string;
  rate?: number | string;
  kinds?: string;
  wikidata?: string;
  point?: { lat: number; lon: number };
  dist?: number;
}

/**
 * Look up POI by name + lat/lng. Uses radius search for matching since
 * OpenTripMap has no direct name search. Returns the closest match with
 * highest rate when multiple candidates exist.
 */
export async function lookupByLocation(opts: {
  apiKey: string;
  name: string;
  lat: number;
  lng: number;
  radiusM?: number;
}): Promise<OpenTripMapPlace | null> {
  const radius = opts.radiusM ?? 200;
  const url = new URL(`${OPENTRIPMAP_BASE}/radius`);
  url.searchParams.set('apikey', opts.apiKey);
  url.searchParams.set('lat', String(opts.lat));
  url.searchParams.set('lon', String(opts.lng));
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('limit', '20');
  url.searchParams.set('rate', '1');               // Filter: only items with a rate
  url.searchParams.set('format', 'json');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`OpenTripMap HTTP ${res.status}`);
    }
    const items = (await res.json()) as RawRadiusItem[];
    if (!items.length) return null;

    // Find closest name match (case-insensitive substring), fall back to
    // the item with the highest rate among the radius hits.
    const lowerName = opts.name.toLowerCase();
    let best: RawRadiusItem | undefined;
    for (const item of items) {
      const itemName = item.name?.toLowerCase() ?? '';
      if (itemName === lowerName || itemName.includes(lowerName)) {
        best = item;
        break;
      }
    }
    if (!best) {
      // Pick highest rate (rate may be '7h' string with wiki suffix)
      best = items.reduce((acc, cur) => {
        const a = parseRate(acc.rate);
        const c = parseRate(cur.rate);
        return c > a ? cur : acc;
      });
    }
    if (!best) return null;

    const rate = parseRate(best.rate);
    return {
      xid: best.xid,
      name: best.name ?? opts.name,
      rate,
      hasWiki: typeof best.rate === 'string' && best.rate.endsWith('h'),
      kinds: best.kinds ?? '',
      wikidataId: best.wikidata,
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseRate(rate: number | string | undefined): number {
  if (typeof rate === 'number') return rate;
  if (typeof rate === 'string') {
    const stripped = rate.replace(/h$/, ''); // 'h' suffix means has wiki
    const n = parseInt(stripped, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}
