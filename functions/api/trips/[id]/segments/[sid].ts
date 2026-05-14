/**
 * PATCH /api/trips/:id/segments/:sid
 *
 * Set the travel mode for a segment.
 *
 * Body：
 *   { mode: 'driving' | 'walking' | 'transit', min?: number }
 *
 * v2.30.0 (mode_source DROPPED)：
 *   - mode='transit' → 必填 min（Japan Routes API 無 transit 資料），save as
 *     source='manual'，不打 Google API。切回 driving/walking 時會被 backend
 *     重算覆蓋（不會永久保留 user 的 transit min）。
 *   - mode='driving' / 'walking' → **一律忽略 body.min**，強制走 Google Routes
 *     從 from/to entry 座標重算。source='google'。若 Routes 失敗 / 缺 coords
 *     → 保留舊 min + distance_m（不阻擋切換），computed_at=NULL 標 stale。
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
const MAX_MIN = 1440;

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

  if (mode === 'transit' && (typeof body.min !== 'number' || !Number.isFinite(body.min) || body.min < 0 || body.min > MAX_MIN)) {
    throw new AppError('DATA_VALIDATION', 'transit mode 須提供 min（0–1440 分鐘）');
  }

  const now = Date.now();

  if (mode === 'transit') {
    // user 手填 min — 不打 API，distance_m 設 null（transit 無 driving distance 語意）
    await db
      .prepare(
        `UPDATE trip_segments
         SET mode = 'transit', min = ?, distance_m = NULL,
             source = 'manual', computed_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(Math.round(body.min!), now, now, sid)
      .run();
  } else {
    // driving / walking — 一律 Google Routes 重算，ignore body.min
    const coordsRow = await db
      .prepare(
        `SELECT pf.lat AS f_lat, pf.lng AS f_lng, pt.lat AS t_lat, pt.lng AS t_lng
         FROM trip_segments s
         JOIN trip_entries ef ON ef.id = s.from_entry_id
         JOIN trip_entries et ON et.id = s.to_entry_id
         LEFT JOIN trip_entry_pois tepf ON tepf.entry_id = ef.id AND tepf.sort_order = 1
         LEFT JOIN trip_entry_pois tept ON tept.entry_id = et.id AND tept.sort_order = 1
         LEFT JOIN pois pf ON pf.id = tepf.poi_id
         LEFT JOIN pois pt ON pt.id = tept.poi_id
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
             SET mode = ?, min = ?, distance_m = ?,
                 source = 'google', computed_at = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(mode, minutes, result.distance_meters, now, now, sid)
          .run();
      } catch {
        // Google Routes 失敗 → 只改 mode 保留舊 min/distance，標 stale (computed_at=NULL)
        await db
          .prepare(
            `UPDATE trip_segments
             SET mode = ?, computed_at = NULL, updated_at = ?
             WHERE id = ?`,
          )
          .bind(mode, now, sid)
          .run();
      }
    } else {
      // 缺 coords 或 API key 未設 → 只改 mode 標 stale
      await db
        .prepare(
          `UPDATE trip_segments
           SET mode = ?, computed_at = NULL, updated_at = ?
           WHERE id = ?`,
        )
        .bind(mode, now, sid)
        .run();
    }
  }

  const updated = await db
    .prepare(
      `SELECT id, trip_id, from_entry_id, to_entry_id, mode,
              min, distance_m, source, computed_at, updated_at
       FROM trip_segments WHERE id = ?`,
    )
    .bind(sid)
    .first();
  return json(updated);
};
