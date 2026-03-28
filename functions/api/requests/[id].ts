/**
 * PATCH /api/requests/:id  { reply, status }
 */

import { logAudit, computeDiff } from '../_audit';
import { json, getAuth, parseJsonBody } from '../_utils';
import type { Env } from '../_types';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);
  const id = params.id as string;

  // 僅 admin / service token 可 PATCH（Claude CLI 回覆用）
  if (!auth.isAdmin) {
    return json({ error: '僅管理者可更新請求' }, 403);
  }

  const bodyOrError = await parseJsonBody<{ reply?: string; status?: string }>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  const updates: string[] = [];
  const values: string[] = [];

  if (body.reply !== undefined) {
    updates.push('reply = ?');
    values.push(body.reply);
  }
  if (body.status !== undefined) {
    const validStatuses = ['open', 'received', 'processing', 'completed'];
    if (!validStatuses.includes(body.status)) {
      return json({ error: 'status 必須是 open、received、processing 或 completed' }, 400);
    }
    updates.push('status = ?');
    values.push(body.status);
  }

  if (updates.length === 0) {
    return json({ error: '沒有要更新的欄位' }, 400);
  }

  const oldRow = await env.DB.prepare('SELECT * FROM trip_requests WHERE id = ?').bind(id).first() as Record<string, unknown> | null;

  values.push(id);
  const result = await env.DB
    .prepare(`UPDATE trip_requests SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first();

  if (!result) {
    return json({ error: '找不到該請求' }, 404);
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
