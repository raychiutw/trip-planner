/**
 * api-client-block-page.test.ts
 *
 * Cloudflare edge 在限流/挑戰某 IP 時，會在 request 到達 Pages Function 前就回一個
 * `text/html` block 頁，但帶 **HTTP 200**。apiFetch 舊行為看到 200 就直接
 * `response.json()` → 對 `<!DOCTYPE html>` 丟 `SyntaxError` → caller 只能顯示 generic
 * 失敗（行程 AI 聊天「載入訊息失敗」紅字 banner 的 root cause，且 edge 擋在 Function
 * 前，200 狀態、零 server 痕跡）。
 *
 * 修法：把「200 但 text/html」視為暫時性 upstream 不可用 → 比照 429 idempotent 重試
 * 一次（暫時性 blip 自癒 → banner 不出現）；重試後仍是 block 頁才丟明確
 * `SYS_UPSTREAM_UNAVAILABLE` ApiError（中性、非 user-blaming），而非無診斷的 SyntaxError。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from '../../src/lib/apiClient';
import { ApiError } from '../../src/lib/errors';

const HTML =
  '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Attention Required! | Cloudflare</body></html>';
const blockResp = () =>
  new Response(HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const jsonResp = (body: string) =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('apiFetch — edge block page (200 text/html)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('GET 200 text/html → retry once → 200 JSON success（暫時性 blip 自癒）', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(blockResp())
      .mockResolvedValueOnce(jsonResp('{"ok":true}'));

    const promise = apiFetch<{ ok: boolean }>('/requests?tripId=x&limit=5&sort=desc');
    await vi.advanceTimersByTimeAsync(1100);
    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('GET 200 text/html 兩次 → 丟明確 ApiError(SYS_UPSTREAM_UNAVAILABLE)，非 SyntaxError', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(blockResp());

    let caught: unknown;
    const p = apiFetch('/requests?tripId=x&limit=5&sort=desc').catch((e) => {
      caught = e;
    });
    await vi.advanceTimersByTimeAsync(1100);
    await p;

    expect(caught).toBeInstanceOf(ApiError); // 關鍵：不是 SyntaxError
    expect((caught as ApiError).code).toBe('SYS_UPSTREAM_UNAVAILABLE');
    expect(fetchSpy).toHaveBeenCalledTimes(2); // idempotent retry 一次
  });

  it('GET 200 application/json → 正常成功、不 retry（regression 防線）', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(jsonResp('{"ok":true}'));
    await expect(apiFetch<{ ok: boolean }>('/requests?tripId=x')).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('POST 200 text/html → 不 retry（非 idempotent 防 double-mutate）但仍丟明確錯', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(blockResp());

    let caught: unknown;
    await apiFetch('/requests', { method: 'POST', body: '{}' }).catch((e) => {
      caught = e;
    });

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('SYS_UPSTREAM_UNAVAILABLE');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 沒重試
  });

  it('GET 200 text/html → retry 等候期間 abort → 丟 AbortError、不再 fetch', async () => {
    // 新 retry 進入條件（block 頁）× 既有 abort 分支的組合：block 頁觸發等候，
    // 等候中 user abort（切頁/元件卸載）→ 應丟 AbortError 而非再打第二次。
    const controller = new AbortController();
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(blockResp());

    let caught: unknown;
    const p = apiFetch('/requests?tripId=x&limit=5&sort=desc', { signal: controller.signal }).catch((e) => {
      caught = e;
    });
    controller.abort(); // 第一次 fetch 已回 block 頁、進入 wait，此刻 abort
    await vi.advanceTimersByTimeAsync(1100);
    await p;

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('NET_TIMEOUT'); // AbortError → NET_TIMEOUT
    expect(fetchSpy).toHaveBeenCalledTimes(1); // wait 後偵測 abort，沒第二次 fetch
  });

  it('403 text/html 挑戰頁 → fromResponse 優雅 fallback 成 ApiError，非 SyntaxError', async () => {
    // block 頁的近親：Cloudflare JS 挑戰頁可能帶 non-2xx（403/503）+ HTML body。
    // 此路走 !response.ok → fromResponse，其 res.json() 對 HTML try/catch fallback
    // 成 statusToCode，不外漏 SyntaxError（本 bug 家族的另一半，鎖回歸）。
    const html403 = new Response(HTML, {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(html403);

    let caught: unknown;
    await apiFetch('/requests?tripId=x').catch((e) => {
      caught = e;
    });

    expect(caught).toBeInstanceOf(ApiError); // 不是 SyntaxError
    expect((caught as ApiError).code).toBe('PERM_DENIED'); // statusToCode(403)，非 SYS_
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 403 非 429/非 block 頁 → 不 retry
  });
});
