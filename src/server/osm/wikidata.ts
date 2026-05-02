/**
 * Wikidata — fetch entity sitelinks for popularity proxy.
 *
 * No API key, no hard rate limit (fair use). Sitelinks count = number of
 * language Wikipedia articles linking to the entity. Used as a secondary
 * popularity signal when OpenTripMap rate is missing or low.
 *
 * Docs: https://www.wikidata.org/wiki/Wikidata:Data_access
 *
 * Higher sitelinks count ≈ more globally famous (e.g., 100+ for landmarks,
 * 10-50 for regional points of interest, 0-5 for local spots).
 */

const WIKIDATA_BASE = 'https://www.wikidata.org/w/api.php';

export interface WikidataEntity {
  qid: string;
  /** Number of language Wikipedia articles linking to this entity. */
  sitelinksCount: number;
  /** English label fallback */
  label?: string;
}

interface RawWbEntity {
  id: string;
  labels?: { en?: { value: string } };
  sitelinks?: Record<string, unknown>;
}

interface RawWbResponse {
  entities?: Record<string, RawWbEntity>;
}

export async function fetchEntity(qid: string): Promise<WikidataEntity | null> {
  if (!qid || !/^Q\d+$/.test(qid)) return null;

  const url = new URL(WIKIDATA_BASE);
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', qid);
  url.searchParams.set('props', 'labels|sitelinks');
  url.searchParams.set('languages', 'en');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');             // CORS-friendly anonymous query

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`Wikidata HTTP ${res.status}`);
    }
    const data = (await res.json()) as RawWbResponse;
    const entity = data.entities?.[qid];
    if (!entity) return null;
    return {
      qid: entity.id,
      sitelinksCount: entity.sitelinks ? Object.keys(entity.sitelinks).length : 0,
      label: entity.labels?.en?.value,
    };
  } finally {
    clearTimeout(timer);
  }
}
