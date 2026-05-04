/**
 * GET /api/requests?tripId=xxx&status=open&limit=10&sort=desc&before=<created_at>&beforeId=<id>&after=<created_at>&afterId=<id>
 * POST /api/requests { tripId, mode, message }
 *   (legacy fallback: title + body → message)
 *
 * 分頁：cursor-based
 *   - limit: 每頁筆數（預設 10，最大 50）
 *   - sort: asc | desc（預設 desc）
 *   - before/beforeId: 往舊方向 cursor（DESC 模式）
 *   - after/afterId: 往舊方向 cursor（ASC 模式，用於聊天式列表向上載入）
 *   - 回傳 { items: [...], hasMore: boolean }
 *   - 不帶 limit/before/after 時向下相容（回傳全部，LIMIT 50）
 */

import { logAudit, recordEmailEvent } from './_audit';
import { alertAdminTelegram } from './_alert';
import { hasPermission, hasWritePermission } from './_auth';
import { AppError } from './_errors';
import { json, getAuth, parseJsonBody } from './_utils';
import type { Env } from './_types';

// GET /api/requests
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  const url = new URL(request.url);
  const tripId = url.searchParams.get('tripId');
  const status = url.searchParams.get('status');
  const limitParam = url.searchParams.get('limit');
  const sort = url.searchParams.get('sort') === 'asc' ? 'asc' : 'desc';
  const before = url.searchParams.get('before');
  const beforeId = url.searchParams.get('beforeId');
  const after = url.searchParams.get('after');
  const afterId = url.searchParams.get('afterId');

  // admin/service token 可不帶 tripId 查詢所有 requests
  if (!tripId && !auth.isAdmin) {
    throw new AppError('DATA_VALIDATION', '缺少 tripId 參數');
  }

  if (tripId && !await hasPermission(env.DB, auth, tripId, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  const isPaginated = limitParam !== null || before !== null || after !== null;
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
  if (after) {
    if (afterId) {
      conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
      params.push(after, after, parseInt(afterId, 10) || 0);
    } else {
      conditions.push('created_at < ?');
      params.push(after);
    }
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  if (sort === 'asc') {
    sql += ' ORDER BY created_at ASC, id ASC';
  } else {
    sql += ' ORDER BY created_at DESC, id DESC';
  }
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
  if (!auth) throw new AppError('AUTH_REQUIRED');

  type RequestBody = { tripId?: string; mode?: string; message?: string; title?: string; body?: string };
  const body = await parseJsonBody<RequestBody>(request);

  const { tripId } = body;
  // 優先使用 message，若未提供則 fallback 合併 title + body（向下相容）
  const message = body.message
    || [body.title, body.body].filter(Boolean).join('\n')
    || '';

  if (!tripId || !message) {
    throw new AppError('DATA_VALIDATION', '缺少必要欄位：tripId, message');
  }

  // mode is vestigial (migration 0048 phase 1 nullable; phase 2 will DROP COLUMN).
  if (!await hasWritePermission(env.DB, auth, tripId, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
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
      'INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?) RETURNING *'
    )
    .bind(tripId, message, auth.email)
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
      diffJson: JSON.stringify({ message: message.substring(0, 100) }),
    });
  } catch (auditErr) {
    console.error('[requests] logAudit failed (non-fatal):', auditErr);
  }

  // Fire-and-forget: 觸發 Mac Mini API server 處理（cron 15min 兜底）
  // 2026-05-02 silent-fail fix: 失敗時 audit_log + Telegram alert，不再 silent catch{}
  // (D1 audit 顯示 7 天 zero source=api → 既有 catch{} 完全掩蓋了 fetch 失敗)
  context.waitUntil(
    (async () => {
      const requestId = newRow ? (newRow as Record<string, unknown>).id : null;
      if (!env.TRIPLINE_API_URL) {
        await recordEmailEvent(env.DB, {
          template: 'trigger',
          recipient: 'system',
          status: 'config-missing',
          tripId,
          triggeredBy: auth.email,
          error: 'TRIPLINE_API_URL not configured',
        });
        await alertAdminTelegram(
          env,
          `即時觸發 config 缺失（cron 15min 兜底）: trip=${tripId}, request=${requestId} (TRIPLINE_API_URL not set)`,
        );
        return;
      }
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(env.TRIPLINE_API_URL + '/trigger?source=api', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.TRIPLINE_API_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          throw new Error(`Trigger responded ${res.status}`);
        }
        // 成功不寫 audit — trigger 量大，正常情況無需 trail
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordEmailEvent(env.DB, {
          template: 'trigger',
          recipient: 'system',
          status: 'trigger-failed',
          tripId,
          triggeredBy: auth.email,
          error: msg,
        });
        await alertAdminTelegram(
          env,
          `即時觸發失敗（cron 15min 兜底）: trip=${tripId}, request=${requestId} (${msg})`,
        );
      }
    })(),
  );

  return json(result, 201);
};
