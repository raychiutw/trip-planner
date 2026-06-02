/**
 * Shared POI find-or-create helper.
 * Race-safe: uses INSERT OR IGNORE + re-fetch with UNIQUE(name, type) index.
 * COALESCE update: fills NULL fields on existing rows without overwriting.
 */
import { AppError } from './_errors';
import { normalizePoiAddress } from '../../src/lib/maps/normalize-address';

const POI_TYPE_WHITELIST = [
  'hotel',
  'restaurant',
  'shopping',
  'parking',
  'attraction',
  'transport',
  'activity',
  'other',
] as const;

export type PoiType = (typeof POI_TYPE_WHITELIST)[number];

const POI_TYPE_SET = new Set<string>(POI_TYPE_WHITELIST);

export function normalizePoiType(raw: unknown, fallback: PoiType = 'attraction'): PoiType {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') {
    throw new AppError('DATA_VALIDATION', 'type 必須是字串');
  }
  const type = raw.trim().toLowerCase();
  if (type === '') return fallback;
  if (!POI_TYPE_SET.has(type)) {
    throw new AppError('DATA_VALIDATION', `不支援的 POI type: ${raw}`);
  }
  return type as PoiType;
}

function normalizeOptionalString(raw: unknown, field: string): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw new AppError('DATA_VALIDATION', `${field} 必須是字串`);
  }
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

function normalizeCoordinate(raw: unknown, field: 'lat' | 'lng'): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new AppError('DATA_VALIDATION', `${field} 必須是數字`);
  }
  const min = field === 'lat' ? -90 : -180;
  const max = field === 'lat' ? 90 : 180;
  if (raw < min || raw > max) {
    throw new AppError('DATA_VALIDATION', `${field} 超出有效範圍`);
  }
  return raw;
}

function normalizeOptionalRating(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new AppError('DATA_VALIDATION', 'rating 必須是數字');
  }
  return raw;
}

export interface FindOrCreatePoiData {
  name: string;
  type: string;
  description?: string | null;
  // Migration 0045: dropped `maps` (replaced by mapsUrl helper, commit 13)
  // Migration 0066 (v2.30.15): dropped `mapcode` — Google/Apple Map link 已涵蓋導航需求
  lat?: number | null;
  lng?: number | null;
  // Migration 0045: renamed google_rating → rating (1-7 OpenTripMap, was 1-5 Google)
  rating?: number | null;
  category?: string | null;
  hours?: string | null;
  source?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  country?: string | null;
  // Migration 0054 (v2.25.4): price 從 trip_pois 移到 pois master
  price?: string | null;
  // v2.23.0: Google Places place_id — stored so POST /pois/:id/enrich works
  // immediately (else the POI waits for the 30-day place_id backfill).
  place_id?: string | null;
}

export interface FindOrCreatePoiPayload {
  name?: unknown;
  type?: unknown;
  lat?: unknown;
  lng?: unknown;
  rating?: unknown;
  category?: unknown;
  address?: unknown;
  country?: unknown;
  source?: unknown;
  place_id?: unknown;
}

export function normalizeFindOrCreatePoiPayload(raw: FindOrCreatePoiPayload): FindOrCreatePoiData {
  const name = normalizeOptionalString(raw.name, 'name');
  if (!name) throw new AppError('DATA_VALIDATION', 'name 必須是非空字串');

  return {
    name,
    type: normalizePoiType(raw.type),
    lat: normalizeCoordinate(raw.lat, 'lat'),
    lng: normalizeCoordinate(raw.lng, 'lng'),
    rating: normalizeOptionalRating(raw.rating),
    category: normalizeOptionalString(raw.category, 'category'),
    // v2.31.36: address 經 normalizePoiAddress 清「號號」/「縣縣」等 typo doubled。
    address: normalizePoiAddress(normalizeOptionalString(raw.address, 'address')),
    country: normalizeOptionalString(raw.country, 'country'),
    source: normalizeOptionalString(raw.source, 'source') ?? 'google',
    place_id: normalizeOptionalString(raw.place_id, 'place_id'),
  };
}

const COALESCE_FIELDS = [
  'description', 'lat', 'lng', 'rating',
  'category', 'hours', 'address', 'phone', 'email', 'website', 'country',
  'price', 'place_id',
] as const;

type CoalesceField = typeof COALESCE_FIELDS[number];

function buildCoalesceUpdate(data: FindOrCreatePoiData): { fills: string[]; vals: unknown[] } {
  const fills: string[] = [];
  const vals: unknown[] = [];
  for (const col of COALESCE_FIELDS) {
    const val = data[col as CoalesceField];
    if (val != null) {
      fills.push(`${col} = COALESCE(${col}, ?)`);
      vals.push(val);
    }
  }
  return { fills, vals };
}

export async function findOrCreatePoi(
  db: D1Database,
  data: FindOrCreatePoiData,
): Promise<number> {
  // Try exact match first (dedup key = name + type)
  const existing = await db.prepare(
    'SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1'
  ).bind(data.name, data.type).first<{ id: number }>();

  if (existing) {
    // COALESCE update: only fill NULL fields, never overwrite existing values
    const { fills, vals } = buildCoalesceUpdate(data);
    if (fills.length > 0) {
      await db.prepare(`UPDATE pois SET ${fills.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
        .bind(...vals, existing.id).run();
    }
    return existing.id;
  }

  // Not found → INSERT (INSERT OR IGNORE for race-safety with UNIQUE index)
  // Migration 0045: dropped maps col (use mapsUrl helper).
  // Migration 0054: added price col.
  const result = await db.prepare(
    'INSERT OR IGNORE INTO pois (type, name, description, hours, rating, category, lat, lng, source, address, phone, email, website, country, price, place_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).bind(
    data.type, data.name, data.description ?? null, data.hours ?? null,
    data.rating ?? null, data.category ?? null,
    data.lat ?? null, data.lng ?? null, data.source ?? 'ai',
    data.address ?? null, data.phone ?? null, data.email ?? null,
    data.website ?? null, data.country ?? 'JP', data.price ?? null,
    data.place_id ?? null,
  ).first<{ id: number }>();

  // INSERT OR IGNORE returns null if concurrent insert won the race
  if (result) return result.id;

  const reFetch = await db.prepare(
    'SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1'
  ).bind(data.name, data.type).first<{ id: number }>();
  if (!reFetch) throw new AppError('SYS_DB_ERROR', 'POI lost after INSERT OR IGNORE');
  return reFetch.id;
}

/**
 * Batch find-or-create multiple POIs in 2–3 DB round-trips instead of N.
 * Returns an array of poi IDs in the same order as the input.
 */
export async function batchFindOrCreatePois(
  db: D1Database,
  items: FindOrCreatePoiData[],
): Promise<number[]> {
  if (items.length === 0) return [];

  // Deduplicate by (name, type) — same POI may appear multiple times
  const keyOf = (d: FindOrCreatePoiData) => `${d.type}\0${d.name}`;
  const uniqueMap = new Map<string, { data: FindOrCreatePoiData; poiId?: number }>();
  for (const item of items) {
    const key = keyOf(item);
    if (!uniqueMap.has(key)) uniqueMap.set(key, { data: item });
  }
  const uniqueItems = [...uniqueMap.values()];

  // Step 1: Batch SELECT all existing POIs
  const selectStmts = uniqueItems.map(({ data }) =>
    db.prepare('SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1').bind(data.name, data.type)
  );
  const selectResults = await db.batch(selectStmts);

  // Separate found vs. missing
  const toUpdate: { idx: number; id: number }[] = [];
  const toInsert: number[] = [];
  for (let i = 0; i < uniqueItems.length; i++) {
    const rows = selectResults[i]!.results as { id: number }[];
    if (rows.length > 0) {
      uniqueItems[i]!.poiId = rows[0]!.id;
      toUpdate.push({ idx: i, id: rows[0]!.id });
    } else {
      toInsert.push(i);
    }
  }

  // Step 2: Batch COALESCE updates for existing POIs
  if (toUpdate.length > 0) {
    const updateStmts: D1PreparedStatement[] = [];
    for (const { idx, id } of toUpdate) {
      const { fills, vals } = buildCoalesceUpdate(uniqueItems[idx]!.data);
      if (fills.length > 0) {
        updateStmts.push(
          db.prepare(`UPDATE pois SET ${fills.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
            .bind(...vals, id)
        );
      }
    }
    if (updateStmts.length > 0) await db.batch(updateStmts);
  }

  // Step 3: Batch INSERT OR IGNORE for missing POIs
  if (toInsert.length > 0) {
    const insertStmts = toInsert.map((idx) => {
      const data = uniqueItems[idx]!.data;
      return db.prepare(
        'INSERT OR IGNORE INTO pois (type, name, description, hours, rating, category, lat, lng, source, address, phone, email, website, country, price, place_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
      ).bind(
        data.type, data.name, data.description ?? null, data.hours ?? null,
        data.rating ?? null, data.category ?? null,
        data.lat ?? null, data.lng ?? null, data.source ?? 'ai',
        data.address ?? null, data.phone ?? null, data.email ?? null,
        data.website ?? null, data.country ?? 'JP', data.price ?? null,
        data.place_id ?? null,
      );
    });
    const insertResults = await db.batch(insertStmts);

    // Collect IDs; race-collisions (INSERT OR IGNORE) return empty results
    const reFetchIndices: number[] = [];
    for (let i = 0; i < toInsert.length; i++) {
      const rows = insertResults[i]!.results as { id: number }[];
      if (rows.length > 0) {
        uniqueItems[toInsert[i]!]!.poiId = rows[0]!.id;
      } else {
        reFetchIndices.push(toInsert[i]!);
      }
    }

    // Step 4: Re-fetch any race-collision rows
    if (reFetchIndices.length > 0) {
      const reFetchStmts = reFetchIndices.map((idx) => {
        const data = uniqueItems[idx]!.data;
        return db.prepare('SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1')
          .bind(data.name, data.type);
      });
      const reFetchResults = await db.batch(reFetchStmts);
      for (let i = 0; i < reFetchIndices.length; i++) {
        const rows = reFetchResults[i]!.results as { id: number }[];
        const refetched = rows[0];
        if (!refetched) throw new AppError('SYS_DB_ERROR', 'POI lost after race-collision re-fetch');
        uniqueItems[reFetchIndices[i]!]!.poiId = refetched.id;
      }
    }
  }

  // Map back: input order → poiId
  return items.map((item) => {
    const entry = uniqueMap.get(keyOf(item));
    if (!entry?.poiId) throw new AppError('SYS_DB_ERROR', 'POI ID missing after batch upsert');
    return entry.poiId;
  });
}
