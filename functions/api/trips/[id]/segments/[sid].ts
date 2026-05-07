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
 * mode='driving' / 'walking' 時 min 可選；未提供 → 保留現值（待下次 recompute 重算
 * 但 mode_source='user' 會跳過 — 實務上 user override mode 不重算 min，以
 * 「手動覆寫優先」為準）。
 *
 * Auth: trip write permission.
 */

import { hasWritePermission } from '../../../_auth';
import { AppError } from '../../../_errors';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../_utils';
import type { Env } from '../../../_types';

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
  if (typeof body.min === 'number' && Number.isFinite(body.min) && body.min >= 0) {
    // user 提供 min → source='manual'（不論 mode；user 手動填的數字都是 manual 來源）
    const newSource = 'manual';
    await db
      .prepare(
        `UPDATE trip_segments
         SET mode = ?, mode_source = 'user', min = ?, source = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(mode, Math.round(body.min), newSource, now, sid)
      .run();
  } else {
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
