import { logAudit } from '../../../_audit';

interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

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

  // 6. Assemble response — map snake_case to camelCase for frontend
  const { id: _id, trip_id: _trip_id, day_num, day_of_week, weather_json, ...dayFields } = day;
  return json({
    id: dayId,
    dayNum: day_num,
    dayOfWeek: day_of_week,
    weather: weather_json,
    ...dayFields,
    hotel,
    timeline,
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = (context.data as any)?.auth;
  if (!auth) return new Response(JSON.stringify({ error: '未認證' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const { id, num } = context.params as { id: string; num: string };
  const changedBy = auth?.email || 'anonymous';
  const db = context.env.DB;

  const day = await db
    .prepare('SELECT id FROM days WHERE trip_id = ? AND day_num = ?')
    .bind(id, Number(num))
    .first() as { id: number } | null;

  if (!day) return json({ error: 'Not found' }, 404);

  const dayId = day.id;
  const body = await context.request.json() as {
    date?: string;
    dayOfWeek?: string;
    label?: string;
    weather?: unknown;
    hotel?: Record<string, unknown> & { shopping?: unknown[]; parking?: unknown };
    timeline?: Array<Record<string, unknown> & { restaurants?: unknown[]; shopping?: unknown[] }>;
  };

  // Build batch statements: delete old data, then insert new
  const stmts: D1PreparedStatement[] = [];

  // Delete old nested data
  stmts.push(
    db.prepare("DELETE FROM shopping WHERE parent_type = 'hotel' AND parent_id IN (SELECT id FROM hotels WHERE day_id = ?)").bind(dayId),
    db.prepare('DELETE FROM hotels WHERE day_id = ?').bind(dayId),
    db.prepare("DELETE FROM restaurants WHERE parent_type = 'entry' AND parent_id IN (SELECT id FROM entries WHERE day_id = ?)").bind(dayId),
    db.prepare("DELETE FROM shopping WHERE parent_type = 'entry' AND parent_id IN (SELECT id FROM entries WHERE day_id = ?)").bind(dayId),
    db.prepare('DELETE FROM entries WHERE day_id = ?').bind(dayId),
  );

  // Update day fields
  stmts.push(
    db.prepare('UPDATE days SET date = ?, day_of_week = ?, label = ?, weather_json = ? WHERE id = ?')
      .bind(
        body.date ?? null,
        body.day_of_week ?? null,
        body.label ?? null,
        body.weather_json ? JSON.stringify(body.weather_json) : null,
        dayId,
      ),
  );

  await db.batch(stmts);

  // Insert hotel (must get inserted id, so do separately)
  if (body.hotel) {
    const h = body.hotel;
    const hotelResult = await db
      .prepare('INSERT INTO hotels (day_id, name, checkout, address, maps, note) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(dayId, h.name ?? null, h.checkout ?? null, h.address ?? null, h.maps ?? null, h.note ?? null)
      .run();

    const hotelId = hotelResult.meta.last_row_id as number;

    if (h.parking) {
      await db
        .prepare('UPDATE hotels SET parking = ? WHERE id = ?')
        .bind(JSON.stringify(h.parking), hotelId)
        .run();
    }

    if (Array.isArray(h.shopping) && h.shopping.length > 0) {
      const shopStmts = (h.shopping as Record<string, unknown>[]).map(s =>
        db.prepare("INSERT INTO shopping (parent_type, parent_id, name, price, note) VALUES ('hotel', ?, ?, ?, ?)")
          .bind(hotelId, s.name ?? null, s.price ?? null, s.note ?? null)
      );
      await db.batch(shopStmts);
    }
  }

  // Insert entries
  if (Array.isArray(body.timeline) && body.timeline.length > 0) {
    for (let i = 0; i < body.timeline.length; i++) {
      const e = body.timeline[i];
      const entryResult = await db
        .prepare('INSERT INTO entries (day_id, sort_order, time, title, body, maps, rating, note, travel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(
          dayId, i,
          e.time ?? null, e.title ?? null, e.body ?? null,
          e.maps ?? null, e.rating ?? null, e.note ?? null,
          e.travel ? JSON.stringify(e.travel) : null,
        )
        .run();

      const entryId = entryResult.meta.last_row_id as number;

      const nestedStmts: D1PreparedStatement[] = [];

      if (Array.isArray(e.restaurants)) {
        for (const r of e.restaurants as Record<string, unknown>[]) {
          nestedStmts.push(
            db.prepare("INSERT INTO restaurants (parent_type, parent_id, name, address, maps, note) VALUES ('entry', ?, ?, ?, ?, ?)")
              .bind(entryId, r.name ?? null, r.address ?? null, r.maps ?? null, r.note ?? null)
          );
        }
      }

      if (Array.isArray(e.shopping)) {
        for (const s of e.shopping as Record<string, unknown>[]) {
          nestedStmts.push(
            db.prepare("INSERT INTO shopping (parent_type, parent_id, name, price, note) VALUES ('entry', ?, ?, ?, ?)")
              .bind(entryId, s.name ?? null, s.price ?? null, s.note ?? null)
          );
        }
      }

      if (nestedStmts.length > 0) await db.batch(nestedStmts);
    }
  }

  await logAudit(db, {
    tripId: id,
    tableName: 'days',
    recordId: dayId,
    action: 'update',
    changedBy,
    diffJson: JSON.stringify({ day_num: Number(num), overwrite: true }),
  });

  return json({ ok: true });
};
