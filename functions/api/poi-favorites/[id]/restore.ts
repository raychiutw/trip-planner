/**
 * POST /api/poi-favorites/:id/restore — 復原（undo）單筆取消的收藏。
 *
 * spec：docs/backend-tasks/2026-07-18-poi-favorites-undo-restore-api.md §2.2
 *
 * - owner-only（非 companion：restore 不在 companion action enum，只有登入 owner 可復原）。
 * - 伺服器復原期限 = 取消後 10 分鐘（App Undo 按鈕只顯 6 秒，較長 window 供網路重試）。逾期 → 410 UNDO_EXPIRED。
 * - idempotent：已復原 / 並發復原 → 回 200 與目前 row。
 * - 期間同 POI 已重新收藏（存在 active row）→ 回 200 與該 active row，不建重複（partial unique index 兜底）。
 * - 不接受 client 傳 poiId/note/owner，一律用伺服器保存的原 snapshot（防竄改）。
 */
import { AppError, buildRateLimitResponse } from '../../_errors';
import { logAudit } from '../../_audit';
import { json, parseIntParam } from '../../_utils';
import { bumpRateLimit, RATE_LIMITS } from '../../_rate_limit';
import { assertNotTripRestricted } from '../../_auth';
import { preGateFavoriteThrottle } from '../../_companion';
import type { Env, AuthData } from '../../_types';

interface FavoriteRow {
  id: number;
  user_id: string;
  poi_id: number;
  note: string | null;
  favorited_at: string;
  deleted_at: string | null;
}

const SELECT_ROW = 'SELECT id, user_id, poi_id, note, favorited_at, deleted_at FROM poi_favorites';

export const onRequestPost: PagesFunction<Env, 'id'> = async (context) => {
  const auth = (context.data as { auth?: AuthData }).auth ?? null;
  // restrict_trip token 不可碰 user 收藏（favorites user-scoped）— containment。
  if (auth) assertNotTripRestricted(auth);
  // owner-only：restore 是登入 owner 的動作，不走 companion（restore 不在 companion action enum）。
  if (!auth?.userId) throw new AppError('AUTH_REQUIRED', '需 V2 OAuth 登入才能復原收藏');
  const userId = auth.userId;

  const id = parseIntParam(context.params.id as string);
  if (!id) throw new AppError('DATA_VALIDATION', 'id 須為正整數');

  // pre-gate per-IP throttle（DoS）+ mutation rate limit（spec §5）。
  const preGate = await preGateFavoriteThrottle(context.env, context.request);
  if (preGate) return preGate;
  const bump = await bumpRateLimit(
    context.env.DB,
    `poi-favorites-restore:${userId}`,
    RATE_LIMITS.POI_FAVORITES_WRITE,
  );
  if (!bump.ok) return buildRateLimitResponse(bump.retryAfter ?? 60, { error: 'RATE_LIMITED' });

  // 撈目標（owner-scoped：id + user_id 一起 → 非 owner 或不存在皆 null → 404，不洩漏他人 row 是否存在）。
  // expired = soft-deleted 且距 deleted_at 逾 10 分鐘（1440 = 每日分鐘數；julianday 差 × 1440 = 分鐘）。
  const target = await context.env.DB
    .prepare(
      `SELECT id, user_id, poi_id, note, favorited_at, deleted_at,
              CASE WHEN deleted_at IS NOT NULL
                        AND (julianday('now') - julianday(deleted_at)) * 1440 > 10
                   THEN 1 ELSE 0 END AS expired
         FROM poi_favorites
        WHERE id = ?1 AND user_id = ?2`,
    )
    .bind(id, userId)
    .first<FavoriteRow & { expired: number }>();
  if (!target) throw new AppError('DATA_NOT_FOUND', '找不到該收藏');

  // 已是 active → idempotent，回目前 row（不動任何東西）。
  if (target.deleted_at === null) {
    return json(
      {
        id: target.id,
        user_id: target.user_id,
        poi_id: target.poi_id,
        note: target.note,
        favorited_at: target.favorited_at,
        deleted_at: null,
      },
      200,
    );
  }

  // 逾期 → 410 UNDO_EXPIRED。
  if (target.expired) throw new AppError('UNDO_EXPIRED', '復原期限已過');

  // 復原：清 deleted_at。partial unique index（active user_id+poi_id）兜底——若期間同 POI 已被
  // 重新收藏（存在 active row），此 UPDATE 會撞 UNIQUE → catch 後回該 active row。
  try {
    const restored = await context.env.DB
      .prepare('UPDATE poi_favorites SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL RETURNING *')
      .bind(id)
      .first<FavoriteRow>();
    if (restored) {
      // audit：poi_favorite 復原。audit_log.action CHECK 只允 insert/update/delete，restore 記為 update（清 deleted_at）。
      context.waitUntil(
        logAudit(context.env.DB, {
          tripId: 'user',
          tableName: 'poi_favorites',
          recordId: id,
          action: 'update',
          changedBy: auth.email ?? 'unknown',
        }),
      );
      return json(restored, 200);
    }
    // UPDATE 0 rows（並發 restore 已復原 / window 邊界）→ 回目前 row（idempotent）。
    const current = await context.env.DB.prepare(`${SELECT_ROW} WHERE id = ?`).bind(id).first<FavoriteRow>();
    if (current) return json(current, 200);
    throw new AppError('DATA_NOT_FOUND', '找不到該收藏');
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      // 期間已重新收藏同 POI → 回該 active row，不建重複（spec §2.2；最後恆 1 筆 active）。
      const active = await context.env.DB
        .prepare(`${SELECT_ROW} WHERE user_id = ? AND poi_id = ? AND deleted_at IS NULL`)
        .bind(userId, target.poi_id)
        .first<FavoriteRow>();
      if (active) return json(active, 200);
    }
    throw err;
  }
};
