import { hasWritePermission, requireAuth, requireTripReadAccess } from '../../_auth';
import { AppError } from '../../_errors';
import { json, getAuth } from '../../_utils';
import type { Env } from '../../_types';
import {
  assembleDay,
  fetchEntryPoisByEntries,
  fetchHotelAndParking,
  fetchTripSegmentsMap,
} from './days/_merge';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MS_PER_DAY = 86_400_000;

/**
 * GET /api/trips/:id/days
 * - 預設：回傳 days summary list（id, day_num, date, day_of_week, label, title）
 * - `?all=1`：回傳完整 days 陣列（含 hotel + timeline + POI），解決前端 N+1
 *
 * Section 4.3 (terracotta-mockup-parity-v2)：summary 加 `title` 欄。
 *
 * v2.29.0: trip_pois 整表 drop。Hotel ← trip_days.hotel_poi_id，entry POIs ← trip_entry_pois，
 * travel ← trip_segments。Parking ← poi_relations(relation_type='parking')。
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };
  const db = context.env.DB;
  const all = new URL(context.request.url).searchParams.get('all') === '1';

  // v2.33.41 security: gate anonymous read.
  await requireTripReadAccess(db, getAuth(context), id);

  if (!all) {
    const { results } = await db
      .prepare('SELECT id, day_num, date, day_of_week, label, title FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
      .bind(id)
      .all();
    return json(results);
  }

  // Batch 模式：4 queries 平行（days + entries + segments + entry_pois 由 helper 內部完成）
  const [daysResult, entriesResult, segmentsMap] = await Promise.all([
    db.prepare('SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC').bind(id).all(),
    db.prepare(`
      SELECT e.* FROM trip_entries e
      JOIN trip_days d ON e.day_id = d.id
      WHERE d.trip_id = ?
      ORDER BY e.day_id ASC, e.sort_order ASC
    `).bind(id).all(),
    fetchTripSegmentsMap(db, id),
  ]);

  const dayRows = daysResult.results as Record<string, unknown>[];
  const entryRows = entriesResult.results as Record<string, unknown>[];

  // Collect hotel_poi_id list (dedup, non-null) → fetch hotel + parking POI
  const hotelPoiIds = [
    ...new Set(
      dayRows
        .map((d) => d.hotel_poi_id as number | null)
        .filter((v): v is number => v != null && v > 0),
    ),
  ];
  const { poiMap, parkingMap } = await fetchHotelAndParking(db, hotelPoiIds);

  // v2.27.0 multi-POI per entry：1 query fetch all entry_pois，分 map per entry
  const allEntryIds = entryRows.map((e) => e.id as number);
  const entryPoisMap = await fetchEntryPoisByEntries(db, allEntryIds);

  const entriesByDay = new Map<number, Record<string, unknown>[]>();
  for (const e of entryRows) {
    const dayId = e.day_id as number;
    if (!entriesByDay.has(dayId)) entriesByDay.set(dayId, []);
    entriesByDay.get(dayId)!.push(e);
  }

  const days = dayRows.map((day) => {
    const dayId = day.id as number;
    return assembleDay(
      day,
      entriesByDay.get(dayId) ?? [],
      poiMap,
      parkingMap,
      entryPoisMap,
      segmentsMap,
    );
  });

  return json(days);
};

/**
 * POST /api/trips/:id/days
 *
 * v2.33.0: append / prepend a single day。Body `{ position: 'start' | 'end' }`.
 *
 * - position='end': day_num = max + 1, date = max_date + 1 day
 * - position='start': UPDATE 所有現有 day_num += 1 (UNIQUE 在 statement end 才檢查 OK),
 *   INSERT day_num=1 + date = min_date - 1 day
 *
 * Empty trip (沒 days yet) → 直接 INSERT day_num=1, date=null (label 也空)。
 *
 * Auth: trip write permission（owner / admin / member; viewer 拒）。
 *
 * Returns { day: { id, day_num, date, day_of_week, label, title } }.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);

  const tripId = context.params.id as string;
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');

  const db = context.env.DB;
  if (!(await hasWritePermission(db, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  const trip = await db.prepare('SELECT id FROM trips WHERE id = ?').bind(tripId).first();
  if (!trip) throw new AppError('DATA_NOT_FOUND', '找不到該行程');

  const body = (await context.request.json().catch(() => ({}))) as { position?: string; date?: string };
  const position =
    body.position === 'start' ? 'start' :
    body.position === 'end' ? 'end' :
    body.position === 'insert' ? 'insert' :
    null;
  if (!position) {
    throw new AppError('DATA_VALIDATION', 'position 需為 "start" / "end" / "insert"');
  }

  // v2.33.7: insert mode 需 body.date (YYYY-MM-DD)
  let insertDate: string | null = null;
  if (position === 'insert') {
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new AppError('DATA_VALIDATION', 'insert 模式必須提供 date (YYYY-MM-DD)');
    }
    insertDate = body.date;
  }

  // 取目前所有 days 算 min/max
  const { results } = await db
    .prepare('SELECT day_num, date FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
    .bind(tripId)
    .all<{ day_num: number; date: string | null }>();
  const existing = results || [];

  let newDayNum: number;
  let newDate: string | null;

  if (existing.length === 0) {
    // 空 trip：第一天無 reference date
    newDayNum = 1;
    newDate = position === 'insert' ? insertDate : null;
  } else if (position === 'end') {
    const last = existing[existing.length - 1]!;
    newDayNum = last.day_num + 1;
    newDate = last.date ? shiftDate(last.date, +1) : null;
  } else if (position === 'insert') {
    // v2.33.7: insert at correct day_num based on date 排序。
    // 找 < insertDate 的 days 數量 → newDayNum = count + 1。
    // 後續 days (≥ newDayNum) 逆序 UPDATE day_num += 1。
    newDate = insertDate;
    let beforeCount = 0;
    for (const r of existing) {
      if (r.date && r.date < insertDate!) beforeCount++;
      else if (r.date && r.date === insertDate) {
        throw new AppError('DATA_VALIDATION', `日期 ${insertDate} 已存在，不能重複`);
      }
    }
    newDayNum = beforeCount + 1;
    // shift 後續 days (day_num >= newDayNum) 逆序 +1
    const toShift = existing.filter((r) => r.day_num >= newDayNum);
    const stmts: D1PreparedStatement[] = [];
    for (let i = toShift.length - 1; i >= 0; i--) {
      const r = toShift[i]!;
      stmts.push(
        db
          .prepare('UPDATE trip_days SET day_num = ? WHERE trip_id = ? AND day_num = ?')
          .bind(r.day_num + 1, tripId, r.day_num),
      );
    }
    if (stmts.length > 0) await db.batch(stmts);
  } else {
    // prepend
    const first = existing[0]!;
    newDayNum = 1;
    newDate = first.date ? shiftDate(first.date, -1) : null;
    // D1 / SQLite UNIQUE 是 row-by-row 即時檢查（非 statement-end deferred），
    // 所以 `UPDATE day_num = day_num + 1` 一條 SQL 會在處理第一個 row 時違反
    // UNIQUE(trip_id, day_num)。改逆序 UPDATE：先把 day_num=N 改成 N+1，
    // 再把 N-1 改成 N，..., 最後 1 改成 2，整個過程沒有衝突。
    const stmts: D1PreparedStatement[] = [];
    for (let i = existing.length - 1; i >= 0; i--) {
      const r = existing[i]!;
      stmts.push(
        db
          .prepare('UPDATE trip_days SET day_num = ? WHERE trip_id = ? AND day_num = ?')
          .bind(r.day_num + 1, tripId, r.day_num),
      );
    }
    if (stmts.length > 0) await db.batch(stmts);
  }

  const dayOfWeek = newDate ? WEEKDAYS[new Date(newDate + 'T00:00:00Z').getUTCDay()] : null;

  const insertResult = await db
    .prepare(
      'INSERT INTO trip_days (trip_id, day_num, date, day_of_week, label) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(tripId, newDayNum, newDate, dayOfWeek, '')
    .run();

  const newDayId = (insertResult.meta?.last_row_id as number | undefined) ?? null;

  return json({
    day: {
      id: newDayId,
      day_num: newDayNum,
      date: newDate,
      day_of_week: dayOfWeek,
      label: '',
      title: null,
    },
  });
};

/** Shift a YYYY-MM-DD string by N days (positive or negative). */
function shiftDate(yyyyMmDd: string, delta: number): string {
  const t = new Date(yyyyMmDd + 'T00:00:00Z').getTime();
  return new Date(t + delta * MS_PER_DAY).toISOString().slice(0, 10);
}
