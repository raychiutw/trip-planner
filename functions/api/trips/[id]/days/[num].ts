import { logAudit } from '../../../_audit';
import { hasPermission } from '../../../_auth';
import { validateDayBody, detectGarbledText } from '../../../_validate';
import { json } from '../../../_utils';
import type { Env } from '../../../_types';

function parseJsonField(row: Record<string, unknown>, field: string) {
  if (row[field] && typeof row[field] === 'string') {
    try { row[field] = JSON.parse(row[field] as string); } catch { /* leave as-is */ }
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id, num } = context.params as { id: string; num: string };
  const db = context.env.DB;

  // 1. Fetch the day row
  const day = await db
    .prepare('SELECT * FROM days WHERE trip_id = ? AND day_num = ?')
    .bind(id, Number(num))
    .first() as Record<string, unknown> | null;

  if (!day) return json({ error: 'Not found' }, 404);

  parseJsonField(day, 'weather_json');

  const dayId = day.id as number;

  // 2. Fetch hotel, entries, restaurants, shopping in parallel
  const [hotelResult, entriesResult, allRestaurantsResult, allShoppingResult] = await Promise.all([
    db.prepare('SELECT * FROM hotels WHERE day_id = ?').bind(dayId).first() as Promise<Record<string, unknown> | null>,
    db.prepare('SELECT * FROM entries WHERE day_id = ? ORDER BY sort_order ASC').bind(dayId).all(),
    db.prepare("SELECT * FROM restaurants WHERE entry_id IN (SELECT id FROM entries WHERE day_id = ?)").bind(dayId).all(),
    db.prepare("SELECT * FROM shopping WHERE parent_id IN (SELECT id FROM entries WHERE day_id = ?) AND parent_type = 'entry'").bind(dayId).all(),
  ]);

  // 3. Hotel shopping + parking
  let hotel: Record<string, unknown> | null = null;
  if (hotelResult) {
    const hotelRow = hotelResult as Record<string, unknown>;
    parseJsonField(hotelRow, 'parking_json');

    const hotelId = hotelRow.id as number;
    const { results: hotelShopping } = await db
      .prepare("SELECT * FROM shopping WHERE parent_type = 'hotel' AND parent_id = ?")
      .bind(hotelId)
      .all();

    hotel = { ...hotelRow, shopping: hotelShopping };
  }

  // 4. Group restaurants and shopping by entry_id
  const restaurantsByEntry = new Map<number, unknown[]>();
  for (const r of allRestaurantsResult.results) {
    const row = r as Record<string, unknown>;
    const eid = row.entry_id as number;
    if (!restaurantsByEntry.has(eid)) restaurantsByEntry.set(eid, []);
    restaurantsByEntry.get(eid)!.push(r);
  }

  const shoppingByEntry = new Map<number, unknown[]>();
  for (const s of allShoppingResult.results) {
    const row = s as Record<string, unknown>;
    const eid = row.parent_id as number;
    if (!shoppingByEntry.has(eid)) shoppingByEntry.set(eid, []);
    shoppingByEntry.get(eid)!.push(s);
  }

  // 5. Build timeline
  const timeline = entriesResult.results.map(e => {
    const entry = e as Record<string, unknown>;
    parseJsonField(entry, 'location_json');

    const eid = entry.id as number;
    // Assemble travel object from separate columns
    const travel = entry.travel_type ? {
      type: entry.travel_type,
      desc: entry.travel_desc,
      min: entry.travel_min,
    } : null;

    return {
      ...entry,
      travel,
      restaurants: restaurantsByEntry.get(eid) ?? [],
      shopping: shoppingByEntry.get(eid) ?? [],
    };
  });

  // 6. Assemble response
  return json({
    id: dayId,
    day_num: day.day_num,
    date: day.date,
    day_of_week: day.day_of_week,
    label: day.label,
    weather: day.weather_json,
    hotel,
    timeline,
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return json({ error: '未認證' }, 401);

  const { id, num } = context.params as { id: string; num: string };
  const changedBy = auth?.email || 'anonymous';
  const db = context.env.DB;

  const day = await db
    .prepare('SELECT id FROM days WHERE trip_id = ? AND day_num = ?')
    .bind(id, Number(num))
    .first() as { id: number } | null;

  if (!day) return json({ error: 'Not found' }, 404);

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    return json({ error: '權限不足' }, 403);
  }

  const dayId = day.id;

  // Snapshot old data for recovery in case of partial failure
  const [oldHotel, oldEntries] = await Promise.all([
    db.prepare('SELECT * FROM hotels WHERE day_id = ?').bind(dayId).first(),
    db.prepare('SELECT * FROM entries WHERE day_id = ? ORDER BY sort_order ASC').bind(dayId).all(),
  ]);

  // 查詢所有 restaurants（透過 entries）
  const oldRestaurants = await db.prepare(
    'SELECT r.* FROM restaurants r JOIN entries e ON r.entry_id = e.id WHERE e.day_id = ?'
  ).bind(dayId).all();

  // 查詢所有 entry shopping
  const oldEntryShopping = await db.prepare(
    "SELECT s.* FROM shopping s JOIN entries e ON s.parent_id = e.id WHERE s.parent_type = 'entry' AND e.day_id = ?"
  ).bind(dayId).all();

  // 查詢 hotel shopping
  const oldHotelShopping = oldHotel ? await db.prepare(
    "SELECT * FROM shopping WHERE parent_type = 'hotel' AND parent_id = ?"
  ).bind((oldHotel as { id: number }).id).all() : { results: [] };

  const snapshot = JSON.stringify({
    dayId, hotel: oldHotel, entries: oldEntries.results,
    restaurants: oldRestaurants.results,
    entryShopping: oldEntryShopping.results,
    hotelShopping: oldHotelShopping.results,
  });

  let body: {
    date?: string;
    dayOfWeek?: string;
    label?: string;
    weather?: unknown;
    hotel?: Record<string, unknown> & { shopping?: unknown[]; parking?: unknown; details?: unknown; address?: unknown; breakfast?: unknown };
    timeline?: Array<Record<string, unknown> & { restaurants?: unknown[]; shopping?: unknown[]; travel?: { type?: unknown; desc?: unknown; min?: unknown } }>;
  };
  try {
    body = await context.request.json() as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const validation = validateDayBody(body);
  if (!validation.ok) {
    return json({ error: validation.error }, validation.status);
  }

  // 亂碼偵測：對 timeline entries 的文字欄位逐一檢查
  const entryTextFields = ['title', 'body', 'note', 'travel_desc'] as const;
  const timelineEntries = Array.isArray(body.timeline) ? body.timeline : [];
  for (let i = 0; i < timelineEntries.length; i++) {
    const e = timelineEntries[i];
    for (const f of entryTextFields) {
      const val = f === 'travel_desc' ? (e.travel as { desc?: unknown } | undefined)?.desc : e[f];
      if (typeof val === 'string' && detectGarbledText(val)) {
        return json({ error: `timeline[${i}].${f} 包含疑似亂碼，請確認 encoding 為 UTF-8` }, 400);
      }
    }
  }

  // Write snapshot audit log BEFORE any batch operations (for recovery if batch fails)
  await logAudit(db, {
    tripId: id,
    tableName: 'days',
    recordId: dayId,
    action: 'update',
    changedBy,
    snapshot,
    diffJson: JSON.stringify({ day_num: Number(num), overwrite: true }),
  });

  // --- Batch 1: delete all old sub-data + update day + INSERT hotel + INSERT entries ---
  // Statements are tracked in order so we can extract RETURNING ids from results.
  const batch1: D1PreparedStatement[] = [];

  // Delete old nested data (5 statements, indices 0-4)
  batch1.push(
    db.prepare("DELETE FROM shopping WHERE parent_type = 'hotel' AND parent_id IN (SELECT id FROM hotels WHERE day_id = ?)").bind(dayId),
    db.prepare('DELETE FROM hotels WHERE day_id = ?').bind(dayId),
    db.prepare("DELETE FROM restaurants WHERE entry_id IN (SELECT id FROM entries WHERE day_id = ?)").bind(dayId),
    db.prepare("DELETE FROM shopping WHERE parent_type = 'entry' AND parent_id IN (SELECT id FROM entries WHERE day_id = ?)").bind(dayId),
    db.prepare('DELETE FROM entries WHERE day_id = ?').bind(dayId),
  );

  // Update day fields (index 5)
  batch1.push(
    db.prepare('UPDATE days SET date = ?, day_of_week = ?, label = ?, weather_json = ? WHERE id = ?')
      .bind(
        body.date!,
        body.dayOfWeek!,
        body.label!,
        body.weather ? JSON.stringify(body.weather) : null,
        dayId,
      ),
  );

  // Track where hotel and entries start in batch1 results
  const HOTEL_IDX = body.hotel ? batch1.length : -1;
  if (body.hotel) {
    const h = body.hotel;
    batch1.push(
      db.prepare('INSERT INTO hotels (day_id, name, checkout, details, breakfast, note, parking_json) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id')
        .bind(
          dayId,
          h.name ?? null,
          h.checkout ?? null,
          h.details ?? h.address ?? null,
          h.breakfast ?? null,
          h.note ?? null,
          h.parking ? JSON.stringify(h.parking) : null,
        ),
    );
  }

  const ENTRIES_START_IDX = batch1.length;
  const timeline = Array.isArray(body.timeline) ? body.timeline : [];
  for (let i = 0; i < timeline.length; i++) {
    const e = timeline[i];
    const travel = e.travel as { type?: unknown; desc?: unknown; min?: unknown } | undefined;
    batch1.push(
      db.prepare('INSERT INTO entries (day_id, sort_order, time, title, body, maps, rating, note, travel_type, travel_desc, travel_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
        .bind(
          dayId, i,
          e.time ?? null, e.title ?? null, e.body ?? null,
          e.maps ?? null, e.rating ?? null, e.note ?? null,
          travel?.type ?? null, travel?.desc ?? null, travel?.min ?? null,
        ),
    );
  }

  try {
    const batch1Results = await db.batch(batch1);

    // Extract hotel id from RETURNING result
    let hotelId: number | null = null;
    if (HOTEL_IDX >= 0) {
      const hotelRows = batch1Results[HOTEL_IDX].results as { id: number }[];
      hotelId = hotelRows[0]?.id ?? null;
    }

    // Extract entry ids from RETURNING results
    const entryIds: number[] = [];
    for (let i = 0; i < timeline.length; i++) {
      const entryRows = batch1Results[ENTRIES_START_IDX + i].results as { id: number }[];
      entryIds.push(entryRows[0]?.id ?? 0);
    }

    // --- Batch 2: INSERT all restaurants + shopping using ids from Batch 1 ---
    const batch2: D1PreparedStatement[] = [];

    // Hotel shopping
    if (body.hotel && hotelId !== null && Array.isArray(body.hotel.shopping)) {
      for (const [idx, s] of (body.hotel.shopping as Record<string, unknown>[]).entries()) {
        batch2.push(
          db.prepare("INSERT INTO shopping (parent_type, parent_id, sort_order, name, category, hours, must_buy, note, rating, maps, mapcode, source) VALUES ('hotel', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(hotelId, idx, s.name ?? null, s.category ?? null, s.hours ?? null, s.must_buy ?? null, s.note ?? null, s.rating ?? null, s.maps ?? null, s.mapcode ?? null, s.source ?? null),
        );
      }
    }

    // Entry restaurants + shopping
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i];
      const entryId = entryIds[i];

      if (Array.isArray(e.restaurants)) {
        for (const r of e.restaurants as Record<string, unknown>[]) {
          batch2.push(
            db.prepare("INSERT INTO restaurants (entry_id, name, category, hours, price, reservation, reservation_url, description, note, rating, maps, mapcode, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
              .bind(entryId, r.name ?? null, r.category ?? null, r.hours ?? null, r.price ?? null, r.reservation ?? null, r.reservation_url ?? null, r.description ?? null, r.note ?? null, r.rating ?? null, r.maps ?? null, r.mapcode ?? null, r.source ?? null),
          );
        }
      }

      if (Array.isArray(e.shopping)) {
        for (const [sIdx, s] of (e.shopping as Record<string, unknown>[]).entries()) {
          batch2.push(
            db.prepare("INSERT INTO shopping (parent_type, parent_id, sort_order, name, category, hours, must_buy, note, rating, maps, mapcode, source) VALUES ('entry', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
              .bind(entryId, sIdx, s.name ?? null, s.category ?? null, s.hours ?? null, s.must_buy ?? null, s.note ?? null, s.rating ?? null, s.maps ?? null, s.mapcode ?? null, s.source ?? null),
          );
        }
      }
    }

    if (batch2.length > 0) await db.batch(batch2);
  } catch (err) {
    // Snapshot already saved before batch; log additional error context
    await logAudit(db, {
      tripId: id,
      tableName: 'days',
      recordId: dayId,
      action: 'update',
      changedBy,
      diffJson: JSON.stringify({ error: 'Partial write failure', message: err instanceof Error ? err.message : String(err) }),
    });
    return json({ error: '儲存失敗，請稍後再試' }, 500);
  }

  return json({ ok: true });
};
