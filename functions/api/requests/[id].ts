/**
 * PATCH /api/requests/:id  { reply, status }
 */

import { logAudit, computeDiff } from '../_audit';
import { AppError } from '../_errors';
import { sanitizeReply } from '../_validate';
import { json, getAuth, parseJsonBody } from '../_utils';
import type { Env } from '../_types';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  const id = params.id as string;

  // 僅 admin / service token 可 PATCH（Claude CLI 回覆用）
  if (!auth.isAdmin) {
    throw new AppError('PERM_ADMIN_ONLY');
  }

  const bodyOrError = await parseJsonBody<{ reply?: string; status?: string }>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  const updates: string[] = [];
  const values: string[] = [];

  if (body.reply !== undefined) {
    updates.push('reply = ?');
    values.push(sanitizeReply(body.reply));
  }
  if (body.status !== undefined) {
    const validStatuses = ['open', 'received', 'processing', 'completed'];
    if (!validStatuses.includes(body.status)) {
      throw new AppError('DATA_VALIDATION', 'status 必須是 open、received、processing 或 completed');
    }
    updates.push('status = ?');
    values.push(body.status);
  }

  if (updates.length === 0) {
    throw new AppError('DATA_VALIDATION', '沒有要更新的欄位');
  }

  const oldRow = await env.DB.prepare('SELECT * FROM trip_requests WHERE id = ?').bind(id).first() as Record<string, unknown> | null;

  values.push(id);
  const result = await env.DB
    .prepare(`UPDATE trip_requests SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first();

  if (!result) {
    throw new AppError('DATA_NOT_FOUND', '找不到該請求');
  }

  const tripId = (result as Record<string, unknown>).trip_id as string;
  const newFields = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined)
  );
  await logAudit(env.DB, {
    tripId,
    tableName: 'trip_requests',
    recordId: Number(id),
    action: 'update',
    changedBy: auth.email,
    diffJson: oldRow ? computeDiff(oldRow, newFields) : JSON.stringify(newFields),
  });

  return json(result);
};
