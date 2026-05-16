/**
 * GET  /api/trips/:id/health-check  — 取最新 AI 健檢結果（per-trip latest）
 * POST /api/trips/:id/health-check  — 觸發新一輪 AI 健檢
 *
 * 流程（POST）：
 * 1. UPSERT trip_health_reports (status='pending', request_id=null)
 * 2. INSERT trip_requests (message='[AI 健檢] ...') — chat trail 同步
 * 3. UPDATE trip_health_reports.request_id = new request id
 * 4. Fire-and-forget trigger api-server processLoop
 * 5. Return { status: 'pending', requestId }
 *
 * Claude 完成後由 PATCH /api/requests/:id hook 把 reply JSON parse 進
 * trip_health_reports.findings_json + status='completed'。
 */

import { hasPermission, hasWritePermission } from '../../_auth';
import { AppError } from '../../_errors';
import { json, getAuth } from '../../_utils';
import { recordEmailEvent } from '../../_audit';
import { alertAdminTelegram } from '../../_alert';
import type { Env } from '../../_types';

// 識別 health-check request — 寫 trip_requests.message 時固定 prefix，
// PATCH /api/requests/:id 完成 hook 看這個 prefix 識別。修改 prefix 須
// 同步更新 functions/api/requests/[id]/index.ts。
export const HEALTH_CHECK_PREFIX = '[AI 健檢]';

const HEALTH_CHECK_MESSAGE = `${HEALTH_CHECK_PREFIX} 請以資深旅遊規劃師角度審視整份行程，找出 1) 時間配置問題（過密／空檔／開閉店）2) 移動距離過長或繞路 3) 餐飲安排缺漏 4) 漏掉的必排景點。

回傳 JSON array，**只回 JSON、不要其他文字**。schema：
[{ "severity": "high"|"medium"|"low",
   "title": "簡短中文標題（≤15 字）",
   "description": "具體描述（≤80 字）",
   "action_target": { "day": 數字, "entry_id": 數字 (可選) } }]

高 = 影響行程能否成行；中 = 體驗會打折；低 = 可選優化。沒問題回 []。`;

// GET — 取最新 report
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  const tripId = params.id as string;

  if (!(await hasPermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  const row = await env.DB
    .prepare('SELECT * FROM trip_health_reports WHERE trip_id = ?')
    .bind(tripId)
    .first();

  if (!row) {
    return json({ report: null });
  }

  // 解析 findings_json（DB 是字串）。失敗回空 array 而不爆，避免 stale row
  // 卡住整個頁面。
  let findings: unknown[] = [];
  const rawFindings = (row as Record<string, unknown>).findings_json;
  if (typeof rawFindings === 'string' && rawFindings.trim()) {
    try {
      const parsed = JSON.parse(rawFindings);
      if (Array.isArray(parsed)) findings = parsed;
    } catch {
      // findings 壞掉視為 0 項
    }
  }

  return json({
    report: {
      tripId: row.trip_id,
      userId: row.user_id,
      status: row.status,
      requestId: row.request_id,
      findings,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    },
  });
};

// POST — 觸發新一輪 health check
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  const tripId = params.id as string;

  if (!(await hasWritePermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  // 防止短時間內重複觸發：若 30 秒內已有 pending report 就直接回該 report
  const existing = await env.DB
    .prepare(
      `SELECT * FROM trip_health_reports
       WHERE trip_id = ? AND status = 'pending'
         AND created_at > datetime('now', '-30 seconds')`,
    )
    .bind(tripId)
    .first();

  if (existing) {
    return json({
      report: {
        tripId: existing.trip_id,
        userId: existing.user_id,
        status: existing.status,
        requestId: existing.request_id,
        findings: [],
        createdAt: existing.created_at,
        completedAt: existing.completed_at,
      },
    }, 200);
  }

  // 1. UPSERT trip_health_reports → status='pending'
  await env.DB
    .prepare(
      `INSERT INTO trip_health_reports
         (trip_id, user_id, status, request_id, findings_json, error_message, created_at, completed_at)
       VALUES (?, ?, 'pending', NULL, NULL, NULL, datetime('now'), NULL)
       ON CONFLICT(trip_id) DO UPDATE SET
         user_id = excluded.user_id,
         status = 'pending',
         request_id = NULL,
         findings_json = NULL,
         error_message = NULL,
         created_at = datetime('now'),
         completed_at = NULL`,
    )
    .bind(tripId, auth.email)
    .run();

  // 2. INSERT trip_requests — chat trail
  const reqRow = await env.DB
    .prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?) RETURNING *',
    )
    .bind(tripId, HEALTH_CHECK_MESSAGE, auth.email)
    .first();

  const requestId = reqRow ? (reqRow as Record<string, unknown>).id as number : null;

  // 3. Link report → request
  if (requestId !== null) {
    await env.DB
      .prepare('UPDATE trip_health_reports SET request_id = ? WHERE trip_id = ?')
      .bind(requestId, tripId)
      .run();
  }

  // 4. Fire-and-forget trigger Mac Mini API server (與 POST /api/requests 同 pattern)
  context.waitUntil(
    (async () => {
      if (!env.TRIPLINE_API_URL) {
        await recordEmailEvent(env.DB, {
          template: 'trigger',
          recipient: 'system',
          status: 'config-missing',
          tripId,
          triggeredBy: auth.email,
          error: 'TRIPLINE_API_URL not configured (health-check)',
        });
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
        if (!res.ok) throw new Error(`Trigger responded ${res.status}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordEmailEvent(env.DB, {
          template: 'trigger',
          recipient: 'system',
          status: 'trigger-failed',
          tripId,
          triggeredBy: auth.email,
          error: `health-check: ${msg}`,
        });
        await alertAdminTelegram(
          env,
          `健檢觸發失敗（cron 15min 兜底）: trip=${tripId}, request=${requestId} (${msg})`,
        );
      }
    })(),
  );

  return json(
    {
      report: {
        tripId,
        userId: auth.email,
        status: 'pending',
        requestId,
        findings: [],
        createdAt: new Date().toISOString(),
      },
    },
    202,
  );
};
