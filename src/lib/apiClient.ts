/* ===== API Fetch Helpers ===== */

// v2.33.54 round 10: import from lib/networkBus (was '../hooks/useOnlineStatus'
// — broke lib→hooks reverse import, lib is leaf layer).
import { reportFetchResult } from './networkBus';
import { ApiError } from './errors';
import * as Sentry from '@sentry/react';

/**
 * Trim Sentry breadcrumb payload to avoid PII leak.
 * v2.33.36 security audit round 1: backend `detail` may contain user emails /
 * trip names / partial DB error text; `path` may include `?email=…` query
 * strings. Strip query string and truncate detail to 200 chars before sending.
 */
function scrubForSentry(path: string, detail: string | undefined): { path: string; detail: string | undefined } {
  const cleanPath = path.split('?')[0] ?? path;
  const cleanDetail = typeof detail === 'string'
    ? detail.replace(/[\r\n]+/g, ' ').slice(0, 200)
    : undefined;
  return { path: cleanPath, detail: cleanDetail };
}

/**
 * Detect bodies that already carry their own Content-Type (FormData / Blob /
 * URLSearchParams). Setting `Content-Type: application/json` for these breaks
 * server-side parsing — v2.33.36 code review round 1 finding.
 */
function bodyIsJsonString(body: unknown): boolean {
  return typeof body === 'string';
}

/**
 * Cloudflare edge 在限流/挑戰某 IP 時，會在 request 到達 Pages Function 前就回一個
 * `text/html` block 頁但帶 2xx（HTTP 200）。這種「2xx 但非 JSON」若直接
 * response.json() 會丟無診斷資訊的 SyntaxError，caller 只能顯示 generic 失敗
 * （行程 AI 聊天「載入訊息失敗」root cause）。偵測後比照 429 當暫時性 upstream
 * 不可用處理。204 排除（本就無 body）。
 */
function isEdgeBlockPage(res: Response): boolean {
  // headers?. 防禦：真 fetch Response 恆有 headers，但部分測試/呼叫端用不帶 headers
  // 的 partial Response-like，缺 headers 時視為「非 block 頁」放行、不誤擋。
  // toLowerCase：header key 查詢本就 case-insensitive，但 value 比對不是；proxy 若送
  // `Text/HTML` 仍要當 block 頁（Cloudflare 送小寫，這是 defense-in-depth）。
  return res.ok && res.status !== 204 && (res.headers?.get('Content-Type') ?? '').toLowerCase().includes('text/html');
}

/** Raw fetch that returns the Response — for callers that need status-code inspection. */
export function apiFetchRaw(path: string, opts?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) as Record<string, string> };
  if (opts?.body && bodyIsJsonString(opts.body) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch('/api' + path, { ...opts, headers }).then(
    (r) => { reportFetchResult(true); return r; },
    (e) => { reportFetchResult(false); throw ApiError.fromNetworkError(e); },
  );
}

/**
 * Parse `Retry-After` header to milliseconds. Supports two RFC 7231 forms:
 *   - delta-seconds: 整數秒數
 *   - HTTP-date: e.g. "Wed, 21 Oct 2026 07:28:00 GMT"
 *
 * Cap upper bound at 30s — avoid blocking UI 太久。Backend rate-limit 通常
 * < 5s；超過 30s 表示 server 想拒更久，第一輪 retry 沒意義。
 */
export function parseRetryAfter(header: string | null): number {
  if (!header) return 0;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    const sec = Number(trimmed);
    return Math.min(sec, 30) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    if (delta <= 0) return 0;
    return Math.min(delta, 30_000);
  }
  return 0;
}

/**
 * setTimeout sleep 但可被 AbortSignal 提前喚醒：abort 時立即 resolve（呼叫端隨後
 * 檢查 signal.aborted 決定丟 AbortError），避免 retry 等候呆等到 Retry-After 上限
 * （30s）才反應 route churn / 元件卸載。timer 與 listener 兩邊都清乾淨、不洩漏。
 */
function sleepOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

export async function apiFetch<T>(path: string, opts?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) as Record<string, string> };
  const method = (opts?.method ?? 'GET').toUpperCase();
  if (
    method !== 'GET' && method !== 'HEAD' && method !== 'DELETE' &&
    opts?.body && bodyIsJsonString(opts.body) && !headers['Content-Type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  let retried = false;

  // 內部 helper 跑單次 fetch（不重試）。Network error 直接 throw。
  const doFetch = async (): Promise<Response> => {
    try {
      return await fetch('/api' + path, { ...opts, headers });
    } catch (networkError) {
      reportFetchResult(false);
      throw ApiError.fromNetworkError(networkError);
    }
  };

  // SYS_* 錯誤自動上報 Sentry（scrub PII）後 throw。`!response.ok` 與「retry 後仍是
  // edge block 頁」兩條路共用（後者若不上報，這種 200-block 失敗會零 server 痕跡）。
  const throwReported = (apiError: ApiError): never => {
    if (apiError.code.startsWith('SYS_')) {
      const scrubbed = scrubForSentry(path, apiError.detail);
      Sentry.captureException(apiError, {
        tags: { errorCode: apiError.code, category: 'system' },
        extra: { path: scrubbed.path, status: apiError.status, detail: scrubbed.detail },
      });
    }
    throw apiError;
  };

  response = await doFetch();

  // v2.33.130 G10 + edge block 頁：429，或「2xx 但 text/html」的 Cloudflare edge
  // 限流/挑戰頁（isEdgeBlockPage）→ 當暫時性 upstream 不可用，讀 Retry-After 等候
  // + 1 次 retry（idempotent methods 才 retry — POST/PATCH/DELETE retry 可能
  // double-mutate）。第二次仍失敗才往下丟 → user 看 toast，自己決定要不要再試。
  // retry 冪等性：真的 block 頁 = Cloudflare 邊緣擋在 Pages Function「之前」，origin
  // 沒跑 → 無 side effect，重打安全（含 view-count 這種 GET-with-side-effect，其
  // 寫入只在 200 application/json 成功路徑、永不觸 retry）。唯一未涵蓋：origin 真
  // 成功卻被下游 proxy 竄改 Content-Type 成 text/html → 才會重打；此需壞 proxy，
  // 且與既有 429 retry 對 GET 冪等契約假設同級，不額外防。
  if (!retried && (response.status === 429 || isEdgeBlockPage(response))) {
    const isIdempotent = method === 'GET' || method === 'HEAD';
    if (isIdempotent) {
      const waitMs = parseRetryAfter(response.headers.get('Retry-After')) || 1000;
      // 丟棄第一個回應的 body 再重打：避免 oversized/streaming block 頁佔住連線。
      response.body?.cancel().catch(() => undefined);
      // abort-aware 等候：wait 期間 signal abort 立即喚醒，不呆等滿 Retry-After。
      await sleepOrAbort(waitMs, opts?.signal);
      if (opts?.signal?.aborted) {
        throw ApiError.fromNetworkError(new DOMException('aborted', 'AbortError'));
      }
      retried = true;
      response = await doFetch();
    }
  }

  if (!response.ok) {
    throwReported(await ApiError.fromResponse(response));
  }

  reportFetchResult(true);
  // 204 No Content：empty body，`response.json()` 會 throw SyntaxError
  // ("Unexpected end of JSON input")。backend DELETE handlers 普遍返 204
  // （poi-favorites / sessions / connected-apps / trip / day / entries…），
  // 之前 callers 大多 `.catch(...)` swallow 後當失敗顯 toast，user 重整看到
  // 資料消失才知道實際成功 — UX 一直壞，v2.31.43 ExplorePage 直接 surface
  // 才被抓到。
  if (response.status === 204) return undefined as T;
  // retry 後仍是 edge block 頁（持續限流 / 路由異常）→ 丟明確可重試錯，而非讓
  // response.json() 對 <!DOCTYPE html> 拋無診斷 SyntaxError（chat「載入訊息失敗」
  // root cause）。用中性 SYS_UPSTREAM_UNAVAILABLE（非 SYS_RATE_LIMIT）：block 頁成因
  // 含路由異常/proxy 錯誤，非必然 user 操作過頻，避免誤導 telemetry 分桶與 user copy。
  if (isEdgeBlockPage(response)) {
    throwReported(new ApiError('SYS_UPSTREAM_UNAVAILABLE', response.status));
  }
  return response.json() as Promise<T>;
}
