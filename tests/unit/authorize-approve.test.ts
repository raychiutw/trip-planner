/**
 * approveAuthorization：批准授權（含生物辨識意圖與重試）。回 redirect | reauth-required | failed。
 * 邊界是 getAuthorizeAuth().apiFetch（以 fake 取代）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fake = vi.hoisted(() => ({ apiFetch: vi.fn(), getAuthorizeAuth: vi.fn() }));
vi.mock('../../src/lib/auth', async (orig) => ({ ...(await orig<typeof import('../../src/lib/auth')>()), getAuthorizeAuth: fake.getAuthorizeAuth }));

import { approveAuthorization } from '../../src/lib/auth/authorizeApprove';

const CB = 'https://trip-planner-dby.pages.dev/mobile/oauth/callback?code=abc&state=st1';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const calls = () => fake.apiFetch.mock.calls.map(([u]) => String(u));
const count = (suffix: string) => calls().filter((u) => u.endsWith(suffix)).length;
const plain = { wantBio: false, reauth: false };

let approveRes: () => Response | Promise<Response>;
// intentResults 依序回應：Error 代表網路失敗，數字代表 HTTP 狀態；用完後固定 204
let intentResults: Array<number | Error>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  approveRes = () => json({ redirect_to: CB });
  intentResults = [];
  let i = 0;
  fake.apiFetch.mockReset().mockImplementation(async (input: string) => {
    if (String(input).endsWith('/intent')) {
      const r = intentResults[i++] ?? 204;
      if (r instanceof Error) throw r;
      return new Response(null, { status: r });
    }
    return approveRes();
  });
  fake.getAuthorizeAuth.mockReset().mockReturnValue({ apiFetch: fake.apiFetch });
});
afterEach(() => { vi.useRealTimers(); });

const run = async (opts: { wantBio: boolean; reauth: boolean }) => {
  const p = approveAuthorization('req1', opts);
  await vi.advanceTimersByTimeAsync(5000);
  return p;
};

describe('批准結果', () => {
  it('200 → redirect，打的是 approve 端點（POST）', async () => {
    expect(await run(plain)).toEqual({ kind: 'redirect', url: CB });
    expect(fake.apiFetch).toHaveBeenCalledWith('/api/oauth/authorize/requests/req1/approve', { method: 'POST' });
  });

  it('redirect_to 不是 https／loopback → failed bad-redirect', async () => {
    approveRes = () => json({ redirect_to: 'javascript:alert(1)' });
    expect(await run(plain)).toEqual({ kind: 'failed', reason: 'bad-redirect' });
  });

  it('沒有 redirect_to → failed bad-redirect', async () => {
    approveRes = () => json({});
    expect(await run(plain)).toEqual({ kind: 'failed', reason: 'bad-redirect' });
  });

  it('400 → failed expired', async () => {
    approveRes = () => json({ error: { code: 'DATA_VALIDATION', message: 'x' } }, 400);
    expect(await run(plain)).toEqual({ kind: 'failed', reason: 'expired' });
  });

  it('apiFetch 丟錯 → failed network', async () => {
    approveRes = () => { throw new TypeError('x'); };
    expect(await run(plain)).toEqual({ kind: 'failed', reason: 'network' });
  });
});

describe('403', () => {
  const forbidden = (code: string) => json({ error: { code, message: 'x' } }, 403);

  it('reauth 模式的 OAUTH_REAUTH_REQUIRED → reauth-required', async () => {
    approveRes = () => forbidden('OAUTH_REAUTH_REQUIRED');
    expect(await run({ wantBio: false, reauth: true })).toEqual({ kind: 'reauth-required' });
  });

  it('一般授權的 OAUTH_REAUTH_REQUIRED 不做特殊處理 → failed forbidden', async () => {
    approveRes = () => forbidden('OAUTH_REAUTH_REQUIRED');
    expect(await run(plain)).toEqual({ kind: 'failed', reason: 'forbidden' });
  });

  it.each([true, false])('一般 403 PERM_DENIED（reauth=%s）→ failed forbidden，不是「請求已過期」', async (reauth) => {
    approveRes = () => forbidden('PERM_DENIED');
    expect(await run({ wantBio: false, reauth })).toEqual({ kind: 'failed', reason: 'forbidden' });
  });
});

describe('intent 呼叫（只重試網路錯誤與 5xx，最多共 3 次）', () => {
  const bio = { wantBio: true, reauth: false };

  it('送 POST { intent: "enable" }，且先於 approve', async () => {
    await run(bio);
    const intent = fake.apiFetch.mock.calls.find(([u]) => String(u).endsWith('/intent'));
    expect(intent?.[0]).toBe('/api/oauth/authorize/requests/req1/intent');
    expect((intent?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((intent?.[1] as RequestInit).body))).toEqual({ intent: 'enable' });
    expect(calls().map((u) => u.split('/').pop())).toEqual(['intent', 'approve']);
  });

  it('第一次網路失敗、第二次成功 → intent 共 2 次，approve 只 1 次', async () => {
    intentResults = [new TypeError('Failed to fetch')];
    expect(await run(bio)).toEqual({ kind: 'redirect', url: CB });
    expect(calls().map((u) => u.split('/').pop())).toEqual(['intent', 'intent', 'approve']);
  });

  it('5xx 也重試：500 後成功 → intent 共 2 次', async () => {
    intentResults = [500];
    await run(bio);
    expect(count('/intent')).toBe(2);
    expect(count('/approve')).toBe(1);
  });

  it('連續 3 次失敗 → 放棄重試，仍 approve 並 redirect，intent 剛好 3 次', async () => {
    intentResults = [new TypeError('x'), 503, new TypeError('x'), 500];
    expect(await run(bio)).toEqual({ kind: 'redirect', url: CB });
    expect(count('/intent')).toBe(3);
    expect(count('/approve')).toBe(1);
  });

  it.each([400, 401, 403])('%i → 不重試，intent 只 1 次就 approve', async (status) => {
    intentResults = [status, status, status];
    await run(bio);
    expect(count('/intent')).toBe(1);
    expect(count('/approve')).toBe(1);
  });

  it('一次就成功 → 不重試', async () => {
    await run(bio);
    expect(count('/intent')).toBe(1);
  });

  it('wantBio=false → 不呼叫 intent', async () => {
    await run(plain);
    expect(count('/intent')).toBe(0);
  });

  it('reauth 模式即使 wantBio 也不呼叫 intent', async () => {
    await run({ wantBio: true, reauth: true });
    expect(count('/intent')).toBe(0);
  });
});
