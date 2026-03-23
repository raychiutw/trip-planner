/**
 * GET /api/requests?tripId=xxx&status=open
 * POST /api/requests { tripId, mode, message }
 *   (legacy fallback: title + body → message)
 */

import { logAudit } from './_audit';
import { hasPermission } from './_auth';
import { json } from './_utils';
import type { Env, AuthData } from './_types';

// GET /api/requests
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const auth = (context.data as Record<string, unknown>).auth as AuthData;
  const url = new URL(request.url);
  const tripId = url.searchParams.get('tripId');
  const status = url.searchParams.get('status');

  // admin/service token 可不帶 tripId 查詢所有 requests
  if (!tripId && !auth.isAdmin) {
    return json({ error: '缺少 tripId 參數' }, 400);
  }

  if (tripId && !await hasPermission(env.DB, auth.email, tripId, auth.isAdmin)) {
    return json({ error: '無此行程權限' }, 403);
  }

  let sql = 'SELECT * FROM requests';
  const params: string[] = [];
  const conditions: string[] = [];

  if (tripId) {
    conditions.push('trip_id = ?');
    params.push(tripId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC LIMIT 50';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
};

// POST /api/requests
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const auth = (context.data as Record<string, unknown>).auth as AuthData;

  let body: { tripId?: string; mode?: string; message?: string; title?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: '無效的 JSON' }, 400);
  }

  const { tripId, mode } = body;
  // 優先使用 message，若未提供則 fallback 合併 title + body（向下相容）
  const message = body.message
    || [body.title, body.body].filter(Boolean).join('\n')
    || '';

  if (!tripId || !mode || !message) {
    return json({ error: '缺少必要欄位：tripId, mode, message' }, 400);
  }

  if (mode !== 'trip-edit' && mode !== 'trip-plan') {
    return json({ error: 'mode 必須是 trip-edit 或 trip-plan' }, 400);
  }

  if (!await hasPermission(env.DB, auth.email, tripId, auth.isAdmin)) {
    return json({ error: '無此行程權限' }, 403);
  }

  // 30 秒去重保護：防止因網路重試或使用者重複點擊造成重複寫入
  const dupCheck = await env.DB
    .prepare(
      'SELECT COUNT(*) as cnt FROM requests WHERE trip_id = ? AND message = ? AND submitted_by = ? AND created_at > datetime(\'now\', \'-30 seconds\')'
    )
    .bind(tripId, message, auth.email)
    .first<{ cnt: number }>();

  if (dupCheck && dupCheck.cnt > 0) {
    // 已存在近期相同請求，回傳最新一筆（200 而非 201）
    const existing = await env.DB
      .prepare(
        'SELECT * FROM requests WHERE trip_id = ? AND message = ? AND submitted_by = ? ORDER BY created_at DESC LIMIT 1'
      )
      .bind(tripId, message, auth.email)
      .first();
    return json(existing, 200);
  }

  const result = await env.DB
    .prepare(
      'INSERT INTO requests (trip_id, mode, message, submitted_by) VALUES (?, ?, ?, ?) RETURNING *'
    )
    .bind(tripId, mode, message, auth.email)
    .first();

  const newRow = result as Record<string, unknown>;
  // logAudit 失敗不阻擋主流程，INSERT 已成功
  try {
    await logAudit(env.DB, {
      tripId,
      tableName: 'requests',
      recordId: newRow ? (newRow.id as number) : null,
      action: 'insert',
      changedBy: auth.email,
      diffJson: JSON.stringify({ mode, message: message.substring(0, 100) }),
    });
  } catch (auditErr) {
    console.error('[requests] logAudit failed (non-fatal):', auditErr);
  }

  return json(result, 201);
};
