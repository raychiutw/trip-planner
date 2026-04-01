/**
 * Shared POI find-or-create helper.
 * Race-safe: uses INSERT OR IGNORE + re-fetch with UNIQUE(name, type) index.
 * COALESCE update: fills NULL fields on existing rows without overwriting.
 */
import { AppError } from './_errors';

export interface FindOrCreatePoiData {
  name: string;
  type: string;
  description?: string | null;
  maps?: string | null;
  mapcode?: string | null;
  lat?: number | null;
  lng?: number | null;
  google_rating?: number | null;
  category?: string | null;
  hours?: string | null;
  source?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  country?: string | null;
}

const COALESCE_FIELDS = [
  'description', 'maps', 'mapcode', 'lat', 'lng', 'google_rating',
  'category', 'hours', 'address', 'phone', 'email', 'website', 'country',
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
  const result = await db.prepare(
    'INSERT OR IGNORE INTO pois (type, name, description, hours, google_rating, category, maps, mapcode, lat, lng, source, address, phone, email, website, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).bind(
    data.type, data.name, data.description ?? null, data.hours ?? null,
    data.google_rating ?? null, data.category ?? null,
    data.maps ?? null, data.mapcode ?? null,
    data.lat ?? null, data.lng ?? null, data.source ?? 'ai',
    data.address ?? null, data.phone ?? null, data.email ?? null,
    data.website ?? null, data.country ?? 'JP',
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
    const rows = selectResults[i].results as { id: number }[];
    if (rows.length > 0) {
      uniqueItems[i].poiId = rows[0].id;
      toUpdate.push({ idx: i, id: rows[0].id });
    } else {
      toInsert.push(i);
    }
  }

  // Step 2: Batch COALESCE updates for existing POIs
  if (toUpdate.length > 0) {
    const updateStmts: D1PreparedStatement[] = [];
    for (const { idx, id } of toUpdate) {
      const { fills, vals } = buildCoalesceUpdate(uniqueItems[idx].data);
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
      const data = uniqueItems[idx].data;
      return db.prepare(
        'INSERT OR IGNORE INTO pois (type, name, description, hours, google_rating, category, maps, mapcode, lat, lng, source, address, phone, email, website, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
      ).bind(
        data.type, data.name, data.description ?? null, data.hours ?? null,
        data.google_rating ?? null, data.category ?? null,
        data.maps ?? null, data.mapcode ?? null,
        data.lat ?? null, data.lng ?? null, data.source ?? 'ai',
        data.address ?? null, data.phone ?? null, data.email ?? null,
        data.website ?? null, data.country ?? 'JP',
      );
    });
    const insertResults = await db.batch(insertStmts);

    // Collect IDs; race-collisions (INSERT OR IGNORE) return empty results
    const reFetchIndices: number[] = [];
    for (let i = 0; i < toInsert.length; i++) {
      const rows = insertResults[i].results as { id: number }[];
      if (rows.length > 0) {
        uniqueItems[toInsert[i]].poiId = rows[0].id;
      } else {
        reFetchIndices.push(toInsert[i]);
      }
    }

    // Step 4: Re-fetch any race-collision rows
    if (reFetchIndices.length > 0) {
      const reFetchStmts = reFetchIndices.map((idx) => {
        const data = uniqueItems[idx].data;
        return db.prepare('SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1')
          .bind(data.name, data.type);
      });
      const reFetchResults = await db.batch(reFetchStmts);
      for (let i = 0; i < reFetchIndices.length; i++) {
        const rows = reFetchResults[i].results as { id: number }[];
        uniqueItems[reFetchIndices[i]].poiId = rows[0].id;
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
