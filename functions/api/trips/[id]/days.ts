import { json } from '../../_utils';
import type { Env } from '../../_types';
import {
  assembleDay,
  fetchEntryPoisByEntries,
  fetchHotelAndParking,
  fetchTripSegmentsMap,
} from './days/_merge';

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
