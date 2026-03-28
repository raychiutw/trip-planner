/**
 * GET /api/requests?tripId=xxx&status=open&limit=10&before=<created_at>&beforeId=<id>
 * POST /api/requests { tripId, mode, message }
 *   (legacy fallback: title + body → message)
 *
 * 分頁：cursor-based (created_at DESC, id DESC)
 *   - limit: 每頁筆數（預設 10，最大 50）
 *   - before: created_at cursor（ISO timestamp）
 *   - beforeId: id cursor（同秒 tiebreaker）
 *   - 回傳 { items: [...], hasMore: boolean }
 *   - 不帶 limit/before 時向下相容（回傳全部，LIMIT 50）
 */

import { logAudit } from './_audit';
import { hasPermission } from './_auth';
import { json, getAuth, parseJsonBody } from './_utils';
import type { Env } from './_types';

// GET /api/requests
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);
  const url = new URL(request.url);
  const tripId = url.searchParams.get('tripId');
  const status = url.searchParams.get('status');
  const limitParam = url.searchParams.get('limit');
  const before = url.searchParams.get('before');
  const beforeId = url.searchParams.get('beforeId');

  // admin/service token 可不帶 tripId 查詢所有 requests
  if (!tripId && !auth.isAdmin) {
    return json({ error: '缺少 tripId 參數' }, 400);
  }

  if (tripId && !await hasPermission(env.DB, auth.email, tripId, auth.isAdmin)) {
    return json({ error: '無此行程權限' }, 403);
  }

  const isPaginated = limitParam !== null || before !== null;
  const limit = Math.min(Math.max(parseInt(limitParam || '10', 10) || 10, 1), 50);

  let sql = 'SELECT * FROM trip_requests';
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (tripId) {
    conditions.push('trip_id = ?');
    params.push(tripId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (before) {
    if (beforeId) {
      conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
      params.push(before, before, parseInt(beforeId, 10) || 0);
    } else {
      conditions.push('created_at < ?');
      params.push(before);
    }
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC, id DESC';
  sql += isPaginated ? ` LIMIT ${limit + 1}` : ' LIMIT 50';

  const { results } = await env.DB.prepare(sql).bind(...params).all();

  if (isPaginated) {
    const hasMore = (results ?? []).length > limit;
    const items = hasMore ? (results ?? []).slice(0, limit) : (results ?? []);
    return json({ items, hasMore });
  }

  // 向下相容：不帶分頁參數時回傳陣列
  return json(results);
};

// POST /api/requests
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const auth = getAuth(context);
  if (!auth) return json({ error: '未認證' }, 401);

  type RequestBody = { tripId?: string; mode?: string; message?: string; title?: string; body?: string };
  const bodyOrError = await parseJsonBody<RequestBody>(request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

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
  const existing = await env.DB
    .prepare(
      'SELECT * FROM trip_requests WHERE trip_id = ? AND message = ? AND submitted_by = ? AND created_at > datetime(\'now\', \'-30 seconds\') ORDER BY created_at DESC LIMIT 1'
    )
    .bind(tripId, message, auth.email)
    .first();

  if (existing) {
    // 已存在近期相同請求，回傳最新一筆（200 而非 201）
    return json(existing, 200);
  }

  const result = await env.DB
    .prepare(
      'INSERT INTO trip_requests (trip_id, mode, message, submitted_by) VALUES (?, ?, ?, ?) RETURNING *'
    )
    .bind(tripId, mode, message, auth.email)
    .first();

  const newRow = result as Record<string, unknown>;
  // logAudit 失敗不阻擋主流程，INSERT 已成功
  try {
    await logAudit(env.DB, {
      tripId,
      tableName: 'trip_requests',
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
