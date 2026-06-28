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

import { hasWritePermission, requireAuth, requireTripReadAccess } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, getAuth, parseJsonBody } from '../../../_utils';
import type { Env } from '../../../_types';
import { isSegmentMode, MAX_SEGMENT_MIN, resolveSegmentTravel } from './_shared';

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
  version: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tripId = context.params.id as string;
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');

  const db = context.env.DB;
  // v2.33.41 security: gate anonymous read — published trips allow,
  // otherwise owner/member only (取代之前 requireAuth + hasPermission，
  // 對齊其他 trips/[id]/* GET handler 的 published-aware 模型)。
  await requireTripReadAccess(db, getAuth(context), tripId);

  const res = await db
    .prepare(
      `SELECT s.id, s.trip_id, s.from_entry_id, s.to_entry_id,
              s.mode, s.min, s.distance_m, s.source,
              s.computed_at, s.updated_at, s.version
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

interface CreateSegmentBody {
  from_entry_id?: number;
  to_entry_id?: number;
  mode?: string;
  min?: number;
}

/**
 * POST /api/trips/:id/segments
 *
 * 建立（或 upsert）一段 from→to entry 的 travel segment。當 recompute 尚未跑、segment
 * 不存在時，讓 user 從 EditEntryPage 手動設移動方式（開車 / 步行 / 大眾運輸）。
 *
 * Body：{ from_entry_id, to_entry_id, mode, min? }
 *   - driving / walking → 一律打 Google Routes 重算（ignore body.min）；缺 coords / API
 *     失敗 → INSERT min/distance=NULL（stale，computed_at=NULL）。
 *   - transit → 必填 min（1–1440），source='manual'。
 *
 * trip_segments 有 UNIQUE(from_entry_id, to_entry_id) → INSERT ON CONFLICT DO UPDATE
 * （同 pair 重送 = 改 mode，等同 PATCH /:sid）。Auth: trip write permission.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  const tripId = context.params.id as string;
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');

  const db = context.env.DB;
  if (!await hasWritePermission(db, auth, tripId)) {
    throw new AppError('PERM_DENIED');
  }

  const body = await parseJsonBody<CreateSegmentBody>(context.request);

  const fromEntryId = body.from_entry_id;
  const toEntryId = body.to_entry_id;
  if (
    typeof fromEntryId !== 'number' || !Number.isInteger(fromEntryId) || fromEntryId <= 0 ||
    typeof toEntryId !== 'number' || !Number.isInteger(toEntryId) || toEntryId <= 0
  ) {
    throw new AppError('DATA_VALIDATION', 'from_entry_id / to_entry_id 須為正整數');
  }
  if (fromEntryId === toEntryId) {
    throw new AppError('DATA_VALIDATION', 'from / to entry 不可相同');
  }

  if (!isSegmentMode(body.mode)) {
    throw new AppError('DATA_VALIDATION', 'mode 必須為 driving / walking / transit');
  }
  const mode = body.mode;

  if (mode === 'transit' && (typeof body.min !== 'number' || !Number.isFinite(body.min) || body.min < 1 || body.min > MAX_SEGMENT_MIN)) {
    throw new AppError('DATA_VALIDATION', 'transit mode 須提供 min（1–1440 分鐘）');
  }

  // 防 IDOR：兩個 entry 都必須屬於該 trip
  const owned = await db
    .prepare(
      `SELECT te.id
       FROM trip_entries te
       JOIN trip_days td ON td.id = te.day_id
       WHERE td.trip_id = ? AND te.id IN (?, ?)`,
    )
    .bind(tripId, fromEntryId, toEntryId)
    .all<{ id: number }>();
  if ((owned.results ?? []).length !== 2) {
    throw new AppError('DATA_NOT_FOUND', 'from / to entry 不屬於此行程');
  }

  const now = Date.now();
  const travel = await resolveSegmentTravel(context.env, db, fromEntryId, toEntryId, mode, body.min, now);

  const min = travel.ok ? travel.min : null;
  const distanceM = travel.ok ? travel.distanceM : null;
  const source = travel.ok ? travel.source : null;
  const computedAt = travel.ok ? travel.computedAt : null;

  // INSERT ON CONFLICT(from_entry_id, to_entry_id) → upsert（同 pair 重設 mode），RETURNING
  // 一次回 row（省 SELECT-back round-trip）。
  // 注意：不同於 recompute-travel 的 upsert 帶 `WHERE mode != 'transit'` guard（自動重算
  // 不覆蓋 user 手填的 transit），POST 是 user 主動設 mode → 覆蓋既有 transit 是 user 意圖，
  // 故無 guard。
  const created = await db
    .prepare(
      `INSERT INTO trip_segments
         (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (from_entry_id, to_entry_id) DO UPDATE SET
         mode = excluded.mode,
         min = excluded.min,
         distance_m = excluded.distance_m,
         source = excluded.source,
         computed_at = excluded.computed_at,
         updated_at = excluded.updated_at,
         version = trip_segments.version + 1
       RETURNING id, trip_id, from_entry_id, to_entry_id, mode,
                 min, distance_m, source, computed_at, updated_at, version`,
    )
    .bind(tripId, fromEntryId, toEntryId, mode, min, distanceM, source, computedAt, now)
    .first();
  if (!created) throw new AppError('DATA_SAVE_FAILED', '建立 segment 失敗');
  return json(created, 201);
};
