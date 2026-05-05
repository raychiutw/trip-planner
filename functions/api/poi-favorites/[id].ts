/**
 * DELETE /api/poi-favorites/:id — 移除收藏
 *
 * 僅允許 owner（resolved userId 相符）或 admin 刪除；他人 → 403；不存在 → 404。
 *
 * Companion 分支（poi-favorites-rename §8）：
 *   - body { companionRequestId } + header X-Request-Scope: companion
 *   - 走 requireFavoriteActor(action='favorite_delete')：寫 companion_request_actions
 *     UNIQUE 衝突 → 409 COMPANION_QUOTA_EXCEEDED；gate 失敗 → 401
 *   - companion 模式 ownership 用 resolved userId（submitter）比 row.user_id
 *   - 成功刪除寫 audit_log（changedBy='companion:<id>', tripId='system:companion'）
 */
import { AppError } from '../_errors';
import { logAudit } from '../_audit';
import { parseIntParam, parseJsonBody } from '../_utils';
import { assertFavoriteOwnership, requireFavoriteActor } from '../_companion';
import type { Env, AuthData } from '../_types';

interface DeleteBody {
  companionRequestId?: number;
}

export const onRequestDelete: PagesFunction<Env, 'id'> = async (context) => {
  const auth = (context.data as { auth?: AuthData }).auth ?? null;
  const id = parseIntParam(context.params.id as string);
  if (!id) throw new AppError('DATA_VALIDATION', 'id 須為正整數');

  // body 為 optional（V2 user DELETE 通常無 body）。companion 模式需要 companionRequestId。
  let body: DeleteBody | null = null;
  const headerScope = context.request.headers.get('X-Request-Scope');
  if (headerScope === 'companion') {
    body = await parseJsonBody<DeleteBody>(context.request).catch(() => ({} as DeleteBody));
  }

  // resolve effective actor（companion → submitter；V2 user → auth.userId；否則 401）
  const actor = await requireFavoriteActor(context, body, 'favorite_delete');

  const row = await context.env.DB
    .prepare('SELECT user_id FROM poi_favorites WHERE id = ?')
    .bind(id)
    .first<{ user_id: string | null }>();
  if (!row) throw new AppError('DATA_NOT_FOUND', '找不到該收藏');

  assertFavoriteOwnership(actor, auth, row.user_id);

  await context.env.DB
    .prepare('DELETE FROM poi_favorites WHERE id = ?')
    .bind(id)
    .run();

  // companion 模式寫 audit_log（fire-and-forget 不阻塞 response）
  if (actor.isCompanion) {
    context.waitUntil(
      logAudit(context.env.DB, {
        tripId: actor.audit.tripId,
        tableName: 'poi_favorites',
        recordId: id,
        action: 'delete',
        changedBy: actor.audit.changedBy,
        requestId: actor.requestId,
      }),
    );
  }

  return new Response(null, { status: 204 });
};
