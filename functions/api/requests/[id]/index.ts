/**
 * GET /api/requests/:id
 * PATCH /api/requests/:id  { reply, status, processed_by }
 */

import { logAudit, computeDiff } from '../../_audit';
import { hasPermission } from '../../_auth';
import { AppError } from '../../_errors';
import { sanitizeReply } from '../../_validate';
import { json, getAuth, parseJsonBody } from '../../_utils';
import { HEALTH_CHECK_PREFIX } from '../../trips/[id]/health-check';
import type { Env } from '../../_types';

// GET /api/requests/:id
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  const id = params.id as string;

  // 2026-05-07：LEFT JOIN users 取 display_name 給 chat avatar / sender label。
  const row = await env.DB
    .prepare('SELECT r.*, u.display_name AS submitted_by_display_name FROM trip_requests r LEFT JOIN users u ON u.email = r.submitted_by WHERE r.id = ?')
    .bind(id)
    .first();
  if (!row) throw new AppError('DATA_NOT_FOUND');

  const tripId = (row as Record<string, unknown>).trip_id as string;
  if (!await hasPermission(env.DB, auth, tripId, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  return json(row);
};

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

  // AI 健檢 hook：若這是 health-check request（message 開頭 [AI 健檢]）且
  // status 推到 completed/failed，把 reply 解析成 findings JSON 寫進
  // trip_health_reports。寫失敗只 log，不阻擋 PATCH success — chat trail 已留。
  const message = (result as Record<string, unknown>).message as string | undefined;
  if (message?.startsWith(HEALTH_CHECK_PREFIX)) {
    const newStatus = (result as Record<string, unknown>).status as string;
    if (newStatus === 'completed' || newStatus === 'failed') {
      try {
        await applyHealthCheckCompletion(env.DB, tripId, Number(id), result as Record<string, unknown>);
      } catch (hookErr) {
        console.error('[requests] health-check completion hook failed:', hookErr);
      }
    }
  }

  return json(result);
};

/**
 * Parse trip_requests.reply as JSON array of findings and write into
 * trip_health_reports. Reply 應該是純 JSON array（per HEALTH_CHECK_MESSAGE
 * 指示），但 Claude 偶爾會包 ```json fence 或加 prose — 寬鬆 extract 第一個
 * `[...]` block。
 */
async function applyHealthCheckCompletion(
  db: D1Database,
  tripId: string,
  requestId: number,
  request: Record<string, unknown>,
) {
  const status = request.status as string;
  if (status === 'failed') {
    const errMsg = (request.reply as string) || '健檢失敗';
    await db
      .prepare(
        `UPDATE trip_health_reports
           SET status = 'failed', error_message = ?, completed_at = datetime('now')
         WHERE trip_id = ? AND request_id = ?`,
      )
      .bind(errMsg.slice(0, 500), tripId, requestId)
      .run();
    return;
  }

  const reply = (request.reply as string) || '';
  const findings = parseFindings(reply);
  await db
    .prepare(
      `UPDATE trip_health_reports
         SET status = 'completed', findings_json = ?, error_message = NULL, completed_at = datetime('now')
       WHERE trip_id = ? AND request_id = ?`,
    )
    .bind(JSON.stringify(findings), tripId, requestId)
    .run();
}

function parseFindings(reply: string): unknown[] {
  if (!reply.trim()) return [];
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(reply);
    if (Array.isArray(parsed)) return sanitizeFindings(parsed);
  } catch {
    // fall through to bracket extraction
  }
  // Extract first [...] block from prose/fence wrapper
  const match = reply.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return sanitizeFindings(parsed);
    } catch {
      // give up
    }
  }
  return [];
}

function sanitizeFindings(arr: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    const sev = typeof f.severity === 'string' ? f.severity.toLowerCase() : '';
    if (sev !== 'high' && sev !== 'medium' && sev !== 'low') continue;
    const title = typeof f.title === 'string' ? f.title.slice(0, 60) : '';
    const description = typeof f.description === 'string' ? f.description.slice(0, 400) : '';
    if (!title) continue;
    const cleaned: Record<string, unknown> = { severity: sev, title, description };

    // v2.31.1 Phase 2: dimension + suggestion 欄位（皆可選，僅當合法值時保留）
    const VALID_DIMENSIONS = ['timing', 'distance', 'meals', 'sights', 'hotel'] as const;
    if (typeof f.dimension === 'string') {
      const dim = f.dimension.toLowerCase();
      if ((VALID_DIMENSIONS as readonly string[]).includes(dim)) {
        cleaned.dimension = dim;
      }
    }
    if (typeof f.suggestion === 'string' && f.suggestion.trim()) {
      cleaned.suggestion = f.suggestion.slice(0, 200);
    }

    const action = f.action_target && typeof f.action_target === 'object'
      ? f.action_target as Record<string, unknown>
      : null;
    if (action) {
      const day = typeof action.day === 'number' ? action.day : null;
      const entryId = typeof action.entry_id === 'number' ? action.entry_id : null;
      if (day !== null || entryId !== null) {
        cleaned.action_target = { ...(day !== null && { day }), ...(entryId !== null && { entry_id: entryId }) };
      }
    }
    out.push(cleaned);
  }
  return out;
}
