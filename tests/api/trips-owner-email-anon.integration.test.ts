/**
 * GET /api/trips — 匿名不得拿到擁有者個資（email + 顯示真名）。
 *
 * 2026-07-16 實測 prod：`curl https://trip-planner-dby.pages.dev/api/trips` 零認證，
 * 回傳 6 個 published 行程，每個都帶 `owner: "<真實 email>"`，其中一個是第三方的。
 * 這支無 auth 時走 `WHERE t.published = 1`（公開行程本來就該看得到），但 baseCols
 * 無條件 SELECT `u.email AS owner` + `u.display_name AS owner_display_name`。
 *
 * owner_display_name 一樣是個資：登入時預設帶 Google 真名（callback/google.ts），
 * 對齊 _share.ts:154「匿名連結 never expose the owner's name」。restrictTrip 降權
 * token 只該碰單一 trip，也不該撈全站 owner 清單。
 *
 * 真的執行 handler，不是 source-grep —— 重點是「回應裡到底有沒有那些欄／那些值」。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, callHandler, seedTrip } from './helpers';
import { onRequestGet } from '../../functions/api/trips';
import type { AuthData } from '../../functions/api/_types';

// 刻意選一個「非 email 衍生」的顯示名稱：seedTrip 預設把 display_name 設成 email
// 的 @ 前段（"pub-owner"），那沒法證明真名有沒有外洩。改成一個 email 裡不會出現、
// email-regex 也抓不到的字串，才驗得出 owner_display_name 這條洩漏。
const OWNER_EMAIL = 'pub-owner@example.com';
const OWNER_REAL_NAME = '殷佩妮_真名不該外洩';

describe('GET /api/trips — 擁有者個資不外洩給匿名／受限 token', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
    const { ownerUserId } = await seedTrip(db, { id: 'pub-trip', owner: OWNER_EMAIL, published: 1 });
    // seedTrip 只會把 display_name 設成 email 前段；覆寫成一個真名形狀的值。
    await db.prepare('UPDATE users SET display_name = ? WHERE id = ?')
      .bind(OWNER_REAL_NAME, ownerUserId).run();
  }, 30000);

  afterAll(disposeMiniflare);

  const call = async (auth: AuthData | null) => {
    const env = mockEnv(db);
    const ctx = mockContext({ request: new Request('https://x/api/trips'), env });
    (ctx.data as Record<string, unknown>).auth = auth;
    const resp = await callHandler(onRequestGet, ctx);
    return (await resp.json()) as Array<Record<string, unknown>>;
  };

  it('匿名 → 回得到 published 行程，但沒有 owner 欄（email）', async () => {
    const rows = await call(null);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.keys(r)).not.toContain('owner');
    }
  });

  it('匿名 → 沒有 ownerDisplayName 欄（顯示真名同樣是個資）', async () => {
    const rows = await call(null);
    for (const r of rows) {
      expect(Object.keys(r)).not.toContain('ownerDisplayName');
    }
  });

  it('匿名 → 整包 JSON 既無 email 形狀字串，也無 owner 的顯示真名', async () => {
    // 比對 key 名稱擋不住「換個欄名繼續送個資」；email-regex 又抓不到中文真名。
    // 兩條一起掃：任何形狀的 owner 個資都不准出現在匿名回應裡。
    const blob = JSON.stringify(await call(null));
    expect(blob).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
    expect(blob).not.toContain(OWNER_REAL_NAME);
  });

  it('登入者 → 拿得到 owner 與 ownerDisplayName（前端比對「我的行程」＋avatar 要用）', async () => {
    const rows = await call(mockAuth({ email: 'user@test.com' }));
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['owner', 'ownerDisplayName']));
  });

  it('restrict_trip 降權 token → 拿不到 owner／ownerDisplayName（只該碰被授權的單一 trip）', async () => {
    // isServiceToken=false + userId 有值，但 restrictTrip 綁死一個 trip。這種 token
    // 若能撈全站 published owner email，就繞過了它自己的 scope。
    const rows = await call(mockAuth({ email: 'agent@test.com', restrictTrip: 'some-other-trip' }));
    const blob = JSON.stringify(rows);
    expect(blob).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
    expect(blob).not.toContain(OWNER_REAL_NAME);
    for (const r of rows) {
      expect(Object.keys(r)).not.toContain('owner');
    }
  });
});
