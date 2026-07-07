/**
 * POST /api/trips/:id/notes/:type/generate — trigger AI generation
 *
 * v2.34.x 行程筆記 PR9 — B-2 phase first endpoint。
 *
 * type 限 'lodging-tips' / 'tips' / 'emergency'（對齊 design doc Premise 6 +
 * trip_note_ai_jobs.doc_type CHECK enum）。
 *
 * Flow（trip_requests + linkage job pattern）：
 *   1. INSERT trip_requests (message = '[行程筆記-{type}] ...' AI prompt) RETURNING id
 *   2. INSERT trip_note_ai_jobs (request_id, trip_id, doc_type, status='pending')
 *      → linkage row 對齊 CR-8 confused-deputy fix
 *   3. Fire-and-forget trigger Mac Mini api-server
 *   4. Return { jobId, requestId, status: 'pending' }
 *
 * 30-second debounce：同 trip + 同 type 30s 內 pending job 直接回該 job（防 user
 * 多次 click AI button 浪費 quota）。
 *
 * Frontend (PR12) polling /requests/:id 直到 completed/failed，
 * PATCH /api/requests/:id hook (PR10) 看 trip_note_ai_jobs linkage 觸發
 * applyNotesGenerationCompletion(doc_type, findings) 分派到 trip_pretrip_notes /
 * trip_emergency_contacts。
 */

import { hasWritePermission, requireAuth } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { json } from '../../../../_utils';
import { recordEmailEvent } from '../../../../_audit';
import type { Env } from '../../../../_types';

const VALID_TYPES = ['lodging-tips', 'tips', 'emergency'] as const;
type GenType = (typeof VALID_TYPES)[number];

// AI prompts per type — 對齊 design doc Premise 6
// Backend 統一回繁體中文。Schema 對齊 trip_pretrip_notes / trip_emergency_contacts INSERT。
const PROMPTS: Record<GenType, string> = {
  'lodging-tips': `[行程筆記-lodging-tips] 請以資深旅遊規劃師角度，為此行程的住宿地點生成「住宿在地建議」項目（5-8 項），寫進「行前須知」section。

寫作維度：
- 鄰近景點 / 交通工具到主要 destination
- 早餐 / 24h 超商 / 便利店步行距離
- 寄物 / 停車 / 退房後行李寄存政策
- 飯店在地特色（例：早餐附近、附泡湯、近商場）
- 注意事項（深夜出入、安靜時段、是否禁帶外食）

**輸出格式**：純 JSON array，不要 markdown fence。
每 entry 含 \`title\`（≤20 字繁中）+ \`content\`（80-150 字繁中，可用 \`- bullet\` 列點）+ \`section\`（固定「住宿在地」）。

Schema:
\`\`\`json
[{ "title": "string", "content": "string", "section": "住宿在地" }]
\`\`\``,

  'tips': `[行程筆記-tips] 請以資深旅遊規劃師角度，為此行程生成「行前須知」一般項目（5-8 項）。

寫作維度：
- 貨幣兌換建議（匯率、ATM / 現金 / 信用卡接受度）
- 插頭 / 電壓 / 變壓器
- 簽證 / 護照效期 / 入境手續
- 通訊 / SIM / eSIM / 漫遊
- 禮儀 / 禁忌 / 文化注意
- 治安 / 詐騙警示
- 退稅 / 購物注意

**輸出格式**：純 JSON array，不要 markdown fence。
每 entry 含 \`title\`（≤20 字繁中）+ \`content\`（80-150 字繁中，可用 \`- bullet\` 列點）+ \`section\`（簡短分類，例「貨幣」「通訊」）。

Schema:
\`\`\`json
[{ "title": "string", "content": "string", "section": "string" }]
\`\`\``,

  'emergency': `[行程筆記-emergency] 請為此行程生成「緊急聯絡」項目（5-8 項）。專注於當地實用的緊急電話：

必含：
- 警察報案專線（kind="police"）
- 救護 / 醫療 / 消防（kind="medical"）
- 駐外館處 / 總領事館 / 辦事處（kind="embassy"）

選含（依目的地）：
- 海岸警備 / 旅遊救援（kind="other"）
- 國際 SOS / 旅遊險諮詢（kind="insurance"）

**輸出格式**：純 JSON array，不要 markdown fence。
每 entry 含 \`name\`（駐外館處全名 / 「日本警察」等）+ \`phone\`（含國碼，例 +81-3-3280-7917 或 短碼 110）+ \`kind\`（'police' / 'medical' / 'embassy' / 'insurance' / 'other'）+ \`relationship\`（用途，例「報案 / 失竊」「24h 急診」）。

Schema:
\`\`\`json
[{ "name": "string", "phone": "string", "kind": "string", "relationship": "string" }]
\`\`\``,
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = requireAuth(context);
  const tripId = params.id as string;
  const type = params.type as string;

  if (!(VALID_TYPES as readonly string[]).includes(type)) {
    throw new AppError('DATA_VALIDATION', `type 必須是 ${VALID_TYPES.join('/')} 之一`);
  }
  const docType = type as GenType;

  if (!(await hasWritePermission(env.DB, auth, tripId))) {
    throw new AppError('PERM_DENIED');
  }

  // Debounce：同 trip+type 30s 內 pending → 直接回 existing job
  const existing = await env.DB
    .prepare(
      `SELECT * FROM trip_note_ai_jobs
       WHERE trip_id = ? AND doc_type = ? AND status = 'pending'
         AND created_at > datetime('now', '-30 seconds')`,
    )
    .bind(tripId, docType)
    .first<{ id: number; request_id: number; status: string }>();

  if (existing) {
    return json({
      jobId: existing.id,
      requestId: existing.request_id,
      status: existing.status,
      tripId,
      docType,
    }, 200);
  }

  // 1. INSERT trip_requests with prefixed AI prompt
  const reqRow = await env.DB
    .prepare('INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?) RETURNING id')
    .bind(tripId, PROMPTS[docType], auth.email)
    .first<{ id: number }>();
  if (!reqRow) throw new AppError('SYS_DB_ERROR', '建立 AI 請求失敗');
  const requestId = reqRow.id;

  // 2. INSERT linkage row — confused-deputy 防護 (v2.33.102 CR-8 pattern)
  const jobRow = await env.DB
    .prepare(
      `INSERT INTO trip_note_ai_jobs
         (request_id, trip_id, doc_type, status, inserted_count, error_message, created_at)
       VALUES (?, ?, ?, 'pending', 0, NULL, datetime('now'))
       RETURNING id`,
    )
    .bind(requestId, tripId, docType)
    .first<{ id: number }>();
  if (!jobRow) throw new AppError('SYS_DB_ERROR', '建立 AI job linkage 失敗');

  // 3. Fire-and-forget trigger Mac Mini api-server
  context.waitUntil(
    (async () => {
      if (!env.TRIPLINE_API_URL) {
        await recordEmailEvent(env.DB, {
          template: 'trigger',
          recipient: 'system',
          status: 'config-missing',
          tripId,
          triggeredBy: auth.email,
          error: 'TRIPLINE_API_URL not configured (notes-generate)',
        });
        return;
      }
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const res = await fetch(env.TRIPLINE_API_URL + '/trigger?source=api', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.TRIPLINE_API_SECRET}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ requestId }),
            signal: ctrl.signal,
          });
          if (!res.ok) throw new Error(`Trigger responded ${res.status}`);
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordEmailEvent(env.DB, {
          template: 'trigger',
          recipient: 'system',
          status: 'trigger-failed',
          tripId,
          triggeredBy: auth.email,
          error: `notes-generate trigger ${msg}`,
        });
      }
    })(),
  );

  return json({
    jobId: jobRow.id,
    requestId,
    status: 'pending',
    tripId,
    docType,
  }, 202);
};
