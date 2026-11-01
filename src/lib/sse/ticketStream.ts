/**
 * 即時推送（SSE）的一次性 ticket 連線。
 *
 * 流程：`POST /api/requests/{id}/sse-ticket`（typed client＋auth）換 ticket → `new EventSource(.../events?ticket=…)`。
 *
 * 為什麼自己管重連、不靠瀏覽器：ticket 是單次、30 秒內有效。原生 EventSource 斷線後自動重連會**重送同一張已用過的 ticket**
 * → 401。所以 `onerror` 時一律自己 close、重新換票、再連；`event: reconnect`（token_expired／grant_revoked／max_duration）也一樣。
 * - 退避：指數（base × 2^(n-1)，上限 backoffMaxMs）；連續失敗超過 maxAttempts 就放棄（回報 gave_up，呼叫端靠 polling 兜底）。
 *   連線成功（onopen）會把失敗次數歸零。
 * - grant_revoked：先試 `refresh()`；refresh 也失敗 → 回報 auth_required（UI 走「需要重新登入」）。
 * - 換票被 401（auth client 已 refresh 重試過）或 AuthError(AUTH_REQUIRED) → auth_required；404／其他 4xx → ticket_failed（不重試）；
 *   429／5xx／網路錯誤 → 退避重試。
 */
import type { Api } from '../api/client';

export interface FakeableEventSource {
  // 參數寫 never：真的 EventSource（事件參數是 Event／MessageEvent）與測試用的假物件都能賦值給這個介面
  onopen: ((ev: never) => unknown) | null;
  onmessage: ((ev: never) => unknown) | null;
  onerror: ((ev: never) => unknown) | null;
  addEventListener(type: string, listener: (ev: { data: string }) => void): void;
  close(): void;
}

export type TicketStreamFatal = 'auth_required' | 'ticket_failed' | 'gave_up';

export interface TicketStreamOptions {
  requestId: number;
  /** 新 api 的網址（VITE_API_BASE_URL）。 */
  apiBase: string;
  api: Pick<Api, 'post'>;
  auth: { refresh(): Promise<void> };
  createEventSource: (url: string) => FakeableEventSource;
  onOpen?: () => void;
  onMessage: (ev: { data: string }) => void;
  /** 之後不會再自動重連。 */
  onFatal: (reason: TicketStreamFatal) => void;
  maxAttempts?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
}

export function openTicketStream(opts: TicketStreamOptions): () => void {
  const maxAttempts = opts.maxAttempts ?? 6;
  const baseMs = opts.backoffBaseMs ?? 1000;
  const maxMs = opts.backoffMaxMs ?? 30_000;
  const base = opts.apiBase.replace(/\/+$/, '');

  let closed = false;
  let attempts = 0;
  let current: FakeableEventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: AbortController | null = null;

  const dropCurrent = () => {
    const es = current;
    current = null;
    es?.close();
  };

  const fatal = (reason: TicketStreamFatal) => {
    if (closed) return;
    dropCurrent();
    opts.onFatal(reason);
  };

  const retry = () => {
    if (closed) return;
    attempts += 1;
    if (attempts > maxAttempts) return fatal('gave_up');
    const delay = Math.min(baseMs * 2 ** (attempts - 1), maxMs);
    timer = setTimeout(() => { timer = null; void connect(); }, delay);
  };

  async function connect(): Promise<void> {
    if (closed) return;
    inflight = new AbortController();
    let res;
    try {
      res = await opts.api.post('/api/requests/{id}/sse-ticket', { path: { id: String(opts.requestId) }, signal: inflight.signal });
    } catch (e) {
      if (closed) return;
      if ((e as { code?: string } | null)?.code === 'AUTH_REQUIRED') return fatal('auth_required');
      return retry();
    }
    if (closed) return;
    if (!res.ok) {
      if (res.status === 401) return fatal('auth_required');
      if (res.status === 429 || res.status >= 500) return retry();
      return fatal('ticket_failed');
    }

    const es = opts.createEventSource(`${base}/api/requests/${opts.requestId}/events?ticket=${encodeURIComponent(res.data.ticket)}`);
    current = es;
    es.onopen = () => {
      if (current !== es) return;
      attempts = 0;
      opts.onOpen?.();
    };
    es.onmessage = (ev: { data: string }) => { if (current === es) opts.onMessage(ev); };
    es.addEventListener('reconnect', (ev) => {
      if (current !== es) return;
      dropCurrent();
      let reason: unknown;
      try { reason = (JSON.parse(ev.data) as { reason?: unknown }).reason; } catch { /* 沒有 reason 就當一般重連 */ }
      if (reason === 'grant_revoked') {
        opts.auth.refresh().then(() => connect(), () => fatal('auth_required'));
      } else {
        void connect();
      }
    });
    es.onerror = () => {
      if (current !== es) return;
      dropCurrent(); // 不讓瀏覽器自動重連（會重送用過的 ticket）
      retry();
    };
  }

  void connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    inflight?.abort();
    dropCurrent();
  };
}
