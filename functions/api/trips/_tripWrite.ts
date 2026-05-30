/**
 * _tripWrite — shared low-level primitives for creating a new trip via chunked,
 * rollback-safe D1 writes. Consumed by both POST /api/trips/import (attacker JSON)
 * and POST /api/share/:token/clone (trusted server-side share payload).
 *
 * D1 has no interactive transaction, db.batch() can't chain a generated id into a
 * later statement, and has a ~100-statement-per-batch limit — so callers run CHUNKED
 * sequential batches with INSERT…RETURNING id, track created ids, and connect-root
 * rollback on any failure. POIs are find-or-create by UNIQUE(name,type): pre-existing
 * rows are reused AS-IS (never mutated → no shared-catalog poisoning), only newly-
 * created ids are tracked for rollback.
 */
import { AppError } from '../_errors';

export const BATCH_CHUNK = 50; // stay well under D1's ~100-statement-per-batch limit
export const MAX_TRIPS_PER_USER = 1000;
export const TRIP_DOC_TYPES = ['flights', 'checklist', 'backup', 'emergency', 'suggestions'];

type Stmt = D1PreparedStatement;

/** Extract the RETURNING id; a missing id means the INSERT silently failed. */
export function reqId(r: D1Result, msg = '寫入失敗'): number {
  const id = (r.results?.[0] as { id?: number } | undefined)?.id;
  if (typeof id !== 'number' || id <= 0) throw new AppError('SYS_DB_ERROR', msg);
  return id;
}

export interface ResolvablePoi {
  type: string;
  name: string;
  category: string | null;
  lat: number | null;
  lng: number | null;
  hours: string | null;
  rating: number | null;
  price?: string | null;
  address: string | null;
  placeId: string | null;
}

/**
 * Find-or-create a POI by UNIQUE(name, type). pois enforces that index, so callers
 * MUST reuse an existing row rather than INSERT a duplicate. Pre-existing pois are
 * returned AS-IS (never mutated); only newly-created ids are tracked for rollback.
 */
export async function resolvePoi(db: D1Database, p: ResolvablePoi, createdPoiIds: number[]): Promise<number> {
  const found = await db.prepare('SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1').bind(p.name, p.type).first<{ id: number }>();
  if (found && typeof found.id === 'number') return found.id;
  const ins = await db
    .prepare(
      'INSERT OR IGNORE INTO pois (type, name, category, lat, lng, hours, rating, price, address, place_id, source) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id',
    )
    .bind(p.type, p.name, p.category, p.lat, p.lng, p.hours, p.rating, p.price ?? null, p.address, p.placeId, 'imported')
    .first<{ id: number }>();
  if (ins && typeof ins.id === 'number') {
    createdPoiIds.push(ins.id);
    return ins.id;
  }
  // Lost the INSERT-OR-IGNORE race (concurrent insert of same name+type) → re-fetch.
  const ref = await db.prepare('SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1').bind(p.name, p.type).first<{ id: number }>();
  if (!ref || typeof ref.id !== 'number') throw new AppError('SYS_DB_ERROR', 'POI 解析失敗');
  return ref.id;
}

/** Run statements in chunked atomic batches; onResult fires per result as each chunk
 *  commits, so a later chunk's failure still leaves earlier ids tracked. */
export async function runChunked(db: D1Database, stmts: Stmt[], onResult?: (r: D1Result, idx: number) => void): Promise<void> {
  for (let i = 0; i < stmts.length; i += BATCH_CHUNK) {
    const res = await db.batch(stmts.slice(i, i + BATCH_CHUNK));
    if (onResult) res.forEach((r, j) => onResult(r, i + j));
  }
}

/** Best-effort connect-root cleanup of a partially-written trip (chunked). */
export async function rollbackTrip(db: D1Database, tripId: string, entryIds: number[], poiIds: number[]): Promise<void> {
  const stmts: Stmt[] = [];
  for (let i = 0; i < entryIds.length; i += 100) {
    const chunk = entryIds.slice(i, i + 100);
    const ph = chunk.map(() => '?').join(',');
    stmts.push(db.prepare(`DELETE FROM trip_entry_pois WHERE entry_id IN (${ph})`).bind(...chunk));
    stmts.push(db.prepare(`DELETE FROM trip_entries WHERE id IN (${ph})`).bind(...chunk));
  }
  stmts.push(db.prepare('DELETE FROM trip_segments WHERE trip_id = ?').bind(tripId));
  stmts.push(db.prepare('DELETE FROM trip_days WHERE trip_id = ?').bind(tripId));
  for (const t of ['trip_flights', 'trip_lodgings', 'trip_reservations', 'trip_pretrip_notes', 'trip_emergency_contacts', 'trip_destinations', 'trip_docs', 'trip_permissions']) {
    stmts.push(db.prepare(`DELETE FROM ${t} WHERE trip_id = ?`).bind(tripId));
  }
  for (let i = 0; i < poiIds.length; i += 100) {
    const chunk = poiIds.slice(i, i + 100);
    stmts.push(db.prepare(`DELETE FROM pois WHERE id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk));
  }
  stmts.push(db.prepare('DELETE FROM trips WHERE id = ?').bind(tripId));
  await runChunked(db, stmts);
}

/** Enforce the per-user trip cap (anti spam DoS). Throws if at/over the limit. */
export async function assertTripCap(db: D1Database, userId: string): Promise<void> {
  const row = await db.prepare('SELECT COUNT(*) AS cnt FROM trips WHERE owner_user_id = ?').bind(userId).first<{ cnt: number }>();
  if ((row?.cnt ?? 0) >= MAX_TRIPS_PER_USER) {
    throw new AppError('DATA_VALIDATION', `行程數已達上限（${MAX_TRIPS_PER_USER}）`);
  }
}
