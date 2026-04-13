import { json } from '../../_utils';
import type { Env } from '../../_types';
import { assembleDay } from './days/_merge';

/**
 * GET /api/trips/:id/days
 * - 預設：回傳 days summary list（id, day_num, date, day_of_week, label）
 * - `?all=1`：回傳完整 days 陣列（含 hotel + timeline + POI），解決前端 N+1
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id } = context.params as { id: string };
  const db = context.env.DB;
  const all = new URL(context.request.url).searchParams.get('all') === '1';

  if (!all) {
    const { results } = await db
      .prepare('SELECT id, day_num, date, day_of_week, label FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC')
      .bind(id)
      .all();
    return json(results);
  }

  // Batch 模式：4 queries 全平行（pois 用 subquery 避免 serial round-trip）
  const [daysResult, entriesResult, tripPoisResult, poisResult] = await Promise.all([
    db.prepare('SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_num ASC').bind(id).all(),
    db.prepare(`
      SELECT e.* FROM trip_entries e
      JOIN trip_days d ON e.day_id = d.id
      WHERE d.trip_id = ?
      ORDER BY e.day_id ASC, e.sort_order ASC
    `).bind(id).all(),
    db.prepare('SELECT * FROM trip_pois WHERE trip_id = ?').bind(id).all(),
    db.prepare(`
      SELECT * FROM pois
      WHERE id IN (SELECT DISTINCT poi_id FROM trip_pois WHERE trip_id = ?)
    `).bind(id).all(),
  ]);

  const dayRows = daysResult.results as Record<string, unknown>[];
  const entryRows = entriesResult.results as Record<string, unknown>[];
  const tripPoiRows = tripPoisResult.results as Record<string, unknown>[];

  const poiMap = new Map<number, Record<string, unknown>>();
  for (const p of poisResult.results as Record<string, unknown>[]) {
    poiMap.set(p.id as number, p);
  }

  const entriesByDay = new Map<number, Record<string, unknown>[]>();
  for (const e of entryRows) {
    const dayId = e.day_id as number;
    if (!entriesByDay.has(dayId)) entriesByDay.set(dayId, []);
    entriesByDay.get(dayId)!.push(e);
  }

  const tripPoisByDay = new Map<number, Record<string, unknown>[]>();
  for (const tp of tripPoiRows) {
    const dayId = tp.day_id as number;
    if (dayId == null) continue;
    if (!tripPoisByDay.has(dayId)) tripPoisByDay.set(dayId, []);
    tripPoisByDay.get(dayId)!.push(tp);
  }

  const days = dayRows.map(day => {
    const dayId = day.id as number;
    return assembleDay(
      day,
      entriesByDay.get(dayId) ?? [],
      tripPoisByDay.get(dayId) ?? [],
      poiMap,
    );
  });

  return json(days);
};
