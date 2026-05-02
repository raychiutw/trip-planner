/**
 * POI enrich orchestrator — Nominatim → Overpass → OpenTripMap → Wikidata.
 *
 * Used by:
 *   - POST /api/pois/:id/enrich (commit 6) — single POI on-demand
 *   - scripts/poi-enrich-batch.ts (commit 5) — one-off backfill after migration 0045
 *
 * 90-day cache: if `pois.data_fetched_at` is within 90d, skip (unless
 * `forceRefresh: true`). The cache is the source of truth; downstream
 * mutations (UPDATE pois) overwrite cached fields without merge.
 *
 * Fields enriched (only NULL fields get filled, except rating which always
 * overwrites since the migration cleared 1-5 google ratings):
 *   - lat, lng           (Nominatim, only if missing)
 *   - osm_id, osm_type   (Nominatim)
 *   - address            (Nominatim, only if missing)
 *   - phone, website     (Overpass, only if missing)
 *   - email              (Overpass, only if missing)
 *   - hours              (Overpass opening_hours, only if missing)
 *   - cuisine            (Overpass)
 *   - wikidata_id        (Overpass tags or OpenTripMap)
 *   - rating             (OpenTripMap, always overwrite — 1-7 scale)
 *   - data_source        ('opentripmap' | 'osm' | 'merged')
 *   - data_fetched_at    (now)
 */

import type { D1Database } from '@cloudflare/workers-types';
import { geocode } from '../osm/nominatim';
import { fetchTags } from '../osm/overpass';
import { lookupByLocation } from '../osm/opentripmap';
import { fetchEntity } from '../osm/wikidata';

export interface EnrichOptions {
  db: D1Database;
  poiId: number;
  openTripMapApiKey?: string;
  forceRefresh?: boolean;
  /**
   * Inter-step throttle (ms). Nominatim's 1 req/sec policy is a hard rule;
   * batch script should set this to 1100ms+. On-demand single POI can use 0.
   */
  throttleMs?: number;
}

export interface EnrichResult {
  poiId: number;
  updated: boolean;
  reason: string;
  fieldsUpdated: string[];
  source: 'opentripmap' | 'osm' | 'merged' | null;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

interface PoiRow {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  hours: string | null;
  rating: number | null;
  cuisine: string | null;
  osm_id: number | null;
  osm_type: string | null;
  wikidata_id: string | null;
  data_source: string | null;
  data_fetched_at: number | null;
}

export async function enrichPoi(opts: EnrichOptions): Promise<EnrichResult> {
  const poi = await opts.db
    .prepare(
      'SELECT id, name, lat, lng, address, phone, website, email, hours, rating, cuisine, osm_id, osm_type, wikidata_id, data_source, data_fetched_at FROM pois WHERE id = ?',
    )
    .bind(opts.poiId)
    .first<PoiRow>();

  if (!poi) {
    return { poiId: opts.poiId, updated: false, reason: 'not found', fieldsUpdated: [], source: null };
  }

  // 90-day cache check
  if (!opts.forceRefresh && poi.data_fetched_at) {
    const age = Date.now() - poi.data_fetched_at;
    if (age < NINETY_DAYS_MS) {
      return { poiId: poi.id, updated: false, reason: `cached ${Math.round(age / 86400000)}d ago`, fieldsUpdated: [], source: null };
    }
  }

  const fields: Record<string, unknown> = {};
  const sources: Set<'opentripmap' | 'osm'> = new Set();

  // Step 1: Nominatim geocode if missing lat/lng OR osm_id
  if (!poi.lat || !poi.lng || !poi.osm_id) {
    const geo = await geocode(poi.name);
    if (geo) {
      if (!poi.lat) fields.lat = geo.lat;
      if (!poi.lng) fields.lng = geo.lng;
      if (!poi.osm_id) {
        fields.osm_id = geo.osmId;
        fields.osm_type = geo.osmType;
      }
      if (!poi.address) fields.address = geo.displayName;
      sources.add('osm');
      await throttle(opts.throttleMs);
    }
  }

  // Step 2: Overpass tags if we have osm_id
  const osmId = (fields.osm_id as number | undefined) ?? poi.osm_id;
  const osmType = (fields.osm_type as string | undefined) ?? poi.osm_type;
  if (osmId && (osmType === 'node' || osmType === 'way' || osmType === 'relation')) {
    const tags = await fetchTags(osmId, osmType);
    if (tags) {
      if (!poi.phone && tags.phone) fields.phone = tags.phone;
      if (!poi.website && tags.website) fields.website = tags.website;
      if (!poi.email && tags.email) fields.email = tags.email;
      if (!poi.hours && tags.opening_hours) fields.hours = tags.opening_hours;
      if (tags.cuisine) fields.cuisine = tags.cuisine;
      if (!poi.wikidata_id && tags.wikidata) fields.wikidata_id = tags.wikidata;
      sources.add('osm');
      await throttle(opts.throttleMs);
    }
  }

  // Step 3: OpenTripMap rating (always overwrite — migration cleared old Google ratings)
  const lat = (fields.lat as number | undefined) ?? poi.lat;
  const lng = (fields.lng as number | undefined) ?? poi.lng;
  if (opts.openTripMapApiKey && lat && lng) {
    const otm = await lookupByLocation({
      apiKey: opts.openTripMapApiKey,
      name: poi.name,
      lat,
      lng,
    });
    if (otm && otm.rate > 0) {
      fields.rating = otm.rate;
      if (!poi.wikidata_id && otm.wikidataId) fields.wikidata_id = otm.wikidataId;
      sources.add('opentripmap');
      await throttle(opts.throttleMs);
    }
  }

  // Step 4: Wikidata sitelinks (informational only — NOT stored in DB; logged
  // for caller observability via EnrichResult). Skip silently on no qid.
  const wikidataId = (fields.wikidata_id as string | undefined) ?? poi.wikidata_id;
  if (wikidataId) {
    try {
      await fetchEntity(wikidataId);
      // Sitelinks are a popularity signal we may surface in future UI; not persisted yet.
    } catch {
      // Best-effort — Wikidata fetch never blocks enrichment.
    }
  }

  // Resolve data_source
  let source: 'opentripmap' | 'osm' | 'merged' | null = null;
  if (sources.has('opentripmap') && sources.has('osm')) source = 'merged';
  else if (sources.has('opentripmap')) source = 'opentripmap';
  else if (sources.has('osm')) source = 'osm';

  // Persist if anything changed
  const fieldKeys = Object.keys(fields);
  if (fieldKeys.length === 0 && !source) {
    return { poiId: poi.id, updated: false, reason: 'no data found', fieldsUpdated: [], source: null };
  }

  // Always touch data_source + data_fetched_at on a non-empty enrich attempt
  // (so cache TTL refreshes even when external sources returned no new fields)
  if (source) fields.data_source = source;
  fields.data_fetched_at = Date.now();

  const setClauses = Object.keys(fields).map((k) => `${k} = ?`).join(', ');
  const values = Object.values(fields);
  await opts.db
    .prepare(`UPDATE pois SET ${setClauses} WHERE id = ?`)
    .bind(...values, poi.id)
    .run();

  return {
    poiId: poi.id,
    updated: true,
    reason: 'enriched',
    fieldsUpdated: fieldKeys,
    source,
  };
}

async function throttle(ms?: number): Promise<void> {
  if (!ms || ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
