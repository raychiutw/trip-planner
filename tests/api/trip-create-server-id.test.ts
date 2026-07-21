// @vitest-environment node
/**
 * 建立行程的 ID 由**後端**產生（owner 決策 2026-07-21：「建立 id 規則要移往後端」）
 *
 * 原設計：`NewTripPage.tsx` 自己算好 id 塞進 POST body，後端只做格式與唯一性檢查。
 * 問題有三：
 *   1. 資源識別碼由呼叫端決定 —— 任何人都能挑 id，等於開放命名空間搶佔；
 *   2. 規則散在前端，`functions/api/trips/import.ts` 於是另寫一套（`imp-<uuid>`），
 *      同一系統長出兩種慣例（owner 由 demo 行程編號發現）；
 *   3. 後端無從保證慣例，只能被動驗證字元集。
 *
 * 改為後端產生，且**不留相容模式**（owner：「不要相容模式 前端不再生成id」）——
 * 呼叫端送 id 一律 400。時機正好：Flutter app 尚未上架，現在斷比上架後便宜。
 * ⚠ Flutter 端的建立行程流程需同步改為讀回應的 tripId。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { onRequestPost } from '../../functions/api/trips';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';

const USER_ID = 'creator-user';

describe('POST /api/trips — 後端產生 ID', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
    await db.prepare('INSERT INTO users (id, email, display_name) VALUES (?,?,?)')
      .bind(USER_ID, 'creator@example.com', 'Creator').run();
  }, 30000);

  afterAll(async () => { await disposeMiniflare(); });

  function ctx(body: unknown) {
    return {
      request: new Request('https://x.com/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env: mockEnv(db),
      params: {} as never,
      data: { auth: { userId: USER_ID, isServiceToken: false } },
      next: () => Promise.resolve(new Response()),
      waitUntil: () => undefined,
      passThroughOnException: () => undefined,
    } as unknown as Parameters<typeof onRequestPost>[0];
  }

  const base = { name: '台北', startDate: '2026-09-01', endDate: '2026-09-03' };

  it('不給 id → 後端產生，並在回應帶回', async () => {
    const res = await onRequestPost(ctx(base));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { tripId: string };
    expect(body.tripId, '回應必須帶 tripId，呼叫端靠它導頁').toBeTruthy();

    const row = await db.prepare('SELECT id FROM trips WHERE id = ?').bind(body.tripId).first();
    expect(row, '產生的 id 必須真的寫進 DB').not.toBeNull();
  });

  it('產生的 id 遵循既有慣例（中文名 → trip-xxxx）', async () => {
    const res = await onRequestPost(ctx(base));
    const body = (await res.json()) as { tripId: string };
    expect(body.tripId).toMatch(/^trip-[a-z0-9]+$/);
  });

  it('同名連續建立不會撞 id', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await onRequestPost(ctx(base));
      expect(res.status, '同名重複建立不該衝突').toBe(201);
      ids.add(((await res.json()) as { tripId: string }).tripId);
    }
    expect(ids.size).toBe(5);
  });

  it('呼叫端仍送 id → 明確拒絕，不做相容', async () => {
    // owner 決策：不留相容模式。默默忽略會更糟 —— 呼叫端拿自己那個 id 去導頁
    // 會 404，變成「建立成功但看不到」的隱性 bug；直接 400 讓它當場修。
    await expect(onRequestPost(ctx({ ...base, id: 'client-picked-id' })))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('連格式合法的 id 也拒絕 —— 擋的是「由呼叫端決定」本身', async () => {
    await expect(onRequestPost(ctx({ ...base, id: 'trip-abcd' })))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('缺 name 仍要擋 —— 後端要靠它產生 id', async () => {
    await expect(onRequestPost(ctx({ startDate: '2026-09-01', endDate: '2026-09-03' })))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });
});

describe('前端不再自行產生行程 ID', () => {
  it('NewTripPage 不再 import genTripId，也不再送 id', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const src = readFileSync(resolve(__dirname, '../../src/pages/NewTripPage.tsx'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src, 'ID 規則已移往後端，前端不該再產生').not.toMatch(/genTripId/);
    expect(src, '不該再把 id 塞進 POST body').not.toMatch(/^\s*id: tripId,/m);
  });
});
