/**
 * GET /api/trips/:id/segments
 *
 * 回傳該行程所有 trip_segments（兩 entry 之間的交通段）。
 * 前端 TimelineRail / TravelPill 用此 list 配對 entry，自行 join entry context。
 *
 * v2.24.0 起 segments 是 travel data 的 source of truth；v2.29.0 entry.travel_*
 * 已 DROPPED。v2.30.0 mode_source 已 DROPPED — transit 自然代理 user override。
 *
 * Auth: trip read permission.
 */

import { hasPermission } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, getAuth } from '../../../_utils';
import type { Env } from '../../../_types';

interface SegmentRow {
  id: number;
  trip_id: string;
  from_entry_id: number;
  to_entry_id: number;
  mode: string;
  min: number | null;
  distance_m: number | null;
  source: string | null;
  computed_at: number | null;
  updated_at: number | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const tripId = context.params.id as string;
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');

  const db = context.env.DB;
  if (!await hasPermission(db, auth, tripId, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  const res = await db
    .prepare(
      `SELECT s.id, s.trip_id, s.from_entry_id, s.to_entry_id,
              s.mode, s.min, s.distance_m, s.source,
              s.computed_at, s.updated_at
       FROM trip_segments s
       JOIN trip_entries fe ON fe.id = s.from_entry_id
       JOIN trip_days fd ON fd.id = fe.day_id
       WHERE s.trip_id = ?
       ORDER BY fd.day_num ASC, fe.sort_order ASC`,
    )
    .bind(tripId)
    .all<SegmentRow>();

  return json(res.results ?? []);
};
