/**
 * GET /api/trips — 匿名不得拿到 owner email。
 *
 * 2026-07-16 實測 prod：`curl https://trip-planner-dby.pages.dev/api/trips` 零認證，
 * 回傳 6 個 published 行程，每個都帶 `owner: "<真實 email>"`，其中一個是第三方的。
 * 這支無 auth 時走 `WHERE t.published = 1`（公開行程本來就該看得到），但 baseCols
 * 無條件 SELECT `u.email AS owner`，把擁有者 email 一起送出去。
 *
 * 真的執行 handler，不是 source-grep —— 這條的重點是「回應裡到底有沒有那個 key」。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, callHandler, seedTrip } from './helpers';
import { onRequestGet } from '../../functions/api/trips';
import type { AuthData } from '../../functions/api/_types';

describe('GET /api/trips — owner email 不外洩給匿名', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
    await seedTrip(db, { id: 'pub-trip', name: '公開行程', published: 1 });
  }, 30000);

  afterAll(disposeMiniflare);

  const call = async (auth: AuthData | null) => {
    const env = mockEnv(db);
    const ctx = mockContext({ request: new Request('https://x/api/trips'), env });
    (ctx.data as Record<string, unknown>).auth = auth;
    const resp = await callHandler(onRequestGet, ctx);
    return (await resp.json()) as Array<Record<string, unknown>>;
  };

  it('匿名 → 回得到 published 行程，但沒有 owner 欄', async () => {
    const rows = await call(null);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.keys(r)).not.toContain('owner');
    }
  });

  it('匿名 → 整個回應沒有任何 @ 開頭的 email 形狀字串', async () => {
    // 比對 key 名稱擋不住「換個欄名繼續送 email」。這條直接掃整包 JSON。
    const rows = await call(null);
    const blob = JSON.stringify(rows);
    expect(blob).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
  });

  it('匿名仍拿得到 ownerDisplayName（avatar 要用，且不是個資）', async () => {
    const rows = await call(null);
    // camelCase：json() 會套 deepCamel
    expect(Object.keys(rows[0])).toContain('ownerDisplayName');
  });

  it('登入者 → 拿得到 owner（前端要靠它比對「這是不是我的行程」）', async () => {
    const rows = await call(mockAuth({ email: 'user@test.com' }));
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).toContain('owner');
  });
});
