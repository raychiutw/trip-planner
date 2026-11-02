/**
 * _middleware.ts /api/oauth/* bypass（V2-P1）— 走 HTTP 邊界
 *
 * OAuth endpoints 自管 auth (PKCE / JWT)，不該被 user-session middleware 攔截 401；
 * 但 body encoding 驗證仍要套用。原本是讀 middleware 原始碼比對字串，改成真實請求看回應。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi, type Api } from './http';

let db: D1Database;
let api: Api;

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db) });
});

afterAll(disposeMiniflare);

describe('_middleware.ts — OAuth bypass (V2-P1)', () => {
  it('/api/oauth/* 不需登入：匿名請求不會被擋成 401（對照組：同為匿名的 /api/requests 回 401）', async () => {
    const oauth = await api.get('https://test.com/api/oauth/logout');
    expect(oauth.status).toBe(302);
    const guarded = await api.get('https://test.com/api/requests');
    expect(guarded.status).toBe(401);
  });

  it('bypass 後 auth 為 null：即使帶了無效的 Bearer 也照常放行，不會被當成認證失敗', async () => {
    const res = await api.get('https://test.com/api/oauth/logout', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login');
  });

  it('公開端點 POST /api/reports 同樣不需登入（oauth bypass 與公開端點各自 short-circuit）', async () => {
    const res = await api.request('POST', 'https://test.com/api/reports', {
      headers: { Origin: 'https://trip-planner-dby.pages.dev' },
      json: { tripId: 'oauth-bypass-no-such-trip', url: '/x', errorMessage: 'boom' },
    });
    expect(res.status).toBe(201);
  });

  it('bypass 在 UTF-8 檢查之後：/api/oauth/* 的非 JSON body 若不是合法 UTF-8 仍回 400 DATA_ENCODING', async () => {
    const res = await api.fetch(new Request('https://test.com/api/oauth/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new Uint8Array([0xff, 0xfe, 0xfd]),
    }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DATA_ENCODING');
  });
});
