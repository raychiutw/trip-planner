import { logAudit } from '../../../_audit';
import { hasPermission } from '../../../_auth';
import { validateDayBody, detectGarbledText } from '../../../_validate';
import { json, getAuth, parseJsonBody } from '../../../_utils';
import type { Env } from '../../../_types';

// ---------------------------------------------------------------------------
// GET /api/trips/:id/days/:num — POI Schema V2 (pois + trip_pois)
// ---------------------------------------------------------------------------

/** Common SELECT for trip_pois JOIN pois — returns merged fields */
const POI_SELECT = 'p.id, p.type, p.name, p.description, p.note, p.address, p.phone, p.email, p.website, p.hours, p.google_rating, p.category, p.maps, p.mapcode, p.lat, p.lng, p.source, tp.id AS trip_poi_id, tp.context, tp.day_id, tp.entry_id, tp.sort_order, tp.description AS tp_description, tp.note AS tp_note, tp.hours AS tp_hours, tp.checkout, tp.breakfast_included, tp.breakfast_note, tp.price, tp.reservation, tp.reservation_url, tp.must_buy';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id, num } = context.params as { id: string; num: string };
  const db = context.env.DB;

  const day = await db
    .prepare('SELECT * FROM trip_days WHERE trip_id = ? AND day_num = ?')
    .bind(id, Number(num))
    .first() as Record<string, unknown> | null;

  if (!day) return json({ error: 'Not found' }, 404);

  const dayId = day.id as number;

  const [entriesResult, hotelPois, parkingPois, allRestPois, allShopPois] = await Promise.all([
    db.prepare('SELECT * FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC').bind(dayId).all(),
    db.prepare(`SELECT ${POI_SELECT} FROM trip_pois tp JOIN pois p ON tp.poi_id = p.id WHERE tp.trip_id = ? AND tp.day_id = ? AND tp.context = 'hotel' AND p.type = 'hotel'`).bind(id, dayId).all(),
    db.prepare(`SELECT ${POI_SELECT} FROM trip_pois tp JOIN pois p ON tp.poi_id = p.id WHERE tp.trip_id = ? AND tp.day_id = ? AND tp.context = 'hotel' AND p.type = 'parking'`).bind(id, dayId).all(),
    db.prepare(`SELECT ${POI_SELECT} FROM trip_pois tp JOIN pois p ON tp.poi_id = p.id WHERE tp.trip_id = ? AND tp.context = 'timeline' AND tp.entry_id IN (SELECT id FROM trip_entries WHERE day_id = ?) ORDER BY tp.entry_id, tp.sort_order`).bind(id, dayId).all(),
    db.prepare(`SELECT ${POI_SELECT} FROM trip_pois tp JOIN pois p ON tp.poi_id = p.id WHERE tp.trip_id = ? AND tp.context = 'shopping' AND tp.entry_id IN (SELECT id FROM trip_entries WHERE day_id = ?) ORDER BY tp.entry_id, tp.sort_order`).bind(id, dayId).all(),
  ]);

  // Build hotel object (at most one per day)
  let hotel: Record<string, unknown> | null = null;
  if (hotelPois.results.length > 0) {
    const h = hotelPois.results[0] as Record<string, unknown>;
    hotel = {
      ...h,
      // Merge overrides: tp_description/tp_note/tp_hours override master
      description: h.tp_description ?? h.description,
      note: h.tp_note ?? h.note,
      hours: h.tp_hours ?? h.hours,
      parking: parkingPois.results.map(p => {
        const pr = p as Record<string, unknown>;
        return { ...pr, description: pr.tp_description ?? pr.description, note: pr.tp_note ?? pr.note };
      }),
    };
  }

  // Group restaurants + shopping by entry_id
  const restByEntry = new Map<number, unknown[]>();
  for (const r of allRestPois.results) {
    const row = r as Record<string, unknown>;
    const eid = row.entry_id as number;
    if (!restByEntry.has(eid)) restByEntry.set(eid, []);
    const merged = { ...row, description: row.tp_description ?? row.description, note: row.tp_note ?? row.note };
    restByEntry.get(eid)!.push(merged);
  }

  const shopByEntry = new Map<number, unknown[]>();
  for (const s of allShopPois.results) {
    const row = s as Record<string, unknown>;
    const eid = row.entry_id as number;
    if (!shopByEntry.has(eid)) shopByEntry.set(eid, []);
    const merged = { ...row, description: row.tp_description ?? row.description, note: row.tp_note ?? row.note };
    shopByEntry.get(eid)!.push(merged);
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
  data: { name: string; type: string; description?: string | null; maps?: string | null; mapcode?: string | null; lat?: number | null; lng?: number | null; google_rating?: number | null; category?: string | null; hours?: string | null; source?: string | null },
): Promise<number> {
  // Try exact match first (E5: dedup key = name + type + maps)
  const existing = await db.prepare(
    'SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1'
  ).bind(data.name, data.type).first<{ id: number }>();

  if (existing) return existing.id;

  // Not found → INSERT
  const result = await db.prepare(
    'INSERT INTO pois (type, name, description, hours, google_rating, category, maps, mapcode, lat, lng, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).bind(
    data.type, data.name, data.description ?? null, data.hours ?? null,
    data.google_rating ?? null, data.category ?? null,
    data.maps ?? null, data.mapcode ?? null,
    data.lat ?? null, data.lng ?? null, data.source ?? 'ai',
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
