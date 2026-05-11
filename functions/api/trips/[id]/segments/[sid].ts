/**
 * PATCH /api/trips/:id/segments/:sid
 *
 * User override 該 segment 的 travel mode。設 mode_source='user' →
 * recompute-travel 後續不會覆寫此 segment。
 *
 * Body：
 *   { mode: 'driving' | 'walking' | 'transit', min?: number }
 *
 * mode='transit' 時 min 必填（手動輸入，因 Japan Google Routes 無 transit 資料）。
 *
 * mode='driving' / 'walking' 時 min 行為（v2.26.2 修正）：
 *   - user 自帶 min → source='manual'，用 user 的值
 *   - user 不帶 min → backend call Google Routes 重算（從 from/to entry 取座標）
 *     → source='google'。這修一條 v2.26.0 EditEntryPage 切 mode 後顯示「步行 17 min /
 *     9.3 km」的 bug（17 min 是 driving 時間）。
 *   - 任一端缺 coords → 保留舊 min（fallback，不阻擋 mode 切換）
 *
 * Auth: trip write permission.
 */

import { hasWritePermission } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../_utils';
import type { Env } from '../../../_types';
import { computeRoute } from '../../../../../src/server/maps/google-client';

interface PatchBody {
  mode?: string;
  min?: number;
}

const VALID_MODES = ['driving', 'walking', 'transit'] as const;

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const tripId = context.params.id as string;
  const sidStr = context.params.sid as string;
  const sid = parseIntParam(sidStr);
  if (!tripId || sid === null) {
    throw new AppError('DATA_VALIDATION', '缺少 tripId / sid');
  }

  const db = context.env.DB;
  if (!await hasWritePermission(db, auth, tripId, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  // 驗 segment 屬於該 trip（防 IDOR）
  const seg = await db
    .prepare('SELECT id, trip_id FROM trip_segments WHERE id = ?')
    .bind(sid)
    .first<{ id: number; trip_id: string }>();
  if (!seg || seg.trip_id !== tripId) {
    throw new AppError('DATA_NOT_FOUND', '找不到此 segment');
  }

  const body = await parseJsonBody<PatchBody>(context.request);
  const mode = typeof body.mode === 'string' ? body.mode : null;
  if (!mode || !VALID_MODES.includes(mode as typeof VALID_MODES[number])) {
    throw new AppError('DATA_VALIDATION', 'mode 必須為 driving / walking / transit');
  }

  const MAX_MIN = 1440; // 24h 上界（防 abuse + 不合理輸入）
  // transit 必須帶 min（0 ≤ min ≤ 1440）
  if (mode === 'transit' && (typeof body.min !== 'number' || !Number.isFinite(body.min) || body.min < 0 || body.min > MAX_MIN)) {
    throw new AppError('DATA_VALIDATION', 'transit mode 須提供 min（0–1440 分鐘）');
  }
  // 其它 mode 若帶 min，也要在合理範圍
  if (typeof body.min === 'number' && Number.isFinite(body.min) && (body.min < 0 || body.min > MAX_MIN)) {
    throw new AppError('DATA_VALIDATION', 'min 必須在 0–1440 分鐘範圍內');
  }

  const now = Date.now();
  const userMinProvided = typeof body.min === 'number' && Number.isFinite(body.min) && body.min >= 0;

  if (userMinProvided) {
    // user 提供 min → source='manual'（不論 mode；user 手動填的數字都是 manual 來源）
    await db
      .prepare(
        `UPDATE trip_segments
         SET mode = ?, mode_source = 'user', min = ?, source = 'manual', updated_at = ?
         WHERE id = ?`,
      )
      .bind(mode, Math.round(body.min!), now, sid)
      .run();
  } else if (mode === 'driving' || mode === 'walking') {
    // v2.26.2: mode 切換不帶 min → 從 from/to entry 取座標 call Google Routes 重算
    // （否則保留舊 mode 的 min，UX 顯示「步行 17 min」這種荒謬值）
    const coordsRow = await db
      .prepare(
        `SELECT pf.lat AS f_lat, pf.lng AS f_lng, pt.lat AS t_lat, pt.lng AS t_lng
         FROM trip_segments s
         JOIN trip_entries ef ON ef.id = s.from_entry_id
         JOIN trip_entries et ON et.id = s.to_entry_id
         LEFT JOIN pois pf ON pf.id = ef.poi_id
         LEFT JOIN pois pt ON pt.id = et.poi_id
         WHERE s.id = ?`,
      )
      .bind(sid)
      .first<{ f_lat: number | null; f_lng: number | null; t_lat: number | null; t_lng: number | null }>();

    const haveCoords =
      coordsRow &&
      coordsRow.f_lat != null && coordsRow.f_lng != null &&
      coordsRow.t_lat != null && coordsRow.t_lng != null;

    if (haveCoords && context.env.GOOGLE_MAPS_API_KEY) {
      try {
        const apiMode: 'WALK' | 'DRIVE' = mode === 'walking' ? 'WALK' : 'DRIVE';
        const result = await computeRoute(
          context.env.GOOGLE_MAPS_API_KEY,
          { lat: coordsRow!.f_lat as number, lng: coordsRow!.f_lng as number },
          { lat: coordsRow!.t_lat as number, lng: coordsRow!.t_lng as number },
          apiMode,
        );
        const minutes = Math.round(result.duration_seconds / 60);
        await db
          .prepare(
            `UPDATE trip_segments
             SET mode = ?, mode_source = 'user', min = ?, distance_m = ?,
                 source = 'google', computed_at = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(mode, minutes, result.distance_meters, now, now, sid)
          .run();
      } catch {
        // Google Routes 失敗 → fallback 只改 mode 保留舊 min（不阻擋切換）
        await db
          .prepare(
            `UPDATE trip_segments
             SET mode = ?, mode_source = 'user', updated_at = ?
             WHERE id = ?`,
          )
          .bind(mode, now, sid)
          .run();
      }
    } else {
      // 缺 coords 或 API key 未設 → 只改 mode，保留舊 min
      await db
        .prepare(
          `UPDATE trip_segments
           SET mode = ?, mode_source = 'user', updated_at = ?
           WHERE id = ?`,
        )
        .bind(mode, now, sid)
        .run();
    }
  } else {
    // transit 已在前面驗證 min 必填，理論上走不到這分支；保留 defensive 路徑
    await db
      .prepare(
        `UPDATE trip_segments
         SET mode = ?, mode_source = 'user', updated_at = ?
         WHERE id = ?`,
      )
      .bind(mode, now, sid)
      .run();
  }

  const updated = await db
    .prepare(
      `SELECT id, trip_id, from_entry_id, to_entry_id, mode, mode_source,
              min, distance_m, source, computed_at, updated_at
       FROM trip_segments WHERE id = ?`,
    )
    .bind(sid)
    .first();
  return json(updated);
};
