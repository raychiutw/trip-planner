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
import { requireAuth, assertNotTripRestricted } from '../_auth';
import { json } from '../_utils';
import { AppError } from '../_errors';
import { parseAndValidateImport, MAX_IMPORT_BYTES, type NImportNotes } from './_import';
import { reqId, runChunked, rollbackTrip, assertTripCap, generateUniqueTripId } from './_tripWrite';
import { findOrCreatePoi } from '../_poi';
import { createEntriesBatch, type BatchEntrySpec } from '../_entryWrite';

type Stmt = D1PreparedStatement;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  // v2.55.56: 受限 token 只做單一 trip 內容編輯 — 不可匯入（建立新 trip）。
  assertNotTripRestricted(auth);
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
  await assertTripCap(db, auth.userId);

  const tripId = await generateUniqueTripId(db, data.name);
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
      ...noteStatements(db, tripId, data.notes),
    ]);

    // ---- Batch B: days RETURNING id ----
    const dayIds: number[] = [];
    await runChunked(db, data.days.map((d, i) =>
      db.prepare('INSERT INTO trip_days (trip_id, day_num, date, day_of_week, label) VALUES (?,?,?,?,?) RETURNING id')
        .bind(tripId, d.dayNum || i + 1, d.date, d.dayOfWeek, d.label)),
      (r) => dayIds.push(reqId(r)));

    // ---- Batch C: entries RETURNING id; build entryPosition → new id ----
    // ---- POIs 先批次 resolve（policy=fill-null，spec #1255 / #1258 owner 2026-09-05 拍板：
    // 撞既有 pois 只補 NULL 欄、不覆蓋非 NULL；新建記 createdPoiIds 供 rollback；
    // source='imported'、country 不猜）。逐 POI sequential 是 UNIQUE(name,type)
    // SELECT→INSERT OR IGNORE 無法 batch 的既有限制。----
    const resolve = (p: { type: string; name: string; category: string | null; lat: number | null; lng: number | null; hours: string | null; rating: number | null; price?: string | null; address: string | null; placeId: string | null }) =>
      findOrCreatePoi(db, {
        type: p.type, name: p.name, category: p.category, lat: p.lat, lng: p.lng, hours: p.hours,
        rating: p.rating, price: p.price ?? null, address: p.address, place_id: p.placeId,
        source: 'imported', country: null,
      }, { policy: 'fill-null', createdPoiIds });

    // ---- entries：#1258 走 entry intake 批次入口（正選/備選、去重、version、每筆 audit）----
    const specs: BatchEntrySpec[] = [];
    const entryPositions: number[] = [];
    for (let di = 0; di < data.days.length; di++) {
      const d = data.days[di]!;
      for (const e of d.entries) {
        const pois: BatchEntrySpec['pois'] = [];
        for (const p of e.pois) {
          const poiId = await resolve(p);
          // migration 0078: entry-level note → master note 的 coalesce 已在 _import.ts 解析時
          // 做完（master-wins），這裡只照 p.note 寫。
          pois.push({ poiId, description: p.description, note: p.note, reservation: p.reservation, reservationUrl: p.reservationUrl });
        }
        specs.push({ dayId: dayIds[di]!, sortOrder: e.sortOrder, startTime: e.startTime, endTime: e.endTime, description: e.description, source: e.source, pois });
        entryPositions.push(e.entryPosition);
      }
    }
    const posToEntryId = new Map<number, number>();
    await createEntriesBatch(db, specs, {
      audit: { tripId, changedBy: auth.email || auth.userId, diff: { via: 'import' } },
      onEntryId: (id, idx) => {
        createdEntryIds.push(id);
        posToEntryId.set(entryPositions[idx]!, id);
      },
    });

    const E: Stmt[] = [];
    for (let di = 0; di < data.days.length; di++) {
      const d = data.days[di]!;
      if (d.hotel) {
        const poiId = await resolve(d.hotel);
        E.push(db.prepare('UPDATE trip_days SET hotel_poi_id = ? WHERE id = ?').bind(poiId, dayIds[di]!));
      }
    }
    for (const s of data.segments) {
      const from = posToEntryId.get(s.fromEntryIdx);
      const to = posToEntryId.get(s.toEntryIdx);
      if (from === undefined || to === undefined) continue;
      E.push(db.prepare('INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, submode, min, distance_m, source, computed_at, version, no_travel) VALUES (?,?,?,?,?,?,?,?,?,0,?)')
        .bind(tripId, from, to, s.mode, s.submode, s.min, s.distanceM, s.source, s.source === 'google' ? Date.now() : null, s.noTravel ?? null));
    }
    await runChunked(db, E);

    return json({ ok: true, tripId, daysCreated: data.days.length }, 201);
  } catch (err) {
    try {
      await rollbackTrip(db, tripId, createdEntryIds, createdPoiIds);
    } catch (rbErr) {
      // Rollback itself failed → orphaned rows may remain. Surface loudly.
      console.error('[import] ROLLBACK FAILED — possible orphaned data', { tripId, rbErr });
    }
    if (err instanceof AppError) throw err;
    console.error('[import] failed, rolled back', { tripId, err });
    throw new AppError('SYS_DB_ERROR', '匯入失敗，請稍後重試');
  }
};

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
