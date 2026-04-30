/**
 * PATCH  /api/trip-ideas/:id — 更新 title/note/poi_id，或設 promoted_to_entry_id / archived_at
 * DELETE /api/trip-ideas/:id — hard delete（PATCH 設 archived_at 才是 soft archive）
 *
 * 驗證：auth 必要；需對該 idea 所屬 trip 有 permission；不存在 → 404。
 * Body 接 camelCase（frontend 習慣），handler 內部映射為 snake_case column。
 */
import { AppError } from '../_errors';
import { requireAuth, hasWritePermission } from '../_auth';
import { json, parseIntParam, parseJsonBody } from '../_utils';
import type { Env } from '../_types';

const ALLOWED_PATCH_FIELDS = ['title', 'note', 'poi_id', 'promoted_to_entry_id', 'archived_at'] as const;

/** camelCase → snake_case：`promotedToEntryId` → `promoted_to_entry_id`. */
function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
}

export const onRequestPatch: PagesFunction<Env, 'id'> = async (context) => {
  const auth = requireAuth(context);
  const id = parseIntParam(context.params.id as string);
  if (!id) throw new AppError('DATA_VALIDATION', 'id 須為正整數');

  const existing = await context.env.DB
    .prepare('SELECT trip_id FROM trip_ideas WHERE id = ?')
    .bind(id)
    .first<{ trip_id: string }>();
  if (!existing) throw new AppError('DATA_NOT_FOUND', '找不到該 idea');

  if (!(await hasWritePermission(context.env.DB, auth.email, existing.trip_id, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  const body = await parseJsonBody<Record<string, unknown>>(context.request);
  const snakeBody: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    snakeBody[toSnake(k)] = v;
  }
  const fields = Object.keys(snakeBody).filter(k => (ALLOWED_PATCH_FIELDS as readonly string[]).includes(k));
  if (fields.length === 0) throw new AppError('DATA_VALIDATION', '未提供可更新欄位');

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => snakeBody[f]);
  await context.env.DB
    .prepare(`UPDATE trip_ideas SET ${setClause} WHERE id = ?`)
    .bind(...values, id)
    .run();

  const row = await context.env.DB
    .prepare('SELECT * FROM trip_ideas WHERE id = ?')
    .bind(id)
    .first();
  return json(row);
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async (context) => {
  const auth = requireAuth(context);
  const id = parseIntParam(context.params.id as string);
  if (!id) throw new AppError('DATA_VALIDATION', 'id 須為正整數');

  const existing = await context.env.DB
    .prepare('SELECT trip_id FROM trip_ideas WHERE id = ?')
    .bind(id)
    .first<{ trip_id: string }>();
  if (!existing) throw new AppError('DATA_NOT_FOUND', '找不到該 idea');

  if (!(await hasWritePermission(context.env.DB, auth.email, existing.trip_id, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  await context.env.DB
    .prepare('DELETE FROM trip_ideas WHERE id = ?')
    .bind(id)
    .run();

  return new Response(null, { status: 204 });
};
