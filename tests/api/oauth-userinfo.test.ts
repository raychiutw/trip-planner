/**
 * GET /api/oauth/userinfo — V2-P1
 * 走 HTTP 邊界（tests/api/http.ts）：認證用真實 session cookie（session_devices 資料列），
 * 回傳內容對照真實 D1 的 users 資料列，不再看 mock 的 prepare／bind 呼叫形狀。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, userIdFor } from './helpers';
import { createApi, type Api } from './http';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';

const SECRET = 'test-userinfo-secret';
const PATH = 'https://x.com/api/oauth/userinfo';
// 專用 email：共用 D1 下只動自己的資料列
const email = (name: string) => `userinfo-${name}@http-test.example`;
const EMAILS = ['full', 'unverified', 'ghost', 'alpha', 'beta'].map(email);
const MOCK_EMAIL = email('mock');

let db: D1Database;
let api: Api;

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { SESSION_SECRET: SECRET }) });
});

afterAll(async () => {
  const ids = [...EMAILS, MOCK_EMAIL].map(userIdFor);
  for (const id of ids) {
    await db.prepare('DELETE FROM session_devices WHERE user_id = ?').bind(id).run();
    await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  }
  await db.prepare("DELETE FROM oauth_models WHERE id = 'userinfo-service-token'").run();
  await disposeMiniflare();
});

async function errorCode(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { code?: string } }).error?.code;
}

describe('GET /api/oauth/userinfo', () => {
  it('401 AUTH_REQUIRED when no session cookie', async () => {
    const res = await api.get(PATH);
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('AUTH_REQUIRED');
  });

  it('401 AUTH_REQUIRED when session token invalid', async () => {
    const res = await api.get(PATH, { cookie: 'tripline_session=tampered.signature' });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('AUTH_REQUIRED');
  });

  it('returns 200 + user payload when session valid + user exists', async () => {
    const { cookie, userId } = await api.sessionFor(email('full'));
    await db
      .prepare('UPDATE users SET display_name = ?, avatar_url = ?, email_verified_at = ?, created_at = ? WHERE id = ?')
      .bind('Me', 'https://avatar.example.com/me.png', '2026-04-25T00:00:00.000Z', '2026-04-20T00:00:00.000Z', userId)
      .run();
    const res = await api.get(PATH, { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(await res.json()).toEqual({
      id: userId,
      email: email('full'),
      emailVerified: true,
      displayName: 'Me',
      avatarUrl: 'https://avatar.example.com/me.png',
      createdAt: '2026-04-20T00:00:00.000Z',
    });
  });

  it('emailVerified = false when email_verified_at is null', async () => {
    const { cookie, userId } = await api.sessionFor(email('unverified'));
    await db
      .prepare('UPDATE users SET display_name = NULL, avatar_url = NULL, email_verified_at = NULL, created_at = ? WHERE id = ?')
      .bind('2026-04-25', userId)
      .run();
    const res = await api.get(PATH, { cookie });
    const json = await res.json() as { emailVerified: boolean; displayName: null; avatarUrl: null; createdAt: string };
    expect(json.emailVerified).toBe(false);
    expect(json.displayName).toBeNull();
    expect(json.avatarUrl).toBeNull();
    // created_at 沒帶 Z 時由 handler 補上
    expect(json.createdAt).toBe('2026-04-25Z');
  });

  it('401 AUTH_INVALID when session valid but user row missing (deleted user)', async () => {
    const { cookie, userId } = await api.sessionFor(email('ghost'));
    await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
    const res = await api.get(PATH, { cookie });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('AUTH_INVALID');
  });

  it('uses the middleware-decorated user for local mock auth (no session cookie)', async () => {
    // _middleware 在本機 mock auth（DEV_MOCK_EMAIL）時不經 session cookie 也會帶出使用者；
    // userinfo 必須採用它，否則本機前端載入時的探測會 401。
    await db
      .prepare('INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)')
      .bind(userIdFor(MOCK_EMAIL), MOCK_EMAIL, 'Mock')
      .run();
    const mockApi = createApi({
      env: mockEnv(db, {
        SESSION_SECRET: SECRET,
        ENVIRONMENT: 'development',
        ALLOW_DEV_MOCK: '1',
        DEV_MOCK_EMAIL: MOCK_EMAIL,
      } as never),
    });
    const res = await mockApi.get(PATH);
    expect(res.status).toBe(200);
    const json = await res.json() as { id: string; email: string; displayName: string };
    expect(json).toMatchObject({ id: userIdFor(MOCK_EMAIL), email: MOCK_EMAIL, displayName: 'Mock' });
  });

  it('service token (bearer without user) does not authenticate userinfo — falls back to session, 401', async () => {
    // 對應原本「auth 物件存在但 userId 為 null」：不可拿 null 去查 users，沒有 cookie 就是 401
    await new D1Adapter(db, 'AccessToken').upsert(
      'userinfo-service-token',
      { client_id: 'userinfo-service', user_id: null, scopes: ['admin'], grantId: 'grant-userinfo-service' },
      300,
    );
    const res = await api.get(PATH, { bearer: 'userinfo-service-token' });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('AUTH_REQUIRED');
  });

  it('a user bearer token alone does not authenticate userinfo (session cookie only) — 401', async () => {
    // 對應原本「middleware 沒帶 auth（auth = null）且沒有 cookie」：一律 401
    const bearer = await api.tokenFor(email('alpha'));
    const res = await api.get(PATH, { bearer });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('AUTH_REQUIRED');
  });

  it('returns the row of the session user, not another user', async () => {
    const alpha = await api.sessionFor(email('alpha'));
    const beta = await api.sessionFor(email('beta'));
    const a = await (await api.get(PATH, { cookie: alpha.cookie })).json() as { id: string; email: string };
    const b = await (await api.get(PATH, { cookie: beta.cookie })).json() as { id: string; email: string };
    expect(a).toMatchObject({ id: alpha.userId, email: email('alpha') });
    expect(b).toMatchObject({ id: beta.userId, email: email('beta') });
  });
});
