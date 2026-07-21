// @vitest-environment node
/**
 * 新建行程預設**不公開**（owner 決策 2026-07-21：「trip published 要改為 0」）
 *
 * 問題：`GET /api/trips` 會列出所有 `published = 1` 的行程，且**未登入可讀**。
 * 後端的預設本來就是 0，但 web 前端建立時寫死 `published: 1`（NewTripPage）、
 * Flutter 的 `createTrip` 也預設 `published = 1` —— 於是每個使用者新建的行程
 * 都立刻對全世界公開，包含行程名稱、日期、國家與成員數。
 *
 * 2026-07-21 實測 prod：用剛註冊的全新帳號打 `/api/trips` 拿到 10 個他人行程；
 * 未登入也拿得到（只是不含 owner email，那條 2026-07-16 已修）。
 *
 * 使用者不會預期「建立行程」等於「發佈行程」。預設改為不公開，要公開得明確選擇。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { onRequestPost, onRequestGet } from '../../functions/api/trips';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';

const USER_ID = 'privacy-default-user';

describe('POST /api/trips — 預設不公開', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
    await db.prepare('INSERT INTO users (id, email, display_name) VALUES (?,?,?)')
      .bind(USER_ID, 'pd@example.com', 'PD').run();
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

  const base = { name: '東京', startDate: '2026-09-01', endDate: '2026-09-02' };

  it('沒指定 published → 存成 0', async () => {
    const res = await onRequestPost(ctx(base));
    const { tripId } = (await res.json()) as { tripId: string };
    const row = await db.prepare('SELECT published FROM trips WHERE id = ?')
      .bind(tripId).first<{ published: number }>();
    expect(row!.published).toBe(0);
  });

  it('新建的行程不會出現在未登入的公開清單', async () => {
    const res = await onRequestPost(ctx({ ...base, name: '不該外流的行程' }));
    const { tripId } = (await res.json()) as { tripId: string };

    const anonCtx = {
      request: new Request('https://x.com/api/trips'),
      env: mockEnv(db),
      params: {} as never,
      data: {},
      next: () => Promise.resolve(new Response()),
      waitUntil: () => undefined,
      passThroughOnException: () => undefined,
    } as unknown as Parameters<typeof onRequestGet>[0];

    const listed = (await (await onRequestGet(anonCtx)).json()) as Array<{ tripId: string }>;
    expect(listed.some((t) => t.tripId === tripId), '新行程外洩到匿名可讀的公開清單').toBe(false);
  });

  it('明確指定 published: 1 仍可公開 —— 改的是預設，不是拿掉功能', async () => {
    const res = await onRequestPost(ctx({ ...base, published: 1 }));
    const { tripId } = (await res.json()) as { tripId: string };
    const row = await db.prepare('SELECT published FROM trips WHERE id = ?')
      .bind(tripId).first<{ published: number }>();
    expect(row!.published).toBe(1);
  });
});

describe('前端不再把新行程設為公開', () => {
  it('NewTripPage 不再送 published: 1', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const src = readFileSync(resolve(__dirname, '../../src/pages/NewTripPage.tsx'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src, '建立行程不該預設公開').not.toMatch(/published:\s*1/);
  });
});
