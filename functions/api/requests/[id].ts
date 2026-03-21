/**
 * PATCH /api/requests/:id  { reply, status }
 */

import { logAudit, computeDiff } from '../_audit';
import { json } from '../_utils';
import type { Env, AuthData } from '../_types';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = (context.data as Record<string, unknown>).auth as AuthData;
  const id = params.id as string;

  // 僅 admin / service token 可 PATCH（Claude CLI 回覆用）
  if (!auth.isAdmin) {
    return json({ error: '僅管理者可更新請求' }, 403);
  }

  let body: { reply?: string; status?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: '無效的 JSON' }, 400);
  }

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

  const oldRow = await env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first() as Record<string, unknown> | null;

  values.push(id);
  const result = await env.DB
    .prepare(`UPDATE requests SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
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
    tableName: 'requests',
    recordId: Number(id),
    action: 'update',
    changedBy: auth.email,
    diffJson: oldRow ? computeDiff(oldRow, newFields) : JSON.stringify(newFields),
  });

  return json(result);
};
