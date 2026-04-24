/**
 * DELETE /api/saved-pois/:id — 移除收藏
 *
 * 僅允許 owner（email 相符）或 admin 刪除；他人 → 403；不存在 → 404。
 */
import { AppError } from '../_errors';
import { requireAuth } from '../_auth';
import { parseIntParam } from '../_utils';
import type { Env } from '../_types';

export const onRequestDelete: PagesFunction<Env, 'id'> = async (context) => {
  const auth = requireAuth(context);
  const id = parseIntParam(context.params.id as string);
  if (!id) throw new AppError('DATA_VALIDATION', 'id 須為正整數');

  const row = await context.env.DB
    .prepare('SELECT email FROM saved_pois WHERE id = ?')
    .bind(id)
    .first<{ email: string }>();
  if (!row) throw new AppError('DATA_NOT_FOUND', '找不到該收藏');

  if (row.email !== auth.email && !auth.isAdmin) {
    throw new AppError('PERM_DENIED');
  }

  await context.env.DB
    .prepare('DELETE FROM saved_pois WHERE id = ?')
    .bind(id)
    .run();

  return new Response(null, { status: 204 });
};
