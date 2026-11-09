// @vitest-environment node
/**
 * #1645：service worker 公開行程離線快取規則。
 * web 已切到新 api（跨網域），規則必須匹配 VITE_API_BASE_URL 的 /api/trips/*，
 * 且不得把帶憑證（Authorization／DPoP／Cookie）或 private／no-store 的回應寫進共用快取。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { swRuntimeCaching } from '../../scripts/sw-api-cache.mjs';

const API = 'https://trip-planner-api-production.lean-lean.workers.dev';
const rules = swRuntimeCaching(API);
const prod = rules[0]!;
const hit = (r: (typeof rules)[number], url: string) => (r.urlPattern as RegExp).test(url);
const update = (r: (typeof rules)[number], headers: Record<string, string>, res: Response) =>
  (r.options.plugins[0]!.cacheWillUpdate as (a: { request: Request; response: Response }) => Promise<Response | null>)({
    request: new Request(`${API}/api/trips/t1`, { headers }),
    response: res,
  });
const ok = (cc?: string) => new Response('{}', { status: 200, headers: cc ? { 'Cache-Control': cc } : {} });

describe('urlPattern', () => {
  it('匹配新 api 的 /api/trips/<id> 與子路徑', () => {
    expect(hit(prod, `${API}/api/trips/t1`)).toBe(true);
    expect(hit(prod, `${API}/api/trips/t1/days/2`)).toBe(true);
  });
  it('不匹配舊 pages.dev 網域、其他網域、非 trips 端點', () => {
    expect(hit(prod, 'https://trip-planner-dby.pages.dev/api/trips/t1')).toBe(false);
    expect(hit(prod, 'https://evil.example/api/trips/t1')).toBe(false);
    expect(hit(prod, `${API}.evil.example/api/trips/t1`)).toBe(false);
    expect(hit(prod, `${API}/api/permissions`)).toBe(false);
    expect(hit(prod, `${API}/api/requests/1`)).toBe(false);
  });
  it('保留 dev proxy 規則；沒設 api base 時只剩 dev 規則', () => {
    expect(hit(rules[1]!, 'http://localhost:5173/api/trips/t1')).toBe(true);
    expect(swRuntimeCaching('')).toHaveLength(1);
  });
});

describe('cacheWillUpdate', () => {
  it('匿名且可快取的 200 → 寫入', async () => {
    expect(await update(prod, {}, ok('public, max-age=60'))).not.toBeNull();
    expect(await update(prod, {}, ok())).not.toBeNull();
  });
  it('請求帶 Authorization／DPoP／Cookie → 不寫入', async () => {
    for (const h of [{ Authorization: 'Bearer x' }, { DPoP: 'proof' }, { Cookie: 'a=b' }]) {
      expect(await update(prod, h, ok())).toBeNull();
    }
  });
  it('回應 private／no-store → 不寫入', async () => {
    expect(await update(prod, {}, ok('private, max-age=0'))).toBeNull();
    expect(await update(prod, {}, ok('no-store'))).toBeNull();
  });
  it('opaque（status 0，讀不到標頭）→ 不寫入；cacheableResponse 只收 200', async () => {
    const opaque = { status: 0, type: 'opaque', headers: new Headers() } as unknown as Response;
    expect(await update(prod, {}, opaque)).toBeNull();
    expect(prod.options.cacheableResponse.statuses).toEqual([200]);
  });
});

describe('vite.config.ts 接線', () => {
  it('runtimeCaching 來自 swRuntimeCaching(VITE_API_BASE_URL)，不再寫死 pages.dev', () => {
    const cfg = readFileSync('vite.config.ts', 'utf8');
    expect(cfg).toMatch(/swRuntimeCaching\(/);
    expect(cfg).not.toMatch(/pages\.dev/);
  });
});
