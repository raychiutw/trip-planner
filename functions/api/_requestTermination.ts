/**
 * Request 終結 — 見 docs/adr/0007-request-termination-cancel-and-reap.md
 *
 * 一筆 request 結束時，「結束了沒」與「為什麼結束」是兩個欄位：
 *   status          — open / processing / completed / failed（migration 0049 的四值 CHECK）
 *   terminal_reason — 本檔的 TERMINAL_REASONS（migration 0092，刻意無 CHECK constraint）
 */

export const TERMINAL_REASONS = ['cancelled', 'timed_out', 'error', 'needs_consent'] as const;
export type TerminalReason = (typeof TERMINAL_REASONS)[number];

/** 走到底、不會再有 worker 處理的 status。open / processing 是「還在跑」。 */
export const TERMINAL_STATUSES = new Set(['completed', 'failed']);

/**
 * 牆鐘兜底門檻。
 *
 * ⚠️ **必須大於 tripline-api-server.ts 的 ORPHAN_MAX_AGE_MS（90 分鐘）**，這條是
 * load-bearing 不是保守取值：短於它，健康 session 還在工作時 request 就被標終結 →
 * session 的 tripHasPending() 看不到待處理 → 自己 kill-session → 反覆重做永遠做不完，
 * 完全重演 #237（v2.55.29 修的那個 30 分鐘 orphan timeout 誤殺）。
 *
 * 這層只是「api-server 自己掛掉／mac mini 離線時不要讓 row 永遠卡著」的安全網。
 * 使用者體驗不靠它扛 —— 靠 ChatPage 一送出就在的「停止等待」鍵。
 */
export const REQUEST_STALE_MINUTES = 100;

interface RequestRow {
  status?: unknown;
  [key: string]: unknown;
}

/**
 * Lazy 收屍：非終結 request 停滯超過 REQUEST_STALE_MINUTES 就地標 timed_out。
 *
 * 只掛 `GET /requests/:id` —— `useRequestSSE` 的 30 秒 always-on polling 打的就是它。
 * **不掛 SSE events**：那條 stream 30 分鐘就關（MAX_DURATION_MS），本來就活不到 100
 * 分鐘，掛上去只是多一條打不到的路徑。沒人在看的殭屍收不到，但那種情況隊列本來就不會
 * 動 —— 能推進隊列的 api-server 若活著，第一層早就收了。
 *
 * 齡用 `COALESCE(updated_at, created_at)`：api-server 從沒接手過的 request 其
 * `updated_at` 是 NULL（PATCH 才會寫），只看 updated_at 會讓它永遠不算齡。
 *
 * **刻意不寫 reply** —— 那格留給 ADR-0007 的「遲到完成」。UI 文案由 terminal_reason 驅動。
 *
 * ⚠️ **已知缺口**：這裡直接 UPDATE、不經 PATCH，所以 requests/[id] 的完成 hook
 * （`applyHealthCheckCompletion` / `applyNotesGenerationCompletion`）不會跑 ——
 * 被牆鐘收掉的健檢／筆記請求，其 `trip_health_reports` 會停在 pending。
 * **不是本次引入的迴歸**（改之前 request 根本永遠停在 processing，那些表一樣卡著），
 * 且第一層 api-server 走 PATCH、hook 照跑；這條要 mac mini 死透 100 分鐘才觸發。
 * 要補的話走 mint-restricted:127 已經記下的共用 failRequest helper。
 */
export async function reapIfStale<T extends RequestRow | null>(
  db: D1Database,
  id: number | string,
  row: T,
): Promise<T> {
  if (!row || TERMINAL_STATUSES.has(row.status as string)) return row;
  // 非終結 row 才多打這一條 guarded UPDATE（in-flight 是少數，成本可忽略）。
  // 過期判定留在 SQL：SQLite 的 datetime 字串在 JS 端解析是額外的時區踩雷面。
  const reaped = await db
    .prepare(
      `UPDATE trip_requests
          SET status = 'failed',
              terminal_reason = 'timed_out',
              updated_at = datetime('now')
        WHERE id = ?
          AND status IN ('open', 'processing')
          AND COALESCE(updated_at, created_at) <= datetime('now', ?)
        RETURNING *`,
    )
    .bind(id, `-${REQUEST_STALE_MINUTES} minutes`)
    .first();
  return (reaped as T) ?? row;
}
