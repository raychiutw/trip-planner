/**
 * PATCH /api/requests/:id  { reply, status, processed_by }
 */

import { logAudit, computeDiff } from '../../_audit';
import { AppError } from '../../_errors';
import { sanitizeReply } from '../../_validate';
import { json, getAuth, parseJsonBody } from '../../_utils';
import type { Env } from '../../_types';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  const id = params.id as string;

  // 僅 admin / service token 可 PATCH（Claude CLI 回覆用）
  if (!auth.isAdmin) {
    throw new AppError('PERM_ADMIN_ONLY');
  }

  const body = await parseJsonBody<{ reply?: string; status?: string; processed_by?: string }>(context.request);

  const updates: string[] = [];
  const values: string[] = [];

  if (body.reply !== undefined) {
    updates.push('reply = ?');
    values.push(sanitizeReply(body.reply));
  }
  // Fetch once for both status validation and audit diff
  const oldRow = await env.DB.prepare('SELECT * FROM trip_requests WHERE id = ?').bind(id).first() as Record<string, unknown> | null;

  if (body.status !== undefined) {
    const STATUS_ORDER = ['open', 'processing', 'completed', 'failed'] as const;
    if (!STATUS_ORDER.includes(body.status as typeof STATUS_ORDER[number])) {
      throw new AppError('DATA_VALIDATION', 'status 必須是 open、processing、completed 或 failed');
    }

    // 驗證 status 只能往前推進，不可回退（failed 例外：任何狀態都可標記失敗）
    if (oldRow && body.status !== 'failed') {
      const oldIdx = STATUS_ORDER.indexOf((oldRow.status as string) as typeof STATUS_ORDER[number]);
      const newIdx = STATUS_ORDER.indexOf(body.status as typeof STATUS_ORDER[number]);
      if (newIdx >= 0 && oldIdx >= 0 && newIdx < oldIdx) {
        throw new AppError('DATA_VALIDATION', `status 不可從 ${oldRow.status} 退回 ${body.status}`);
      }
    }

    updates.push('status = ?');
    values.push(body.status);
  }

  if (body.processed_by !== undefined) {
    const VALID_PROCESSORS = ['api', 'job'] as const;
    if (!VALID_PROCESSORS.includes(body.processed_by as typeof VALID_PROCESSORS[number])) {
      throw new AppError('DATA_VALIDATION', 'processed_by 必須是 api 或 job');
    }
    updates.push('processed_by = ?');
    values.push(body.processed_by);
  }

  if (updates.length === 0) {
    throw new AppError('DATA_VALIDATION', '沒有要更新的欄位');
  }

  // 每次 PATCH 自動更新 updated_at
  updates.push("updated_at = datetime('now')");

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
