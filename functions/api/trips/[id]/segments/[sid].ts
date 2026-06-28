/**
 * PATCH /api/trips/:id/segments/:sid
 *
 * Set the travel mode for an existing segment.
 *
 * Body：
 *   { mode: 'driving' | 'walking' | 'transit', min?: number }
 *
 * v2.30.0 (mode_source DROPPED) 語意（算邏輯抽到 segments/_shared.ts，與 POST /segments 共用）：
 *   - mode='transit' → 必填 min（Japan Routes API 無 transit 資料），save as source='manual'，
 *     不打 Google API。切回 driving/walking 時會被 backend 重算覆蓋。
 *   - mode='driving' / 'walking' → **一律忽略 body.min**，強制走 Google Routes 從 from/to entry
 *     座標重算。source='google'。若 Routes 失敗 / 缺 coords → 保留舊 min + distance_m（不阻擋
 *     切換），computed_at=NULL 標 stale。
 *
 * 建立新 segment（recompute 未跑、segment 不存在）走 POST /api/trips/:id/segments。
 *
 * Auth: trip write permission.
 */

import { hasWritePermission, requireAuth} from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, parseJsonBody, parseIntParam } from '../../../_utils';
import type { Env } from '../../../_types';
import { isSegmentMode, MAX_SEGMENT_MIN, resolveSegmentTravel } from './_shared';

interface PatchBody {
  mode?: string;
  min?: number;
  /** v2.33.108: OCC token — autosave 帶；不符回 409 STALE_ENTRY。omit → backward compat。 */
  expectedVersion?: number;
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);

  const tripId = context.params.id as string;
  const sidStr = context.params.sid as string;
  const sid = parseIntParam(sidStr);
  if (!tripId || sid === null) {
    throw new AppError('DATA_VALIDATION', '缺少 tripId / sid');
  }

  const db = context.env.DB;
  if (!await hasWritePermission(db, auth, tripId)) {
    throw new AppError('PERM_DENIED');
  }

  // 驗 segment 屬於該 trip（防 IDOR）+ 取 from/to entry + version for OCC
  const seg = await db
    .prepare('SELECT id, trip_id, from_entry_id, to_entry_id, version FROM trip_segments WHERE id = ?')
    .bind(sid)
    .first<{ id: number; trip_id: string; from_entry_id: number; to_entry_id: number; version: number }>();
  if (!seg || seg.trip_id !== tripId) {
    throw new AppError('DATA_NOT_FOUND', '找不到此 segment');
  }

  const body = await parseJsonBody<PatchBody>(context.request);

  // v2.33.108: OCC token check（pre-SELECT — segments 多 UPDATE 分支不適合
  // atomic CAS WHERE。frequency 低，TOCTOU race window 接受）。
  if (typeof body.expectedVersion === 'number' && Number.isInteger(body.expectedVersion)) {
    if (seg.version !== body.expectedVersion) {
      throw new AppError('STALE_ENTRY', `expected version ${body.expectedVersion}, current ${seg.version}`);
    }
  }

  if (!isSegmentMode(body.mode)) {
    throw new AppError('DATA_VALIDATION', 'mode 必須為 driving / walking / transit');
  }
  const mode = body.mode;

  if (mode === 'transit' && (typeof body.min !== 'number' || !Number.isFinite(body.min) || body.min < 1 || body.min > MAX_SEGMENT_MIN)) {
    throw new AppError('DATA_VALIDATION', 'transit mode 須提供 min（1–1440 分鐘）');
  }

  const now = Date.now();
  const travel = await resolveSegmentTravel(context.env, db, seg.from_entry_id, seg.to_entry_id, mode, body.min, now);

  // RETURNING 一次回更新後 row（省 SELECT-back round-trip）。欄位名固定常數，非 user input。
  const RETURNING_COLS =
    'id, trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at, version';
  let updated;
  if (travel.ok) {
    updated = await db
      .prepare(
        `UPDATE trip_segments
         SET mode = ?, min = ?, distance_m = ?,
             source = ?, computed_at = ?, updated_at = ?,
             version = version + 1
         WHERE id = ? RETURNING ${RETURNING_COLS}`,
      )
      .bind(mode, travel.min, travel.distanceM, travel.source, travel.computedAt, now, sid)
      .first();
  } else {
    // driving / walking 算失敗（缺 coords / API key / Routes error）→ 只改 mode 保留舊
    // min/distance，computed_at=NULL 標 stale（不阻擋切換）。
    updated = await db
      .prepare(
        `UPDATE trip_segments
         SET mode = ?, computed_at = NULL, updated_at = ?,
             version = version + 1
         WHERE id = ? RETURNING ${RETURNING_COLS}`,
      )
      .bind(mode, now, sid)
      .first();
  }
  if (!updated) throw new AppError('DATA_NOT_FOUND', 'segment 已不存在');
  return json(updated);
};
