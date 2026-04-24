import { logAudit } from '../../../_audit';
import { hasPermission } from '../../../_auth';
import { AppError } from '../../../_errors';
import { batchFindOrCreatePois, type FindOrCreatePoiData } from '../../../_poi';
import { validateDayBody, detectGarbledText } from '../../../_validate';
import { json, getAuth, parseJsonBody } from '../../../_utils';
import type { Env } from '../../../_types';
import { assembleDay, fetchPoiMap } from './_merge';

// ---------------------------------------------------------------------------
// GET /api/trips/:id/days/:num — POI Schema (pois + trip_pois)
// ---------------------------------------------------------------------------

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

  const tripPoiRows = allTripPois.results as Record<string, unknown>[];
  const entryRows = entriesResult.results as Record<string, unknown>[];
  const poiMap = await fetchPoiMap(db, tripPoiRows, entryRows);

  const assembled = assembleDay(
    day,
    entryRows,
    tripPoiRows,
    poiMap,
  );

  return json(assembled);
};

// ---------------------------------------------------------------------------
// PUT /api/trips/:id/days/:num — POI Schema (find-or-create pois + trip_pois)
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

  // Phase 2: poi_type 白名單驗證（避免 CHECK 失敗讓 batch 炸在半途）
  const ALLOWED_POI_TYPES = new Set(['hotel', 'restaurant', 'shopping', 'parking', 'attraction', 'transport', 'activity', 'other']);
  for (let i = 0; i < timelineEntries.length; i++) {
    const pt = (timelineEntries[i] as Record<string, unknown>).poi_type;
    if (pt !== undefined && (typeof pt !== 'string' || !ALLOWED_POI_TYPES.has(pt))) {
      throw new AppError('DATA_VALIDATION', `timeline[${i}].poi_type 無效（允許：${[...ALLOWED_POI_TYPES].join(', ')}）`);
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
    // Phase 2: entry-level POI — each timeline entry gets a poi_id FK into pois master.
    // -1 means no POI needed (empty title / placeholder entry).
    const entryPoiIdx: number[] = new Array(timeline.length).fill(-1);

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

    // Entry-level POI (Phase 2)：每個 timeline entry 對應一筆 pois master。
    // type 來自 body.timeline[].poi_type，預設 attraction；機場/車站請傳 transport、預訂體驗請傳 activity。
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i] as Record<string, unknown>;
      const title = typeof e.title === 'string' ? e.title.trim() : '';
      if (!title) continue;
      const rawType = typeof e.poi_type === 'string' ? e.poi_type : 'attraction';
      entryPoiIdx[i] = poiItems.length;
      poiItems.push({
        name: title,
        type: rawType,
        description: (e.description as string | undefined) ?? null,
        maps: (e.maps as string | undefined) ?? null,
        mapcode: (e.mapcode as string | undefined) ?? null,
        lat: (e.lat as number | undefined) ?? null,
        lng: (e.lng as number | undefined) ?? null,
        google_rating: (e.google_rating as number | undefined) ?? null,
        source: 'ai',
      });
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

    // Build batch2: (a) UPDATE trip_entries.poi_id for entries with POI, (b) trip_pois 插入
    const batch2: D1PreparedStatement[] = [];
    for (let i = 0; i < timeline.length; i++) {
      const pIdx = entryPoiIdx[i]!;
      if (pIdx < 0) continue;
      batch2.push(
        db.prepare('UPDATE trip_entries SET poi_id = ? WHERE id = ?')
          .bind(poiIds[pIdx], entryIds[i]!),
      );
    }
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
