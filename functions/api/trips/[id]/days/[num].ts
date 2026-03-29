import { logAudit } from '../../../_audit';
import { hasPermission } from '../../../_auth';
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

  if (!day) return json({ error: 'Not found' }, 404);

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
    const { results: poisRows } = await db.prepare(
      `SELECT * FROM pois WHERE id IN (${poiIds.join(',')})`
    ).all();
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

    return {
      ...entry,
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

/** Find existing pois by (name, type) or INSERT new. Returns poi_id. */
async function findOrCreatePoi(
  db: D1Database,
  data: {
    name: string; type: string; description?: string | null; maps?: string | null;
    mapcode?: string | null; lat?: number | null; lng?: number | null;
    google_rating?: number | null; category?: string | null; hours?: string | null;
    source?: string | null;
    address?: string | null; phone?: string | null; email?: string | null;
    website?: string | null; country?: string | null;
  },
): Promise<number> {
  // Try exact match first (E5: dedup key = name + type)
  const existing = await db.prepare(
    'SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1'
  ).bind(data.name, data.type).first<{ id: number }>();

  if (existing) {
    // COALESCE update: only fill NULL fields, never overwrite existing values
    const fills: string[] = [];
    const vals: unknown[] = [];
    const coalesceFields = [
      ['description', data.description], ['maps', data.maps], ['mapcode', data.mapcode],
      ['lat', data.lat], ['lng', data.lng], ['google_rating', data.google_rating],
      ['category', data.category], ['hours', data.hours],
      ['address', data.address], ['phone', data.phone], ['email', data.email],
      ['website', data.website], ['country', data.country],
    ] as const;
    for (const [col, val] of coalesceFields) {
      if (val != null) {
        fills.push(`${col} = COALESCE(${col}, ?)`);
        vals.push(val);
      }
    }
    if (fills.length > 0) {
      await db.prepare(`UPDATE pois SET ${fills.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
        .bind(...vals, existing.id).run();
    }
    return existing.id;
  }

  // Not found → INSERT with all fields
  const result = await db.prepare(
    'INSERT INTO pois (type, name, description, hours, google_rating, category, maps, mapcode, lat, lng, source, address, phone, email, website, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).bind(
    data.type, data.name, data.description ?? null, data.hours ?? null,
    data.google_rating ?? null, data.category ?? null,
    data.maps ?? null, data.mapcode ?? null,
    data.lat ?? null, data.lng ?? null, data.source ?? 'ai',
    data.address ?? null, data.phone ?? null, data.email ?? null,
    data.website ?? null, data.country ?? 'JP',
  ).first<{ id: number }>();

  return result!.id;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, num } = context.params as { id: string; num: string };
  const changedBy = auth.email;
  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  const day = await db
    .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = ?')
    .bind(id, Number(num))
    .first() as { id: number } | null;

  if (!day) return json({ error: 'Not found' }, 404);
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
  const bodyOrError = await parseJsonBody<DayBody>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  const validation = validateDayBody(body);
  if (!validation.ok) return json({ error: validation.error }, validation.status);

  // Garbled text detection
  const timelineEntries = Array.isArray(body.timeline) ? body.timeline : [];
  for (let i = 0; i < timelineEntries.length; i++) {
    const e = timelineEntries[i];
    for (const f of ['title', 'description', 'note'] as const) {
      const val = e[f];
      if (typeof val === 'string' && detectGarbledText(val)) {
        return json({ error: `timeline[${i}].${f} 包含疑似亂碼` }, 400);
      }
    }
  }

  await logAudit(db, {
    tripId: id, tableName: 'trip_days', recordId: dayId, action: 'update', changedBy,
    snapshot, diffJson: JSON.stringify({ day_num: Number(num), overwrite: true }),
  });

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
      const e = timeline[i];
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
      const rows = batch1Results[ENTRIES_START + i].results as { id: number }[];
      entryIds.push(rows[0]?.id ?? 0);
    }

    // Find-or-create pois + collect trip_pois inserts
    const batch2: D1PreparedStatement[] = [];

    // Hotel
    if (body.hotel) {
      const h = body.hotel;
      const poiId = await findOrCreatePoi(db, {
        name: (h.name as string) || '', type: 'hotel',
        description: h.description as string, maps: h.maps as string,
        lat: h.lat as number, lng: h.lng as number, source: 'ai',
      });
      batch2.push(
        db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, day_id, description, note, hours, checkout, breakfast_included, breakfast_note) VALUES (?, ?, 'hotel', ?, ?, ?, ?, ?, ?, ?)`)
          .bind(poiId, id, dayId,
            h.description as string ?? null, h.note as string ?? null, h.hours as string ?? null,
            h.checkout as string ?? null, h.breakfast_included as number ?? null, h.breakfast_note as string ?? null),
      );

      // Hotel parking POIs
      if (Array.isArray(h.parking)) {
        for (const p of h.parking as Record<string, unknown>[]) {
          const parkPoiId = await findOrCreatePoi(db, {
            name: (p.name as string) || '停車場', type: 'parking',
            description: p.price ? `費用：${p.price}` : null,
            maps: p.maps as string, mapcode: p.mapcode as string,
            lat: p.lat as number, lng: p.lng as number, source: 'ai',
          });
          batch2.push(
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, day_id, description, note) VALUES (?, ?, 'hotel', ?, ?, ?)`)
              .bind(parkPoiId, id, dayId, p.price ? `費用：${p.price}` : null, p.note as string ?? null),
          );
          // poi_relations: hotel → parking
          batch2.push(
            db.prepare(`INSERT OR IGNORE INTO poi_relations (poi_id, related_poi_id, relation_type) VALUES (?, ?, 'parking')`)
              .bind(poiId, parkPoiId),
          );
        }
      }

      // Hotel shopping
      if (Array.isArray(h.shopping)) {
        for (const [idx, s] of (h.shopping as Record<string, unknown>[]).entries()) {
          const shopPoiId = await findOrCreatePoi(db, {
            name: (s.name as string) || '', type: 'shopping',
            google_rating: s.google_rating as number, maps: s.maps as string,
            category: s.category as string, hours: s.hours as string, source: 'ai',
          });
          batch2.push(
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, day_id, sort_order, note, must_buy) VALUES (?, ?, 'shopping', ?, ?, ?, ?)`)
              .bind(shopPoiId, id, dayId, idx, s.note as string ?? null, s.must_buy as string ?? null),
          );
        }
      }
    }

    // Entry restaurants + shopping
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i];
      const entryId = entryIds[i];

      if (Array.isArray(e.restaurants)) {
        for (const [idx, r] of (e.restaurants as Record<string, unknown>[]).entries()) {
          const poiId = await findOrCreatePoi(db, {
            name: (r.name as string) || '', type: 'restaurant',
            description: r.description as string, google_rating: r.google_rating as number,
            maps: r.maps as string, category: r.category as string,
            hours: r.hours as string, source: 'ai',
          });
          batch2.push(
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order, description, note, price, reservation, reservation_url) VALUES (?, ?, 'timeline', ?, ?, ?, ?, ?, ?, ?, ?)`)
              .bind(poiId, id, entryId, dayId, idx,
                r.description as string ?? null, r.note as string ?? null,
                r.price as string ?? null, r.reservation as string ?? null, r.reservation_url as string ?? null),
          );
        }
      }

      if (Array.isArray(e.shopping)) {
        for (const [idx, s] of (e.shopping as Record<string, unknown>[]).entries()) {
          const poiId = await findOrCreatePoi(db, {
            name: (s.name as string) || '', type: 'shopping',
            google_rating: s.google_rating as number, maps: s.maps as string,
            category: s.category as string, hours: s.hours as string, source: 'ai',
          });
          batch2.push(
            db.prepare(`INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order, note, must_buy) VALUES (?, ?, 'shopping', ?, ?, ?, ?, ?)`)
              .bind(poiId, id, entryId, dayId, idx, s.note as string ?? null, s.must_buy as string ?? null),
          );
        }
      }
    }

    if (batch2.length > 0) await db.batch(batch2);
  } catch (err) {
    await logAudit(db, {
      tripId: id, tableName: 'trip_days', recordId: dayId, action: 'update', changedBy,
      diffJson: JSON.stringify({ error: 'Partial write failure', message: err instanceof Error ? err.message : String(err) }),
    });
    return json({ error: '儲存失敗，請稍後再試' }, 500);
  }

  return json({ ok: true });
};
