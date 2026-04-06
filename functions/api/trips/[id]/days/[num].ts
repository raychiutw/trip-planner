import { logAudit } from '../../../_audit';
import { hasPermission } from '../../../_auth';
import { AppError } from '../../../_errors';
import { batchFindOrCreatePois, type FindOrCreatePoiData } from '../../../_poi';
import { validateDayBody, detectGarbledText } from '../../../_validate';
import { json, getAuth, parseJsonBody } from '../../../_utils';
import type { Env } from '../../../_types';

// ---------------------------------------------------------------------------
// GET /api/trips/:id/days/:num — POI Schema V2 (pois + trip_pois)
// ---------------------------------------------------------------------------

/**
 * Merge a pois row + trip_pois row into a single object.
 * trip_pois fields override pois fields when non-null (COALESCE convention).
 */
function mergePoi(poi: Record<string, unknown>, tp: Record<string, unknown>): Record<string, unknown> {
  return {
    // POI master fields
    poi_id: poi.id,
    type: poi.type,
    name: poi.name,
    description: tp.description ?? poi.description,
    note: tp.note ?? poi.note,
    address: poi.address,
    phone: poi.phone,
    email: poi.email,
    website: poi.website,
    hours: tp.hours ?? poi.hours,
    google_rating: poi.google_rating,
    category: poi.category,
    maps: poi.maps,
    mapcode: poi.mapcode,
    source: poi.source,
    // trip_pois fields
    trip_poi_id: tp.id,
    context: tp.context,
    day_id: tp.day_id,
    entry_id: tp.entry_id,
    sort_order: tp.sort_order,
    // Type-specific (flattened in trip_pois)
    checkout: tp.checkout,
    breakfast_included: tp.breakfast_included,
    breakfast_note: tp.breakfast_note,
    price: tp.price,
    reservation: tp.reservation,
    reservation_url: tp.reservation_url,
    must_buy: tp.must_buy,
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id, num } = context.params as { id: string; num: string };
  const db = context.env.DB;

  const day = await db
    .prepare('SELECT * FROM trip_days WHERE trip_id = ? AND day_num = ?')
    .bind(id, Number(num))
    .first() as Record<string, unknown> | null;

  if (!day) throw new AppError('DATA_NOT_FOUND');

  const dayId = day.id as number;

  // Query trip_pois and pois SEPARATELY to avoid D1 schema cache + JOIN column conflicts
  const [entriesResult, allTripPois] = await Promise.all([
    db.prepare('SELECT * FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC').bind(dayId).all(),
    db.prepare('SELECT * FROM trip_pois WHERE trip_id = ? AND day_id = ?').bind(id, dayId).all(),
  ]);

  // Build poi lookup: poi_id → pois row
  const poiIds = [...new Set((allTripPois.results as Record<string, unknown>[]).map(tp => tp.poi_id as number))];
  const poiMap = new Map<number, Record<string, unknown>>();
  if (poiIds.length > 0) {
    // Query all needed pois in one go
    const placeholders = poiIds.map(() => '?').join(',');
    const { results: poisRows } = await db.prepare(
      `SELECT * FROM pois WHERE id IN (${placeholders})`
    ).bind(...poiIds).all();
    for (const p of poisRows as Record<string, unknown>[]) {
      poiMap.set(p.id as number, p);
    }
  }

  // Merge and categorize trip_pois
  let hotel: Record<string, unknown> | null = null;
  const parkingList: Record<string, unknown>[] = [];
  const restByEntry = new Map<number, unknown[]>();
  const shopByEntry = new Map<number, unknown[]>();

  for (const tp of allTripPois.results as Record<string, unknown>[]) {
    const poi = poiMap.get(tp.poi_id as number);
    if (!poi) continue;
    const merged = mergePoi(poi, tp);
    const poiType = poi.type as string;
    const context = tp.context as string;

    if (context === 'hotel' && poiType === 'hotel' && !hotel) {
      hotel = merged;
    } else if (context === 'hotel' && poiType === 'parking') {
      parkingList.push(merged);
    } else if (context === 'timeline') {
      const eid = tp.entry_id as number;
      if (!restByEntry.has(eid)) restByEntry.set(eid, []);
      restByEntry.get(eid)!.push(merged);
    } else if (context === 'shopping') {
      const eid = tp.entry_id as number;
      if (eid) {
        if (!shopByEntry.has(eid)) shopByEntry.set(eid, []);
        shopByEntry.get(eid)!.push(merged);
      }
    }
  }

  // Attach parking to hotel
  if (hotel) {
    hotel.parking = parkingList;
  }

  const timeline = entriesResult.results.map(e => {
    const entry = e as Record<string, unknown>;
    const eid = entry.id as number;
    const travel = entry.travel_type ? {
      type: entry.travel_type,
      desc: entry.travel_desc,
      min: entry.travel_min,
    } : null;

    let location = entry.location;
    if (typeof location === 'string') {
      try {
        const parsed = JSON.parse(location);
        location = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
      } catch { location = null; }
    }

    return {
      ...entry,
      location,
      travel,
      restaurants: restByEntry.get(eid) ?? [],
      shopping: shopByEntry.get(eid) ?? [],
    };
  });

  return json({
    id: dayId,
    day_num: day.day_num,
    date: day.date,
    day_of_week: day.day_of_week,
    label: day.label,
    hotel,
    timeline,
  });
};

// ---------------------------------------------------------------------------
// PUT /api/trips/:id/days/:num — POI Schema V2 (find-or-create pois + trip_pois)
// ---------------------------------------------------------------------------

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, num } = context.params as { id: string; num: string };
  const changedBy = auth.email;
  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  const day = await db
    .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = ?')
    .bind(id, Number(num))
    .first() as { id: number } | null;

  if (!day) throw new AppError('DATA_NOT_FOUND');
  const dayId = day.id;

  // Snapshot old data for audit
  const [oldTripPois, oldEntries] = await Promise.all([
    db.prepare('SELECT * FROM trip_pois WHERE trip_id = ? AND day_id = ?').bind(id, dayId).all(),
    db.prepare('SELECT * FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC').bind(dayId).all(),
  ]);
  const snapshot = JSON.stringify({ dayId, tripPois: oldTripPois.results, entries: oldEntries.results });

  type DayBody = {
    date?: string;
    dayOfWeek?: string;
    label?: string;
    hotel?: Record<string, unknown> & { shopping?: unknown[]; parking?: unknown[]; description?: unknown };
    timeline?: Array<Record<string, unknown> & { restaurants?: unknown[]; shopping?: unknown[]; travel?: { type?: unknown; desc?: unknown; min?: unknown } }>;
  };
  const body = await parseJsonBody<DayBody>(context.request);

  const validation = validateDayBody(body);
  if (!validation.ok) throw new AppError('DATA_VALIDATION', validation.error);

  // Garbled text detection
  const timelineEntries = Array.isArray(body.timeline) ? body.timeline : [];
  for (let i = 0; i < timelineEntries.length; i++) {
    const e = timelineEntries[i]!;
    for (const f of ['title', 'description', 'note'] as const) {
      const val = e[f as keyof typeof e];
      if (typeof val === 'string' && detectGarbledText(val)) {
        throw new AppError('DATA_ENCODING', `timeline[${i}].${f} 包含疑似亂碼`);
      }
    }
  }

  try {
    // Batch 1: delete old trip_pois + entries, update day, insert entries
    const batch1: D1PreparedStatement[] = [];

    batch1.push(
      db.prepare('DELETE FROM trip_pois WHERE trip_id = ? AND day_id = ?').bind(id, dayId),
      db.prepare('DELETE FROM trip_entries WHERE day_id = ?').bind(dayId),
      db.prepare('UPDATE trip_days SET date = ?, day_of_week = ?, label = ? WHERE id = ?')
        .bind(body.date!, body.dayOfWeek!, body.label!, dayId),
    );

    const timeline = Array.isArray(body.timeline) ? body.timeline : [];
    const ENTRIES_START = batch1.length;
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i]!;
      const travel = e.travel as { type?: unknown; desc?: unknown; min?: unknown } | undefined;
      batch1.push(
        db.prepare('INSERT INTO trip_entries (day_id, sort_order, time, title, description, maps, google_rating, note, travel_type, travel_desc, travel_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
          .bind(dayId, i, e.time ?? null, e.title ?? null, e.description ?? null,
            e.maps ?? null, e.google_rating ?? null, e.note ?? null,
            travel?.type ?? null, travel?.desc ?? null, travel?.min ?? null),
      );
    }

    const batch1Results = await db.batch(batch1);

    const entryIds: number[] = [];
    for (let i = 0; i < timeline.length; i++) {
      const rows = batch1Results[ENTRIES_START + i]!.results as { id: number }[];
      entryIds.push(rows[0]?.id ?? 0);
    }

    // Collect all POI data for batch find-or-create (eliminates N+1 sequential queries)
    type TripPoiBuilder = (poiIds: number[]) => D1PreparedStatement[];
    const poiItems: FindOrCreatePoiData[] = [];
    const tripPoiBuilders: TripPoiBuilder[] = [];
    let hotelPoiIdx = -1;

    // Hotel
    if (body.hotel) {
      const h = body.hotel;
      hotelPoiIdx = poiItems.length;
      poiItems.push({
        name: (h.name as string) || '', type: 'hotel',
        description: h.description as string, maps: h.maps as string,
        lat: h.lat as number, lng: h.lng as number, source: 'ai',
      });
      const hCopy = h; // capture for closure
      tripPoiBuilders.push((ids) => [
        db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, day_id, description, note, hours, checkout, breakfast_included, breakfast_note) VALUES (?, ?, 'hotel', ?, ?, ?, ?, ?, ?, ?)`)
          .bind(ids[hotelPoiIdx], id, dayId,
            hCopy.description as string ?? null, hCopy.note as string ?? null, hCopy.hours as string ?? null,
            hCopy.checkout as string ?? null, hCopy.breakfast_included as number ?? null, hCopy.breakfast_note as string ?? null),
      ]);

      // Hotel parking
      if (Array.isArray(h.parking)) {
        for (const p of h.parking as Record<string, unknown>[]) {
          const parkIdx = poiItems.length;
          poiItems.push({
            name: (p.name as string) || '停車場', type: 'parking',
            description: p.price ? `費用：${p.price}` : null,
            maps: p.maps as string, mapcode: p.mapcode as string,
            lat: p.lat as number, lng: p.lng as number, source: 'ai',
          });
          tripPoiBuilders.push((ids) => [
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, day_id, description, note) VALUES (?, ?, 'hotel', ?, ?, ?)`)
              .bind(ids[parkIdx], id, dayId, p.price ? `費用：${p.price}` : null, p.note as string ?? null),
            db.prepare(`INSERT OR IGNORE INTO poi_relations (poi_id, related_poi_id, relation_type) VALUES (?, ?, 'parking')`)
              .bind(ids[hotelPoiIdx], ids[parkIdx]),
          ]);
        }
      }

      // Hotel shopping
      if (Array.isArray(h.shopping)) {
        for (const [idx, s] of (h.shopping as Record<string, unknown>[]).entries()) {
          const shopIdx = poiItems.length;
          poiItems.push({
            name: (s.name as string) || '', type: 'shopping',
            google_rating: s.google_rating as number, maps: s.maps as string,
            category: s.category as string, hours: s.hours as string, source: 'ai',
          });
          tripPoiBuilders.push((ids) => [
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, day_id, sort_order, note, must_buy) VALUES (?, ?, 'shopping', ?, ?, ?, ?)`)
              .bind(ids[shopIdx], id, dayId, idx, s.note as string ?? null, s.must_buy as string ?? null),
          ]);
        }
      }
    }

    // Entry restaurants + shopping
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i]!;
      const entryId = entryIds[i]!;

      if (Array.isArray(e.restaurants)) {
        for (const [idx, r] of (e.restaurants as Record<string, unknown>[]).entries()) {
          const rIdx = poiItems.length;
          poiItems.push({
            name: (r.name as string) || '', type: 'restaurant',
            description: r.description as string, google_rating: r.google_rating as number,
            maps: r.maps as string, category: r.category as string,
            hours: r.hours as string, source: 'ai',
          });
          tripPoiBuilders.push((ids) => [
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order, description, note, price, reservation, reservation_url) VALUES (?, ?, 'timeline', ?, ?, ?, ?, ?, ?, ?, ?)`)
              .bind(ids[rIdx], id, entryId, dayId, idx,
                r.description as string ?? null, r.note as string ?? null,
                r.price as string ?? null, r.reservation as string ?? null, r.reservation_url as string ?? null),
          ]);
        }
      }

      if (Array.isArray((e as Record<string, unknown>).shopping)) {
        for (const [idx, s] of ((e as Record<string, unknown>).shopping as Record<string, unknown>[]).entries()) {
          const sIdx = poiItems.length;
          poiItems.push({
            name: (s.name as string) || '', type: 'shopping',
            google_rating: s.google_rating as number, maps: s.maps as string,
            category: s.category as string, hours: s.hours as string, source: 'ai',
          });
          tripPoiBuilders.push((ids) => [
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order, note, must_buy) VALUES (?, ?, 'shopping', ?, ?, ?, ?, ?)`)
              .bind(ids[sIdx], id, entryId, dayId, idx, s.note as string ?? null, s.must_buy as string ?? null),
          ]);
        }
      }
    }

    // Batch resolve all POIs (2–3 DB round-trips instead of N)
    const poiIds = await batchFindOrCreatePois(db, poiItems);

    // Build batch2 trip_pois from resolved IDs
    const batch2: D1PreparedStatement[] = [];
    for (const builder of tripPoiBuilders) {
      batch2.push(...builder(poiIds));
    }
    if (batch2.length > 0) await db.batch(batch2);

    // Audit log AFTER both batches succeed (prevents phantom audit entries on failure)
    await logAudit(db, {
      tripId: id, tableName: 'trip_days', recordId: dayId, action: 'update', changedBy,
      snapshot, diffJson: JSON.stringify({ day_num: Number(num), overwrite: true }),
    });
  } catch (err) {
    await logAudit(db, {
      tripId: id, tableName: 'trip_days', recordId: dayId, action: 'error', changedBy,
      diffJson: JSON.stringify({ error: 'Partial write failure', message: err instanceof Error ? err.message : String(err) }),
    });
    throw new AppError('DATA_SAVE_FAILED', '儲存失敗，請稍後再試');
  }

  return json({ ok: true });
};
