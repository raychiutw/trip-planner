/**
 * /api/account/ai-data-consent — AI 資料同意（spec #1553、ADR-0012；新 api 有同契約的一份）。
 *
 * 與 /api/account/ai-authorization（AI 操作授權）是兩個獨立概念，互不取代。
 *
 * GET    → 狀態（none／valid／stale／withdrawn）、目前版本、已接受版本與時間、目前版本的說明文字、enforced
 * POST   { version } → 同意「使用者實際看到的版本」；未知或與目前版本不符 → 409 AI_CONSENT_VERSION_MISMATCH（不寫入）；冪等
 * DELETE → 撤回（冪等）。撤回後新請求立即被拒絕；排隊中尚未開始的請求被終結（已開始的不保證能停）。
 *
 * 旗標只決定三個受管制入口檢不檢查；文案未填妥時 POST 回 409 AI_CONSENT_NOT_READY（GET／DELETE 照常）。
 * Auth: session cookie 的本人（requireAccountActor）；只寫呼叫者自己。
 */
import { requireAccountActor } from './_accountActor';
import { AppError } from '../_errors';
import { parseJsonBody, rawJson } from '../_utils';
import { updateRequest } from '../_requestTermination';
import { currentConsentText, getConsentState, isConsentEnforced, isConsentTextComplete, recordAccepted, recordWithdrawn } from '../_aiDataConsent';
import { CURRENT_CONSENT_VERSION } from '../_aiDataConsentText';
import type { Env } from '../_types';

async function stateResponse(env: Env, userId: string): Promise<Response> {
  const state = await getConsentState(env.DB, userId);
  return rawJson({ ...state, text: currentConsentText(), enforced: isConsentEnforced(env) });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { uid } = await requireAccountActor(context);
  return stateResponse(context.env, uid);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { uid } = await requireAccountActor(context);
  const body = await parseJsonBody<{ version?: unknown }>(context.request);
  if (typeof body?.version !== 'string' || !body.version) throw new AppError('DATA_VALIDATION', '缺少 version');
  if (body.version !== CURRENT_CONSENT_VERSION) {
    throw new AppError('AI_CONSENT_VERSION_MISMATCH', `目前版本是 ${CURRENT_CONSENT_VERSION}`, { currentVersion: CURRENT_CONSENT_VERSION });
  }
  // 文案還有待填占位符時不得記錄同意（使用者不能對一份未完成的說明按「同意」）
  if (!isConsentTextComplete()) {
    throw new AppError('AI_CONSENT_NOT_READY', '說明文字尚未完成', { currentVersion: CURRENT_CONSENT_VERSION });
  }
  await recordAccepted(context.env.DB, uid);
  return stateResponse(context.env, uid);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { uid } = await requireAccountActor(context);
  const wrote = await recordWithdrawn(context.env.DB, uid);
  // 已是 withdrawn（重試）也再清一次：先前清理若中途失敗（500），重試時 wrote=false 不能讓排隊請求永遠留著。
  // terminateQueuedRequests 只動 status='open' 的列、onlyIfActive，重複執行是冪等的；從未同意（none）不終結任何請求。
  if (wrote || (await getConsentState(context.env.DB, uid)).status === 'withdrawn') await terminateQueuedRequests(context.env.DB, uid);
  return stateResponse(context.env, uid);
};

/** 完整流程每筆約 5–8 個 D1 subrequest，Pages 上限 50：無連動的一般聊天請求只對前 FULL_CLOSE_LIMIT 筆走完整流程。 */
const FULL_CLOSE_LIMIT = 5;
/** D1 單一語句最多 100 個綁定參數，留一點餘裕。 */
const D1_BIND_BATCH = 90;
/** 寫回 chat 的說明：這些請求從未開始，不是「停止等待」（預設的 cancelled 文案會讓人以為 AI 可能已動過行程）。 */
const WITHDRAWN_REPLY = 'AI 資料同意已撤回，這個請求沒有被處理。';

/**
 * 終結「排隊中尚未開始」（status=open）的請求：本人送出的，以及本人擁有的行程上別人送出的
 * （owner 撤回後，旅伴的請求也不該再被處理）。processing 的不動——已開始的工作不保證能停（ADR-0007）。
 * 有連動健檢報告／筆記 job 的請求一律走完整流程（updateRequest 會一併收尾那些 job；每個行程同類只會有一個進行中，數量有限）。
 * 無連動的一般聊天請求：前 FULL_CLOSE_LIMIT 筆走完整流程（留 audit），其餘以批次 UPDATE 收尾——這些超額的請求不留 audit 紀錄。
 */
async function terminateQueuedRequests(db: D1Database, userId: string): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT r.*,
              (EXISTS (SELECT 1 FROM trip_note_ai_jobs j WHERE j.request_id = r.id)
               OR EXISTS (SELECT 1 FROM trip_health_reports h WHERE h.request_id = r.id)) AS linked
       FROM trip_requests r
       WHERE r.status = 'open'
         AND (r.submitted_by = (SELECT email FROM users WHERE id = ?) OR r.trip_id IN (SELECT id FROM trips WHERE owner_user_id = ?))`,
    )
    .bind(userId, userId)
    .all<Record<string, unknown>>();
  const rows = results ?? [];
  const linked = rows.filter((r) => r.linked);
  const plain = rows.filter((r) => !r.linked);
  for (const row of [...linked, ...plain.slice(0, FULL_CLOSE_LIMIT)]) {
    try {
      await updateRequest(db, row, { status: 'failed', terminalReason: 'cancelled', reply: WITHDRAWN_REPLY }, { changedBy: 'system:ai-consent-withdrawn', onlyIfActive: true });
    } catch (err) {
      // 單筆失敗不能讓後面的請求留著不終結；已寫入 withdrawn，重試 DELETE 不會再清理，所以這裡吞掉並記錄
      console.error('[ai-data-consent] terminate queued request failed:', err);
    }
  }
  const rest = plain.slice(FULL_CLOSE_LIMIT).map((r) => r.id as number);
  for (let i = 0; i < rest.length; i += D1_BIND_BATCH) {
    const ids = rest.slice(i, i + D1_BIND_BATCH);
    await db
      .prepare(`UPDATE trip_requests SET status = 'failed', terminal_reason = 'cancelled', reply = ?, updated_at = datetime('now') WHERE status = 'open' AND id IN (${ids.map(() => '?').join(',')})`)
      .bind(WITHDRAWN_REPLY, ...ids)
      .run();
  }
}
