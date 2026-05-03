/**
 * DELETE /api/saved-pois/:id — 移除收藏
 *
 * 僅允許 owner（email 或 user_id 相符）或 admin 刪除；他人 → 403；不存在 → 404。
 *
 * V2 cutover dual-read: ownership check 同時看 email 與 user_id，phase 2 drop
 * email column 後改 user_id only。
 */
import { AppError } from '../_errors';
import { requireAuth } from '../_auth';
import { parseIntParam } from '../_utils';
import type { Env } from '../_types';

export const onRequestDelete: PagesFunction<Env, 'id'> = async (context) => {
  const auth = requireAuth(context);
  const id = parseIntParam(context.params.id as string);
  if (!id) throw new AppError('DATA_VALIDATION', 'id 須為正整數');

  // V2 cutover phase 2: 純 user_id-keyed ownership check (email column dropped)
  const row = await context.env.DB
    .prepare('SELECT user_id FROM saved_pois WHERE id = ?')
    .bind(id)
    .first<{ user_id: string | null }>();
  if (!row) throw new AppError('DATA_NOT_FOUND', '找不到該收藏');

  const ownByUid = auth.userId !== null && row.user_id === auth.userId;
  if (!ownByUid && !auth.isAdmin) {
    throw new AppError('PERM_DENIED');
  }

  await context.env.DB
    .prepare('DELETE FROM saved_pois WHERE id = ?')
    .bind(id)
    .run();

  return new Response(null, { status: 204 });
};
