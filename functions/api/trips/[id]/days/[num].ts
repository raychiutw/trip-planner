import { logAudit } from '../../../_audit';
import { hasPermission } from '../../../_auth';

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
  if (!auth) return new Response(JSON.stringify({ error: '未認證' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

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
  const snapshot = JSON.stringify({ dayId, hotel: oldHotel, entries: oldEntries.results });

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

  // Build batch statements: delete old data, then insert new
  const stmts: D1PreparedStatement[] = [];

  // Delete old nested data
  stmts.push(
    db.prepare("DELETE FROM shopping WHERE parent_type = 'hotel' AND parent_id IN (SELECT id FROM hotels WHERE day_id = ?)").bind(dayId),
    db.prepare('DELETE FROM hotels WHERE day_id = ?').bind(dayId),
    db.prepare("DELETE FROM restaurants WHERE entry_id IN (SELECT id FROM entries WHERE day_id = ?)").bind(dayId),
    db.prepare("DELETE FROM shopping WHERE parent_type = 'entry' AND parent_id IN (SELECT id FROM entries WHERE day_id = ?)").bind(dayId),
    db.prepare('DELETE FROM entries WHERE day_id = ?').bind(dayId),
  );

  // Update day fields
  stmts.push(
    db.prepare('UPDATE days SET date = ?, day_of_week = ?, label = ?, weather_json = ? WHERE id = ?')
      .bind(
        body.date ?? null,
        body.dayOfWeek ?? null,
        body.label ?? null,
        body.weather ? JSON.stringify(body.weather) : null,
        dayId,
      ),
  );

  try {
    await db.batch(stmts);

    // Insert hotel (must get inserted id, so do separately)
    if (body.hotel) {
      const h = body.hotel;
      const hotelResult = await db
        .prepare('INSERT INTO hotels (day_id, name, checkout, details, breakfast, note, parking_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(
          dayId,
          h.name ?? null,
          h.checkout ?? null,
          h.details ?? h.address ?? null,
          h.breakfast ?? null,
          h.note ?? null,
          h.parking ? JSON.stringify(h.parking) : null,
        )
        .run();

      const hotelId = hotelResult.meta.last_row_id as number;

      if (Array.isArray(h.shopping) && h.shopping.length > 0) {
        const shopStmts = (h.shopping as Record<string, unknown>[]).map((s, idx) =>
          db.prepare("INSERT INTO shopping (parent_type, parent_id, sort_order, name, category, hours, must_buy, note, rating, maps, mapcode, source) VALUES ('hotel', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(hotelId, idx, s.name ?? null, s.category ?? null, s.hours ?? null, s.must_buy ?? null, s.note ?? null, s.rating ?? null, s.maps ?? null, s.mapcode ?? null, s.source ?? null)
        );
        await db.batch(shopStmts);
      }
    }

    // Insert entries
    if (Array.isArray(body.timeline) && body.timeline.length > 0) {
      for (let i = 0; i < body.timeline.length; i++) {
        const e = body.timeline[i];
        const travel = e.travel as { type?: unknown; desc?: unknown; min?: unknown } | undefined;
        const entryResult = await db
          .prepare('INSERT INTO entries (day_id, sort_order, time, title, body, maps, rating, note, travel_type, travel_desc, travel_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(
            dayId, i,
            e.time ?? null, e.title ?? null, e.body ?? null,
            e.maps ?? null, e.rating ?? null, e.note ?? null,
            travel?.type ?? null, travel?.desc ?? null, travel?.min ?? null,
          )
          .run();

        const entryId = entryResult.meta.last_row_id as number;

        const nestedStmts: D1PreparedStatement[] = [];

        if (Array.isArray(e.restaurants)) {
          for (const r of e.restaurants as Record<string, unknown>[]) {
            nestedStmts.push(
              db.prepare("INSERT INTO restaurants (entry_id, name, category, hours, price, reservation, reservation_url, description, note, rating, maps, mapcode, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(entryId, r.name ?? null, r.category ?? null, r.hours ?? null, r.price ?? null, r.reservation ?? null, r.reservation_url ?? null, r.description ?? null, r.note ?? null, r.rating ?? null, r.maps ?? null, r.mapcode ?? null, r.source ?? null)
            );
          }
        }

        if (Array.isArray(e.shopping)) {
          for (const [sIdx, s] of (e.shopping as Record<string, unknown>[]).entries()) {
            nestedStmts.push(
              db.prepare("INSERT INTO shopping (parent_type, parent_id, sort_order, name, category, hours, must_buy, note, rating, maps, mapcode, source) VALUES ('entry', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(entryId, sIdx, s.name ?? null, s.category ?? null, s.hours ?? null, s.must_buy ?? null, s.note ?? null, s.rating ?? null, s.maps ?? null, s.mapcode ?? null, s.source ?? null)
            );
          }
        }

        if (nestedStmts.length > 0) await db.batch(nestedStmts);
      }
    }
  } catch (err) {
    // Log snapshot for manual recovery
    await logAudit(db, {
      tripId: id,
      tableName: 'days',
      recordId: dayId,
      action: 'update',
      changedBy,
      snapshot,
      diffJson: JSON.stringify({ error: 'Partial write failure', message: err instanceof Error ? err.message : String(err) }),
    });
    return json({ error: 'Write failed, snapshot saved for recovery' }, 500);
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
