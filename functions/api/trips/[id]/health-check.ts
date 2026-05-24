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

import { hasPermission, hasWritePermission, requireAuth} from '../../_auth';
import { AppError } from '../../_errors';
import { json } from '../../_utils';
import { recordEmailEvent } from '../../_audit';
import { alertAdminTelegram } from '../../_alert';
import type { Env } from '../../_types';

// 識別 health-check request — 寫 trip_requests.message 時固定 prefix，
// PATCH /api/requests/:id 完成 hook 看這個 prefix 識別。修改 prefix 須
// 同步更新 functions/api/requests/[id]/index.ts。
export const HEALTH_CHECK_PREFIX = '[AI 健檢]';

const HEALTH_CHECK_MESSAGE = `${HEALTH_CHECK_PREFIX} 請以資深旅遊規劃師角度審視整份行程，產出健檢報告。

**5 個審查維度（dimension 欄位用這 5 個 key）：**
1. \`timing\` — 時間配置：過密／空檔／開閉店衝突／飯店 check-in buffer
2. \`distance\` — 移動：距離過長／繞路／來回擺盪／travel min 不合理
3. \`meals\` — 餐飲：缺午晚餐／用餐間隔過長／餐廳營業時間衝突
4. \`sights\` — 景點：漏掉必排／必看景點落空／同類景點重複
5. \`hotel\` — 住宿：飯店未連線 polyline／跨日不合理／rating 偏低

**嚴重程度**：
- \`high\` = 影響行程能否成行（時間軸物理上不可行、必排景點時間衝突）
- \`medium\` = 體驗會打折（繞路 30min+、缺餐、開閉店）
- \`low\` = 可選優化（rating 偏低、可加更順路的景點）

**用詞規定（title / description / suggestion 三欄）**：
- 一律使用繁體中文。**禁用** schema field 借詞：「entry」→「景點」、「min」→「分鐘」、「km」→「公里」、「POI」→「景點」、「check-in」→「入住」、「buffer」→「緩衝時間」、「rating」→「評分」、「travel」→「移動」、「polyline」→「路線」、「alt」→「替代」。
- 範例：禁用「Day 2 重疊 entry 877」→ 用「Day 2 第 877 號景點重疊」。

**回傳純 JSON array，不要 markdown fence、不要前後文字。**

Schema：
\`\`\`json
[{
  "severity": "high|medium|low",
  "dimension": "timing|distance|meals|sights|hotel",
  "title": "簡短中文標題（≤15 字）",
  "description": "具體描述：哪一站、為何有問題、影響為何（≤120 字）",
  "suggestion": "建議怎麼修（≤80 字，可選）",
  "action_target": { "day": 數字, "entry_id": 數字（可選） }
}]
\`\`\`

範例（1 high + 1 low，注意全中文用詞）：
\`\`\`json
[
  {"severity":"high","dimension":"timing","title":"Day 2 飯店入住衝突","description":"Day 2 末站 17:10 結束，但移動 45 分鐘後 17:30 入住物理上不可行","suggestion":"把 Day 2 末站換成更近的景點，或前移時間","action_target":{"day":2,"entry_id":42}},
  {"severity":"low","dimension":"sights","title":"可加美麗海水族館","description":"Day 5 北上路線順路 5 公里，是沖繩必排景點","suggestion":"插入 Day 5 上午","action_target":{"day":5}}
]
\`\`\`

若行程無問題，回 \`[]\`。`;

// GET — 取最新 report
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = requireAuth(context);
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
  const auth = requireAuth(context);
  const tripId = params.id as string;

  if (!(await hasWritePermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  // v2.31.58 guard：empty trip（沒有任何 entry）不該觸發 AI 健檢 —
  // 浪費 Claude quota + 給 user 沒用的 findings。Frontend 也 disable
  // 開始健檢 button，但 backend 多一層保護防 race condition / direct API call。
  // trip_entries 沒 trip_id 欄位，要 JOIN trip_days（沿用 _auth.ts:89 同 pattern）。
  const entryCount = await env.DB
    .prepare(
      `SELECT COUNT(*) as cnt FROM trip_entries e
       JOIN trip_days d ON e.day_id = d.id
       WHERE d.trip_id = ?`,
    )
    .bind(tripId)
    .first<{ cnt: number }>();
  if (!entryCount || entryCount.cnt === 0) {
    throw new AppError('TRIP_EMPTY');
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
    // v2.33.85 bug fix: 之前用 auth.email 寫進 user_id（FK to users.id），
    // migration 0069 加 FK 後此 INSERT FK-fail。Email ≠ userId（users.id 是 uuid）。
    .bind(tripId, auth.userId)
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
        userId: auth.userId,
        status: 'pending',
        requestId,
        findings: [],
        createdAt: new Date().toISOString(),
      },
    },
    202,
  );
};
