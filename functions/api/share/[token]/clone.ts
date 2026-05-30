/**
 * POST /api/share/:token/clone — copy a shared trip into the caller's account (v2.40.0 PR3).
 *
 * Auth REQUIRED (middleware only bypasses GET /api/share/*; POST falls through to auth).
 * Copies the always-public trip BODY (days / entries / POIs / segments) + ONLY the
 * share's VISIBLE note sections (default-deny via parseVisibleSections) — a private
 * section the owner didn't enable can never reach the clone. New trip owned by the
 * caller (data_source='cloned', published=0). POIs find-or-create by UNIQUE(name,type)
 * — never mutates the shared catalog. per-user rate limit + trips cap; connect-root
 * rollback on any failure.
 */
import { requireAuth } from '../../_auth';
import { json } from '../../_utils';
import { AppError } from '../../_errors';
import { resolveActiveShare, parseVisibleSections, type ShareSection } from '../../_share';
import { reqId, resolvePoi, runChunked, rollbackTrip, assertTripCap, TRIP_DOC_TYPES, type ResolvablePoi } from '../../trips/_tripWrite';
import { checkRateLimit, bumpRateLimit, clientIp, RATE_LIMITS } from '../../_rate_limit';
import type { Env } from '../../_types';

type Stmt = D1PreparedStatement;
type Row = Record<string, unknown>;
const rows = (r: { results?: unknown[] } | null): Row[] => (r?.results as Row[]) ?? [];
const poiFrom = (r: Row): ResolvablePoi => ({
  type: String(r.type ?? 'attraction'),
  name: String(r.name ?? ''),
  category: (r.category as string) ?? null,
  lat: (r.lat as number) ?? null,
  lng: (r.lng as number) ?? null,
  hours: (r.hours as string) ?? null,
  rating: (r.rating as number) ?? null,
  price: (r.price as string) ?? null,
  address: (r.address as string) ?? null,
  placeId: (r.place_id as string) ?? null,
});

function notFound(): Response {
  return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  if (!auth.userId) throw new AppError('AUTH_REQUIRED', '需登入才能複製行程');
  const { token } = context.params as { token: string };
  const db = context.env.DB;

  const share = await resolveActiveShare(db, token);
  if (!share) return notFound(); // unknown / revoked / expired — uniform 404

  // Rate limit: per-IP pre-gate (defence-in-depth) + per-user, then absolute trip cap.
  // Count the ATTEMPT up-front (await, not fire-and-forget) — a failing clone still burns
  // hundreds of D1 subrequests, and concurrent requests serialize against a committed count.
  const ipBucket = `clone:ip:${clientIp(context.request)}`;
  const ipRl = await checkRateLimit(db, ipBucket, RATE_LIMITS.CLONE_PER_IP);
  if (!ipRl.ok) {
    return new Response(JSON.stringify({ error: 'RATE_LIMIT' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(ipRl.retryAfter ?? 3600) },
    });
  }
  const bucket = `clone:user:${auth.userId}`;
  const rl = await checkRateLimit(db, bucket, RATE_LIMITS.CLONE_PER_USER);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: 'RATE_LIMIT' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter ?? 3600) },
    });
  }
  await bumpRateLimit(db, ipBucket, RATE_LIMITS.CLONE_PER_IP);
  await bumpRateLimit(db, bucket, RATE_LIMITS.CLONE_PER_USER);
  await assertTripCap(db, auth.userId);

  const src = share.trip_id;
  const visible = parseVisibleSections(share.visible_sections);
  const wants = (s: ShareSection) => visible.includes(s);
  const noteRead = (table: string, on: boolean) =>
    on ? db.prepare(`SELECT * FROM ${table} WHERE trip_id = ? ORDER BY sort_order ASC, id ASC`).bind(src).all() : Promise.resolve(null);

  // Read the source: trip meta + body (always-public) + ONLY the visible note tables.
  const [trip, destsR, daysR, entriesR, epR, hotelsR, segsR, flightsR, lodgingsR, resvR, pretripR, emergR] = await Promise.all([
    db.prepare('SELECT name, title, description, countries, lang FROM trips WHERE id = ?').bind(src)
      .first<{ name: string | null; title: string | null; description: string | null; countries: string | null; lang: string | null }>(),
    db.prepare('SELECT name, lat, lng, day_quota, sub_areas FROM trip_destinations WHERE trip_id = ? ORDER BY dest_order ASC').bind(src).all(),
    db.prepare('SELECT id, day_num, date, day_of_week, label, title FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC').bind(src).all(),
    db.prepare('SELECT e.id, e.day_id, e.sort_order, e.start_time, e.end_time, e.title, e.description, e.source, e.note FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ? ORDER BY e.day_id ASC, e.sort_order ASC').bind(src).all(),
    db.prepare('SELECT tep.entry_id, tep.sort_order, tep.description, tep.note, tep.reservation, tep.reservation_url, p.type, p.name, p.category, p.lat, p.lng, p.hours, p.rating, p.price, p.address, p.place_id FROM trip_entry_pois tep JOIN pois p ON p.id = tep.poi_id JOIN trip_entries e ON e.id = tep.entry_id JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ? ORDER BY tep.entry_id ASC, tep.sort_order ASC').bind(src).all(),
    db.prepare('SELECT td.id AS day_id, p.type, p.name, p.category, p.lat, p.lng, p.hours, p.rating, p.price, p.address, p.place_id FROM trip_days td JOIN pois p ON p.id = td.hotel_poi_id WHERE td.trip_id = ?').bind(src).all(),
    db.prepare('SELECT from_entry_id, to_entry_id, mode, min, distance_m, source FROM trip_segments WHERE trip_id = ?').bind(src).all(),
    noteRead('trip_flights', wants('flights')),
    noteRead('trip_lodgings', wants('lodgings')),
    noteRead('trip_reservations', wants('reservations')),
    noteRead('trip_pretrip_notes', wants('pretrip')),
    noteRead('trip_emergency_contacts', wants('emergency')),
  ]);
  if (!trip) return notFound();

  const tripId = `cln-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const createdEntryIds: number[] = [];
  const createdPoiIds: number[] = [];

  // Map a note row to its INSERT (content columns only — never id / trip_id / timestamps).
  function noteStmts(): Stmt[] {
    const out: Stmt[] = [];
    rows(flightsR).forEach((f, i) => out.push(db.prepare('INSERT INTO trip_flights (trip_id, sort_order, airline, flight_no, cabin_class, depart_airport, arrive_airport, depart_at, arrive_at, note) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(tripId, i, f.airline, f.flight_no, f.cabin_class, f.depart_airport, f.arrive_airport, f.depart_at, f.arrive_at, f.note)));
    rows(lodgingsR).forEach((l, i) => out.push(db.prepare('INSERT INTO trip_lodgings (trip_id, sort_order, name, address, check_in_at, check_out_at, booking_no, phone, note) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(tripId, i, l.name, l.address, l.check_in_at, l.check_out_at, l.booking_no, l.phone, l.note)));
    rows(resvR).forEach((r, i) => out.push(db.prepare('INSERT INTO trip_reservations (trip_id, sort_order, kind, title, reserved_at, party_size, reservation_no, phone, note) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(tripId, i, r.kind, r.title, r.reserved_at, r.party_size, r.reservation_no, r.phone, r.note)));
    rows(pretripR).forEach((p, i) => out.push(db.prepare('INSERT INTO trip_pretrip_notes (trip_id, sort_order, section, title, content, ai_generated, ai_source) VALUES (?,?,?,?,?,?,?)')
      .bind(tripId, i, p.section, p.title, p.content, p.ai_generated ?? 0, p.ai_source ?? null)));
    rows(emergR).forEach((c, i) => out.push(db.prepare('INSERT INTO trip_emergency_contacts (trip_id, sort_order, name, relationship, phone, email, kind, ai_generated) VALUES (?,?,?,?,?,?,?,?)')
      .bind(tripId, i, c.name, c.relationship, c.phone, c.email, c.kind ?? 'other', c.ai_generated ?? 0)));
    return out;
  }

  try {
    // ---- Batch A: trip + permissions + destinations + doc stubs + visible notes ----
    await runChunked(db, [
      db.prepare('INSERT INTO trips (id, name, owner_user_id, title, description, countries, published, data_source, lang) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(tripId, trip.name ?? '未命名行程', auth.userId, trip.title, trip.description, trip.countries ?? 'JP', 0, 'cloned', trip.lang ?? 'zh-TW'),
      db.prepare('INSERT INTO trip_permissions (user_id, trip_id, role) VALUES (?,?,?)').bind(auth.userId, tripId, 'owner'),
      ...rows(destsR).map((d, i) => db.prepare('INSERT INTO trip_destinations (trip_id, dest_order, name, lat, lng, day_quota, sub_areas) VALUES (?,?,?,?,?,?,?)')
        .bind(tripId, i + 1, d.name, d.lat, d.lng, d.day_quota ?? 0, d.sub_areas ?? null)),
      ...TRIP_DOC_TYPES.map((dt) => db.prepare('INSERT INTO trip_docs (trip_id, doc_type, title) VALUES (?,?,?)').bind(tripId, dt, '')),
      ...noteStmts(),
    ]);

    // ---- Batch B: days RETURNING id → map old day id → new day id ----
    const srcDays = rows(daysR);
    const dayIdMap = new Map<number, number>();
    await runChunked(
      db,
      srcDays.map((d) => db.prepare('INSERT INTO trip_days (trip_id, day_num, date, day_of_week, label, title) VALUES (?,?,?,?,?,?) RETURNING id')
        .bind(tripId, d.day_num, d.date, d.day_of_week, d.label, d.title)),
      (r, idx) => dayIdMap.set(srcDays[idx]!.id as number, reqId(r, '複製寫入失敗')),
    );

    // ---- Batch C: entries RETURNING id → map old entry id → new entry id ----
    const srcEntries = rows(entriesR);
    const poiCountByEntry = new Map<number, number>();
    for (const ep of rows(epR)) poiCountByEntry.set(ep.entry_id as number, (poiCountByEntry.get(ep.entry_id as number) ?? 0) + 1);
    const entryIdMap = new Map<number, number>();
    await runChunked(
      db,
      srcEntries.map((e) => {
        const newDayId = dayIdMap.get(e.day_id as number);
        if (newDayId === undefined) throw new AppError('SYS_DB_ERROR', '複製寫入失敗（entry 缺 day 關聯）');
        return db.prepare('INSERT INTO trip_entries (day_id, sort_order, start_time, end_time, title, description, source, note, entry_pois_version) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id')
          .bind(newDayId, e.sort_order, e.start_time, e.end_time, e.title, e.description, e.source, e.note, (poiCountByEntry.get(e.id as number) ?? 0) > 0 ? 1 : 0);
      }),
      (r, idx) => {
        const id = reqId(r, '複製寫入失敗');
        createdEntryIds.push(id);
        entryIdMap.set(srcEntries[idx]!.id as number, id);
      },
    );

    // ---- entry POIs (find-or-create) + hotels + segments ----
    const tail: Stmt[] = [];
    const seenByEntry = new Map<number, Set<number>>();
    const soByEntry = new Map<number, number>();
    for (const ep of rows(epR)) {
      const newEntryId = entryIdMap.get(ep.entry_id as number);
      if (newEntryId === undefined) continue;
      const poiId = await resolvePoi(db, poiFrom(ep), createdPoiIds);
      const seen = seenByEntry.get(newEntryId) ?? new Set<number>();
      if (seen.has(poiId)) continue; // UNIQUE(entry_id, poi_id)
      seen.add(poiId);
      seenByEntry.set(newEntryId, seen);
      const so = (soByEntry.get(newEntryId) ?? 0) + 1;
      soByEntry.set(newEntryId, so);
      tail.push(db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, description, note, reservation, reservation_url, added_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(newEntryId, poiId, so, ep.description, ep.note, ep.reservation, ep.reservation_url, now, now));
    }
    for (const h of rows(hotelsR)) {
      const newDayId = dayIdMap.get(h.day_id as number);
      if (newDayId === undefined) continue;
      const poiId = await resolvePoi(db, poiFrom(h), createdPoiIds);
      tail.push(db.prepare('UPDATE trip_days SET hotel_poi_id = ? WHERE id = ?').bind(poiId, newDayId));
    }
    for (const s of rows(segsR)) {
      const from = entryIdMap.get(s.from_entry_id as number);
      const to = entryIdMap.get(s.to_entry_id as number);
      if (from === undefined || to === undefined) continue;
      tail.push(db.prepare('INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, version) VALUES (?,?,?,?,?,?,?,?,0)')
        .bind(tripId, from, to, s.mode, s.min, s.distance_m, s.source, s.source === 'google' ? Date.now() : null));
    }
    await runChunked(db, tail);

    return json({ ok: true, tripId, daysCreated: srcDays.length }, 201);
  } catch (err) {
    try {
      await rollbackTrip(db, tripId, createdEntryIds, createdPoiIds);
    } catch (rbErr) {
      console.error('[share/clone] ROLLBACK FAILED — possible orphaned data', { tripId, rbErr });
    }
    if (err instanceof AppError) throw err;
    console.error('[share/clone] failed, rolled back', { tripId, err });
    throw new AppError('SYS_DB_ERROR', '複製失敗，請稍後重試');
  }
};
