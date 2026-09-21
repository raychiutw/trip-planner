export interface ChatMessage {
  id: number | string;
  /** Persisted request identity survives clearing the waiting flag. */
  requestId?: number;
  /** Section 4.8 (terracotta-ui-parity-polish)：'day-divider' 是 synthetic
   *  separator message，由 buildMessagesWithDividers 注入跨日邊界。 */
  role: 'user' | 'assistant' | 'day-divider';
  text: string;
  /** When set, this assistant bubble is the placeholder waiting for SSE completion. */
  pendingRequestId?: number | null;
  /** When true, render text as markdown (assistant replies). */
  markdown?: boolean;
  /** When true, mark message as failed (red border). */
  failed?: boolean;
  /** ADR-0007：使用者自己按的「停止等待」。是終結但**不是錯誤** —— 畫中性態，
   *  不用 destructive 色（真瀏覽器自測抓到的：原本一律套 is-failed 的紅框紅字）。 */
  terminated?: boolean;
  /** ISO timestamp from tp-request `created_at` / `updated_at`. Rendered as
   *  bubble timestamp (HH:mm if today, MM/DD HH:mm 否則)。null when local
   *  optimistic message (will fill on next reload from API)。 */
  createdAt?: string | null;
  /** 2026-04-29:multi-user trip 共編 chat,user message 真正 sender(從 tp-request
   * `submittedBy` email 來)。Render bubble meta 時 split email local-part 當
   * displayName(避免歷史訊息全標當前登入者)。 */
  submittedBy?: string | null;
  /** 2026-05-07：sender 的 users.display_name（後端 LEFT JOIN）給 avatar /
   *  sender label 顯示「帳號名稱」第一字母。null → fallback email local part。 */
  submittedByDisplayName?: string | null;
}

export interface RawRequestRow {
  id: number;
  tripId: string;
  mode?: string;
  message?: string | null;
  reply?: string | null;
  status: 'open' | 'processing' | 'completed' | 'failed';
  submittedBy?: string | null;
  /** 2026-05-07：submitter 帳號 display_name（API LEFT JOIN users）給 chat
   *  avatar/sender label 顯示「帳號名稱」第一字母。null = users 表無對應。 */
  submittedByDisplayName?: string | null;
  processedBy?: string | null;
  /** ADR-0007：為什麼終結。cancelled=使用者停止等待、timed_out=收屍、
   *  needs_consent=未授權被 park、error=處理失敗。 */
  terminalReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * ADR-0007 的終結文案。取消**不會**叫停 worker（entries/days 走 owner 身份 token），
 * 所以「已停止等待」必須誠實講出行程仍可能被改，不能寫成「已中止」。
 */
const TERMINATION_TEXT = {
  cancelled: '已停止等待。AI 若仍在處理，完成後的回報還是會出現在這裡，行程也可能已被更動。',
  timed_out: 'AI 一直沒有回應，已自動停止。可以重新送出這則訊息。',
  needs_consent: '需要行程擁有者授權 AI 才能處理。授權後重新送出即可。',
} as const;
const TERMINATION_FALLBACK = 'AI 處理失敗，請換個說法或稍後再試。';

function terminationText(reason: unknown): string {
  if (typeof reason !== 'string') return TERMINATION_FALLBACK;
  // 'error' 沒有專屬文案 —— 它就是通用失敗，落 fallback。
  return TERMINATION_TEXT[reason as keyof typeof TERMINATION_TEXT] ?? TERMINATION_FALLBACK;
}

/** Build a message pair (user bubble + assistant bubble) from a tp-request row. */
export function rowToMessages(row: RawRequestRow): ChatMessage[] {
  const out: ChatMessage[] = [];
  const baseId = row.id * 2;
  // 2026-04-29 design-review F-004:API 實際回 camelCase(`createdAt` / `updatedAt`)
  // 因此型別與 access 改齊;原 snake_case 拿不到 timestamp,bubble meta 渲染條件
  // 永不為真。user message 用 createdAt(送出時點),assistant reply 用 updatedAt
  // (AI 完成時點),fallback 互換。
  const userTs = row.createdAt ?? row.updatedAt ?? null;
  const assistantTs = row.updatedAt ?? row.createdAt ?? null;
  if (row.message) {
    // v2.31.27 fix #128: AI 健檢 message 是整個 HEALTH_CHECK_MESSAGE system
    // prompt (含 5 維度 + JSON schema + 範例)，user 看一大坨雜訊。改顯短摘要。
    // 完整 prompt 仍存 trip_requests.message → api-server 拿到完整 text 送 Claude。
    // v2.34.38 prod audit fix: trip-notes feature 3 個新 AI prefix 也是 long system
    //   prompt（JSON schema + 5-8 維度），同樣 raw 顯示 → 套同 pattern substitution。
    const displayText = row.message.startsWith('[AI 健檢]')
      ? '已觸發 AI 行程健檢'
      : row.message.startsWith('[行程筆記-lodging-tips]')
      ? '已觸發 AI 行程筆記生成（住宿在地建議）'
      : row.message.startsWith('[行程筆記-tips]')
      ? '已觸發 AI 行程筆記生成（行前須知）'
      : row.message.startsWith('[行程筆記-emergency]')
      ? '已觸發 AI 行程筆記生成（緊急聯絡）'
      : row.message;
    out.push({
      id: baseId,
      role: 'user',
      text: displayText,
      createdAt: userTs,
      submittedBy: row.submittedBy ?? null,
      submittedByDisplayName: row.submittedByDisplayName ?? null,
    });
  }
  if (row.status === 'completed') {
    out.push({ id: baseId + 1, role: 'assistant', text: row.reply?.trim() || '（沒有回覆內容）', markdown: true, createdAt: assistantTs });
  } else if (row.status === 'failed') {
    // reply 優先（後端 park 的指引、或 ADR-0007 的「遲到完成」回報都寫在這格）；
    // 沒有 reply 才用 terminal_reason 生文案 —— 停止等待與收屍刻意不寫 reply。
    const wasCancelled = row.terminalReason === 'cancelled';
    out.push({
      id: baseId + 1,
      role: 'assistant',
      text: row.reply?.trim() || terminationText(row.terminalReason),
      // 使用者自己停的是中性態；超時／錯誤／未授權才是 destructive。
      terminated: wasCancelled,
      failed: !wasCancelled,
      markdown: true,
      createdAt: assistantTs,
    });
  } else {
    // open / processing — still inflight from a prior session
    out.push({
      id: baseId + 1,
      role: 'assistant',
      text: '思考中…',
      pendingRequestId: row.id,
      createdAt: assistantTs,
    });
  }
  return out.map((message) => ({ ...message, requestId: row.id }));
}
