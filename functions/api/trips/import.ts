/**
 * POST /api/trips/import — create a NEW trip from an exported v1 JSON file.
 *
 * Security: body is attacker-controlled. We enforce the real body size (read
 * text, cap, then parse — never trust Content-Length), run the pure validator
 * (_import.ts: allowlist reads, enum coercion, array + TOTAL caps, sort_order
 * renumber, segment dedup, prototype-pollution rejection), cap trips-per-user,
 * then build only parameterized statements.
 *
 * D1 has no interactive transaction and db.batch() can't feed a generated id
 * into a later statement, AND has a ~100-statement-per-batch limit — so we run
 * CHUNKED sequential batches with INSERT…RETURNING id, tracking created ids as
 * we go, and roll back by deleting everything keyed to the new trip on any
 * failure. Import always CREATES fresh pois (never touches the shared catalog).
 *
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-101432.md (PR3)
 */
import type { Env } from '../_types';
import { requireAuth } from '../_auth';
import { json } from '../_utils';
import { AppError } from '../_errors';
import { parseAndValidateImport, MAX_IMPORT_BYTES, type NImportNotes } from './_import';

const TRIP_DOC_TYPES = ['flights', 'checklist', 'backup', 'emergency', 'suggestions'];
const BATCH_CHUNK = 50; // stay well under D1's ~100-statement-per-batch limit
const MAX_TRIPS_PER_USER = 1000;

type Stmt = D1PreparedStatement;

/** Extract the RETURNING id; a missing id means the INSERT silently failed. */
function reqId(r: D1Result): number {
  const id = (r.results?.[0] as { id?: number } | undefined)?.id;
  if (typeof id !== 'number' || id <= 0) throw new AppError('SYS_DB_ERROR', '匯入寫入失敗');
  return id;
}

/** Run statements in chunked atomic batches; onResult fires per result as each
 *  chunk commits, so a later chunk's failure still leaves earlier ids tracked. */
async function runChunked(db: D1Database, stmts: Stmt[], onResult?: (r: D1Result, idx: number) => void): Promise<void> {
  for (let i = 0; i < stmts.length; i += BATCH_CHUNK) {
    const res = await db.batch(stmts.slice(i, i + BATCH_CHUNK));
    if (onResult) res.forEach((r, j) => onResult(r, i + j));
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  if (!auth.userId) throw new AppError('AUTH_REQUIRED', '需 V2 OAuth 登入才能匯入行程');

  // Enforce the REAL body size (Content-Length is attacker-controllable / may be
  // absent) — read the text, cap, then parse.
  const text = await context.request.text();
  if (text.length > MAX_IMPORT_BYTES) {
    throw new AppError('DATA_VALIDATION', `匯入檔過大（上限 ${Math.floor(MAX_IMPORT_BYTES / 1024)}KB）`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError('DATA_VALIDATION', '不是有效的 JSON');
  }

  const result = parseAndValidateImport(raw);
  if (!result.ok) throw new AppError('DATA_VALIDATION', result.error);
  const data = result.data;

  const db = context.env.DB;

  // Cap trips-per-user (anti import-spam DoS).
  const countRow = await db.prepare('SELECT COUNT(*) AS cnt FROM trips WHERE owner_user_id = ?')
    .bind(auth.userId).first<{ cnt: number }>();
  if ((countRow?.cnt ?? 0) >= MAX_TRIPS_PER_USER) {
    throw new AppError('DATA_VALIDATION', `行程數已達上限（${MAX_TRIPS_PER_USER}）`);
  }

  const tripId = `imp-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const createdEntryIds: number[] = [];
  const createdPoiIds: number[] = [];

  try {
    // ---- Batch A: trip + permissions + destinations + doc stubs + notes ----
    await runChunked(db, [
      db.prepare('INSERT INTO trips (id, name, owner_user_id, title, description, countries, published, data_source, lang) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(tripId, data.name, auth.userId, data.title, data.description, data.countries ?? 'JP', 0, 'imported', data.lang),
      db.prepare('INSERT INTO trip_permissions (user_id, trip_id, role) VALUES (?,?,?)').bind(auth.userId, tripId, 'owner'),
      ...data.destinations.map((d, i) =>
        db.prepare('INSERT INTO trip_destinations (trip_id, dest_order, name, lat, lng, day_quota, sub_areas) VALUES (?,?,?,?,?,?,?)')
          .bind(tripId, i + 1, d.name, d.lat, d.lng, d.dayQuota, d.subAreas ? JSON.stringify(d.subAreas) : null)),
      ...TRIP_DOC_TYPES.map((dt) => db.prepare('INSERT INTO trip_docs (trip_id, doc_type, title) VALUES (?,?,?)').bind(tripId, dt, '')),
      ...noteStatements(db, tripId, data.notes),
    ]);

    // ---- Batch B: days RETURNING id ----
    const dayIds: number[] = [];
    await runChunked(db, data.days.map((d, i) =>
      db.prepare('INSERT INTO trip_days (trip_id, day_num, date, day_of_week, label, title) VALUES (?,?,?,?,?,?) RETURNING id')
        .bind(tripId, d.dayNum || i + 1, d.date, d.dayOfWeek, d.label, d.title)),
      (r) => dayIds.push(reqId(r)));

    // ---- Batch C: entries RETURNING id; build entryPosition → new id ----
    const entryStmts: Stmt[] = [];
    const entryPositions: number[] = [];
    data.days.forEach((d, di) => {
      for (const e of d.entries) {
        entryStmts.push(
          db.prepare('INSERT INTO trip_entries (day_id, sort_order, start_time, end_time, title, description, source, note, entry_pois_version) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id')
            .bind(dayIds[di], e.sortOrder, e.startTime, e.endTime, e.title, e.description, e.source, e.note, e.pois.length > 0 ? 1 : 0));
        entryPositions.push(e.entryPosition);
      }
    });
    const posToEntryId = new Map<number, number>();
    await runChunked(db, entryStmts, (r, idx) => {
      const id = reqId(r);
      createdEntryIds.push(id);
      posToEntryId.set(entryPositions[idx]!, id);
    });

    // ---- Batch D: pois (stop POIs + hotels) RETURNING id ----
    const poiStmts: Stmt[] = [];
    const poiTargets: ({ kind: 'entry'; entryId: number; poi: { sortOrder: number; description: string | null; note: string | null; reservation: string | null; reservationUrl: string | null } } | { kind: 'hotel'; dayId: number })[] = [];
    data.days.forEach((d, di) => {
      for (const e of d.entries) {
        const entryId = posToEntryId.get(e.entryPosition);
        if (entryId === undefined) continue;
        for (const p of e.pois) {
          poiStmts.push(db.prepare(
            'INSERT INTO pois (type, name, category, lat, lng, hours, rating, address, place_id, source) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id',
          ).bind(p.type, p.name, p.category, p.lat, p.lng, p.hours, p.rating, p.address, p.placeId, 'imported'));
          poiTargets.push({ kind: 'entry', entryId, poi: { sortOrder: p.sortOrder, description: p.description, note: p.note, reservation: p.reservation, reservationUrl: p.reservationUrl } });
        }
      }
      if (d.hotel) {
        const h = d.hotel;
        poiStmts.push(db.prepare(
          'INSERT INTO pois (type, name, category, lat, lng, hours, rating, address, place_id, note, source) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id',
        ).bind('hotel', h.name, h.category, h.lat, h.lng, h.hours, h.rating, h.address, h.placeId, h.note, 'imported'));
        poiTargets.push({ kind: 'hotel', dayId: dayIds[di]! });
      }
    });
    const poiIds: number[] = [];
    await runChunked(db, poiStmts, (r) => { const id = reqId(r); poiIds.push(id); createdPoiIds.push(id); });

    // ---- Batch E: entry↔poi links (with trip-specific overrides) + hotel links + segments ----
    const E: Stmt[] = [];
    poiTargets.forEach((t, idx) => {
      const poiId = poiIds[idx];
      if (poiId === undefined) return;
      if (t.kind === 'entry') {
        E.push(db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, description, note, reservation, reservation_url, added_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(t.entryId, poiId, t.poi.sortOrder, t.poi.description, t.poi.note, t.poi.reservation, t.poi.reservationUrl, now, now));
      } else {
        E.push(db.prepare('UPDATE trip_days SET hotel_poi_id = ? WHERE id = ?').bind(poiId, t.dayId));
      }
    });
    for (const s of data.segments) {
      const from = posToEntryId.get(s.fromEntryIdx);
      const to = posToEntryId.get(s.toEntryIdx);
      if (from === undefined || to === undefined) continue;
      E.push(db.prepare('INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, version) VALUES (?,?,?,?,?,?,?,?,0)')
        .bind(tripId, from, to, s.mode, s.min, s.distanceM, s.source, s.source === 'google' ? Date.now() : null));
    }
    await runChunked(db, E);

    return json({ ok: true, tripId, daysCreated: data.days.length }, 201);
  } catch (err) {
    try {
      await rollback(db, tripId, createdEntryIds, createdPoiIds);
    } catch (rbErr) {
      // Rollback itself failed → orphaned rows may remain. Surface loudly.
      console.error('[import] ROLLBACK FAILED — possible orphaned data', { tripId, rbErr });
    }
    if (err instanceof AppError) throw err;
    console.error('[import] failed, rolled back', { tripId, err });
    throw new AppError('SYS_DB_ERROR', '匯入失敗，請稍後重試');
  }
};

/** Best-effort connect-root cleanup of a partially-imported trip (chunked). */
async function rollback(db: D1Database, tripId: string, entryIds: number[], poiIds: number[]): Promise<void> {
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

function noteStatements(db: D1Database, tripId: string, n: NImportNotes): Stmt[] {
  const out: Stmt[] = [];
  for (const f of n.flights) {
    out.push(db.prepare('INSERT INTO trip_flights (trip_id, sort_order, airline, flight_no, cabin_class, depart_airport, arrive_airport, depart_at, arrive_at, note) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(tripId, f.sort_order, f.airline, f.flight_no, f.cabin_class, f.depart_airport, f.arrive_airport, f.depart_at, f.arrive_at, f.note));
  }
  for (const l of n.lodgings) {
    out.push(db.prepare('INSERT INTO trip_lodgings (trip_id, sort_order, name, address, check_in_at, check_out_at, booking_no, phone, note) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(tripId, l.sort_order, l.name, l.address, l.check_in_at, l.check_out_at, l.booking_no, l.phone, l.note));
  }
  for (const r of n.reservations) {
    out.push(db.prepare('INSERT INTO trip_reservations (trip_id, sort_order, kind, title, reserved_at, party_size, reservation_no, phone, note) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(tripId, r.sort_order, r.kind, r.title, r.reserved_at, r.party_size, r.reservation_no, r.phone, r.note));
  }
  for (const p of n.pretripNotes) {
    out.push(db.prepare('INSERT INTO trip_pretrip_notes (trip_id, sort_order, section, title, content) VALUES (?,?,?,?,?)')
      .bind(tripId, p.sort_order, p.section, p.title, p.content));
  }
  for (const c of n.emergencyContacts) {
    out.push(db.prepare('INSERT INTO trip_emergency_contacts (trip_id, sort_order, name, relationship, phone, email, kind) VALUES (?,?,?,?,?,?,?)')
      .bind(tripId, c.sort_order, c.name, c.relationship, c.phone, c.email, c.kind));
  }
  return out;
}
