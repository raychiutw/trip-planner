/**
 * GET /api/oauth/login/google — V2-P1
 * 走 HTTP 邊界（tests/api/http.ts）；暫存的 state 改驗真實 D1 的 oauth_models，不看 mock 呼叫形狀。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi } from './http';

let db: D1Database;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(disposeMiniflare);

const api = (clientId?: string) => createApi({ env: mockEnv(db, clientId ? { GOOGLE_CLIENT_ID: clientId } : {}) });

/** 從 Google authorize URL 取出 state，再到 D1 讀出對應的暫存資料。 */
async function storedState(res: Response): Promise<{ payload: Record<string, unknown>; expiresAt: number }> {
  const state = new URL(res.headers.get('Location')!).searchParams.get('state')!;
  const row = await db
    .prepare("SELECT payload, expires_at FROM oauth_models WHERE name = 'OAuthState' AND id = ?")
    .bind(state)
    .first<{ payload: string; expires_at: number }>();
  expect(row).not.toBeNull();
  return { payload: JSON.parse(row!.payload), expiresAt: row!.expires_at };
}

describe('GET /api/oauth/login/google', () => {
  it('returns 503 OAUTH_NOT_CONFIGURED when GOOGLE_CLIENT_ID missing', async () => {
    const res = await api().get('https://x.com/api/oauth/login/google');
    expect(res.status).toBe(503);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_NOT_CONFIGURED');
  });

  it('redirects 302 to Google authorize URL when configured', async () => {
    const res = await api('test-client-id').get('https://trip-planner-dby.pages.dev/api/oauth/login/google');
    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    expect(location).toContain('client_id=test-client-id');
    expect(location).toContain('response_type=code');
    expect(location).toContain('scope=openid+profile+email');
    expect(location).toContain('redirect_uri=https%3A%2F%2Ftrip-planner-dby.pages.dev%2Fapi%2Foauth%2Fcallback%2Fgoogle');
    expect(location).toContain('access_type=offline');
    expect(location).toContain('prompt=consent');
    expect(location).toMatch(/state=[A-Za-z0-9_-]+/);
  });

  it('stores state in D1 oauth_models with 5min TTL', async () => {
    const before = Date.now();
    const res = await api('gid').get('https://x.com/api/oauth/login/google');
    const after = Date.now();
    const { payload, expiresAt } = await storedState(res);
    expect(payload.provider).toBe('google');
    expect(expiresAt).toBeGreaterThanOrEqual(before + 300 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(after + 300 * 1000);
  });

  it('open redirect protection: redirect_after_login must start with single /', async () => {
    // open redirect attempt: //evil.com → 應 fallback default
    const res = await api('gid').get('https://x.com/api/oauth/login/google?redirect_after_login=//evil.com/steal');
    expect(res.status).toBe(302);
    expect((await storedState(res)).payload.redirectAfterLogin).toBe('/manage');
  });

  it('open redirect protection: absolute URL → fallback default', async () => {
    const res = await api('gid').get('https://x.com/api/oauth/login/google?redirect_after_login=https://evil.com');
    expect(res.status).toBe(302);
    expect((await storedState(res)).payload.redirectAfterLogin).toBe('/manage');
  });

  it('valid same-origin redirect_after_login preserved', async () => {
    const res = await api('gid').get('https://x.com/api/oauth/login/google?redirect_after_login=/trip/test-trip');
    expect((await storedState(res)).payload.redirectAfterLogin).toBe('/trip/test-trip');
  });

  it('state is unique across calls (32 bytes random)', async () => {
    const res1 = await api('gid').get('https://x.com/api/oauth/login/google');
    const res2 = await api('gid').get('https://x.com/api/oauth/login/google');
    const state1 = new URL(res1.headers.get('Location')!).searchParams.get('state');
    const state2 = new URL(res2.headers.get('Location')!).searchParams.get('state');
    expect(state1).not.toBe(state2);
    expect(state1!.length).toBeGreaterThan(40);
  });
});
