/**
 * GET /api/health — 回應形狀鎖。
 *
 * 為什麼要真的呼叫而不是 source-grep：tests/unit/api-health-endpoint.test.ts 只對
 * 原始碼做 regex 比對，所以它看不出「JSDoc 宣稱的欄位」與「實際回傳的欄位」有沒有
 * 對上。結果就是 JSDoc 從 v2.33.126 起宣稱回應帶 `version: VITE_BUILD_VERSION?`，
 * 而該識別字全 repo 只存在於那行註解本身 —— 兩個月、數次 release 都沒人發現。
 *
 * 這裡精確比對 key 集合：往回應加欄位而忘了寫文件、或往文件寫欄位而沒實作，兩個
 * 方向都會讓這條紅。這是這個 endpoint 唯一會真的執行 handler 的測試。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, callHandler } from './helpers';
import { onRequestGet } from '../../functions/api/health';

describe('GET /api/health — 回應形狀', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  const call = async (overrides = {}) => {
    const env = mockEnv(db, { GOOGLE_MAPS_API_KEY: 'x'.repeat(20), ...overrides });
    const ctx = mockContext({ request: new Request('https://x/api/health'), env });
    const resp = await callHandler(onRequestGet, ctx);
    return { resp, body: (await resp.json()) as Record<string, unknown> };
  };

  it('回應的 key 集合就是 status / checks / ts —— 沒有別的', async () => {
    const { body } = await call();
    expect(Object.keys(body).sort()).toEqual(['checks', 'status', 'ts']);
    expect(Object.keys(body.checks as object).sort()).toEqual(['d1', 'googleMapsKey']);
  });

  it('沒有 version 欄（JSDoc 曾宣稱有，但從未實作）', async () => {
    const { body } = await call();
    expect('version' in body).toBe(false);
  });

  it('全 ok → healthy + 200', async () => {
    const { resp, body } = await call();
    expect(resp.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks).toEqual({ d1: 'ok', googleMapsKey: 'ok' });
  });

  it('缺 Google Maps key → degraded + 200（非關鍵，仍 serve 非 Maps 流量）', async () => {
    const { resp, body } = await call({ GOOGLE_MAPS_API_KEY: '' });
    expect(resp.status).toBe(200);
    expect(body.status).toBe('degraded');
  });

  it('ts 是可解析的 ISO timestamp', async () => {
    const { body } = await call();
    expect(Number.isNaN(Date.parse(body.ts as string))).toBe(false);
  });
});
