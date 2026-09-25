// @vitest-environment node
/**
 * DELETE /api/account — 帳號刪除 endpoint
 *
 * Google Play 對「可建立帳號的 app」**強制要求**帳號刪除路徑（app 內 + 網頁各一條）。
 *
 * 這支用**真 Miniflare D1**（非 mock DB）—— 本 endpoint 的重點就是「資料真的被刪掉」，
 * mock 掉 DB 等於在測自己寫的 mock。
 *
 * 安全性要求（不可退讓）：
 *   - 未登入 → 401
 *   - 有密碼身分的帳號 → 必須帶密碼二次確認才可刪（不可逆操作）
 *   - 密碼錯 → 401，且**不得**動到任何資料
 *   - 成功後 → 使用者資料消失、session cookie 被清除
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { onRequestDelete, onRequestGet } from '../../functions/api/account/index';
import { onRequestGet as startGoogle } from '../../functions/api/oauth/login/google';
import { onRequestGet as completeGoogle } from '../../functions/api/oauth/callback/google';
import { onRequestPost as startMobileChallenge, onRequestGet as mobileChallengeStatus,
  onRequestDelete as cancelMobileChallenge } from '../../functions/api/account/delete-reauth';
import { issueSession } from '../../functions/api/_session';
import { onRequest as middleware } from '../../functions/api/_middleware';
import { hashPassword } from '../../src/server/password';
import { createTestDb, disposeMiniflare } from './setup';
import { mockAuth, mockContext, mockEnv } from './helpers';
import { MOBILE_PROD_REDIRECT } from '../../functions/api/_mobileOAuth';
import { grantDeleteReauth } from '../../functions/api/account/_deleteReauth';

const SESSION_SECRET = 'test-secret-32-chars-long-enough';
vi.mock('../../src/server/oauth-client/google-id-token', () => ({
  verifyGoogleIdToken: vi.fn(async (idToken: string) => JSON.parse(atob(idToken.split('.')[1]!))),
}));

function googleToken(claims: object): string {
  return `header.${btoa(JSON.stringify(claims))}.signature`;
}

describe('DELETE /api/account', () => {
  let db: D1Database;

  beforeAll(async () => { db = await createTestDb(); }, 30000);
  afterAll(async () => { await disposeMiniflare(); });

  let seq = 0;
  /** users.id 是 TEXT PK（非 autoincrement）→ 必須顯式給值。 */
  async function seedUser(password?: string): Promise<{ id: string; email: string }> {
    const id = `del-u${++seq}`;
    const email = `${id}@example.com`;
    await db.prepare(`INSERT INTO users (id, email, display_name, status) VALUES (?, ?, ?, 'active')`)
      .bind(id, email, id).run();
    if (password) {
      await db.prepare(
        `INSERT INTO auth_identities (user_id, provider, provider_user_id, password_hash, password_algo)
         VALUES (?, 'local', ?, ?, 'pbkdf2')`,
      ).bind(id, email, await hashPassword(password)).run();
    }
    return { id, email };
  }

  function env() {
    return { SESSION_SECRET, DB: db, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com' } as unknown as never;
  }

  async function authedRequest(userId: string, body: unknown): Promise<Request> {
    const carrier = new Response(null);
    await issueSession(
      new Request('https://x.com', { headers: { 'CF-Connecting-IP': '1.1.1.1' } }),
      carrier, userId, { SESSION_SECRET } as never,
    );
    const cookie = (carrier.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '';
    return new Request('https://x.com/api/account', {
      method: 'DELETE',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function ctx(request: Request) {
    return {
      request, env: env(), params: {} as never, data: {} as never,
      next: () => Promise.resolve(new Response()),
      waitUntil: () => undefined, passThroughOnException: () => undefined,
    } as unknown as Parameters<typeof onRequestDelete>[0];
  }

  // handler 直接 throw AppError，由 _middleware 轉成 Response —— 直接呼叫 handler 時
  // 拿到的是 throw。既有 account-sessions.test.ts 同慣例。
  it('未登入 → AUTH_REQUIRED', async () => {
    const req = new Request('https://x.com/api/account', { method: 'DELETE' });
    await expect(onRequestDelete(ctx(req))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('有密碼身分但沒帶密碼 → 400，且資料不動', async () => {
    const u = await seedUser('correct-horse-battery');
    await expect(onRequestDelete(ctx(await authedRequest(u.id, {}))))
      .rejects.toMatchObject({ code: 'ACCOUNT_DELETE_CONFIRM_REQUIRED' });

    const still = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(u.id).first<{ n: number }>();
    expect(still!.n, '未確認前不得刪除任何資料').toBe(1);
  });

  it('密碼錯 → 401，且資料不動', async () => {
    const u = await seedUser('correct-horse-battery');
    await expect(onRequestDelete(ctx(await authedRequest(u.id, { password: 'wrong-password' }))))
      .rejects.toMatchObject({ code: 'ACCOUNT_DELETE_PASSWORD_INVALID' });

    const still = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(u.id).first<{ n: number }>();
    expect(still!.n, '密碼錯時不得刪除任何資料').toBe(1);
  });

  it('密碼正確 → 200，使用者與其行程都消失', async () => {
    const u = await seedUser('correct-horse-battery');
    await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
      .bind('del-trip-1', '待刪', u.id).run();

    const res = await onRequestDelete(ctx(await authedRequest(u.id, { password: 'correct-horse-battery' })));
    expect(res.status).toBe(200);

    const user = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(u.id).first<{ n: number }>();
    const trip = await db.prepare('SELECT count(*) AS n FROM trips WHERE id = ?').bind('del-trip-1').first<{ n: number }>();
    expect(user!.n, '使用者應消失').toBe(0);
    expect(trip!.n, '擁有的行程應一併刪除').toBe(0);
  });

  it('成功時清除 session cookie（不能讓已刪帳號的 cookie 還能用）', async () => {
    const u = await seedUser('correct-horse-battery');
    await db.prepare("INSERT INTO oauth_models (name, id, payload, expires_at) VALUES ('AccessToken', ?, ?, ?)")
      .bind('access-before-delete', JSON.stringify({ user_id: u.id, client_id: 'tripline-mobile', scopes: ['openid'] }), Date.now() + 60000).run();
    const res = await onRequestDelete(ctx(await authedRequest(u.id, { password: 'correct-horse-battery' })));
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie, '必須回 Set-Cookie 清除 session').toMatch(/Max-Age=0|Expires=/i);
    const token = await db.prepare("SELECT id FROM oauth_models WHERE name = 'AccessToken' AND id = ?")
      .bind('access-before-delete').first();
    expect(token, '帳號刪除後舊 access token 不可再代表使用者').toBeNull();
  });

  it('回傳刪除摘要（使用者要看得到動了什麼）', async () => {
    const u = await seedUser('correct-horse-battery');
    await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
      .bind('del-trip-2', '摘要', u.id).run();

    const res = await onRequestDelete(ctx(await authedRequest(u.id, { password: 'correct-horse-battery' })));
    const json = await res.json() as { ok: boolean; tripsDeleted: number };
    expect(json.ok).toBe(true);
    expect(json.tripsDeleted).toBe(1);
  });

  // ── GET /api/account —— 刪除前的影響預覽 ──────────────────────────
  // 確認對話框必須顯示「會刪掉什麼」。owner 決策是「行程一併刪除，含共編者的」，
  // 所以使用者按下去之前一定要看到受影響的共編人數 —— 猜不得，只能後端算。
  describe('GET /api/account — 刪除影響預覽', () => {
    function getCtx(request: Request) {
      return {
        request, env: env(), params: {} as never, data: {} as never,
        next: () => Promise.resolve(new Response()),
        waitUntil: () => undefined, passThroughOnException: () => undefined,
      } as unknown as Parameters<typeof onRequestGet>[0];
    }
    async function authedGet(userId: string): Promise<Request> {
      const carrier = new Response(null);
      await issueSession(
        new Request('https://x.com', { headers: { 'CF-Connecting-IP': '1.1.1.1' } }),
        carrier, userId, { SESSION_SECRET } as never,
      );
      const cookie = (carrier.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '';
      return new Request('https://x.com/api/account', { headers: { Cookie: cookie } });
    }

    it('未登入 → AUTH_REQUIRED', async () => {
      await expect(onRequestGet(getCtx(new Request('https://x.com/api/account'))))
        .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    });

    it('回報該帳號要用密碼還是確認字串', async () => {
      const withPw = await seedUser('correct-horse-battery');
      const r1 = await onRequestGet(getCtx(await authedGet(withPw.id)));
      expect((await r1.json() as { hasPassword: boolean }).hasPassword).toBe(true);

      const oauthOnly = await seedUser();
      const r2 = await onRequestGet(getCtx(await authedGet(oauthOnly.id)));
      expect(await r2.json()).toMatchObject({ hasPassword: false, reauthProvider: null, reauthenticated: false });
    });

    it('回報會被刪掉的行程數，以及受影響的共編人數', async () => {
      const owner = await seedUser('preview-pass-1234');
      const mate1 = await seedUser();
      const mate2 = await seedUser();
      await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
        .bind('preview-trip', '有共編', owner.id).run();
      // 兩位共編者 + owner 自己的權限列
      for (const m of [mate1, mate2]) {
        await db.prepare(`INSERT INTO trip_permissions (trip_id, user_id, role) VALUES (?, ?, 'member')`)
          .bind('preview-trip', m.id).run();
      }
      await db.prepare(`INSERT INTO trip_permissions (trip_id, user_id, role) VALUES (?, ?, 'owner')`)
        .bind('preview-trip', owner.id).run();

      const res = await onRequestGet(getCtx(await authedGet(owner.id)));
      const body = await res.json() as { tripsOwned: number; collaboratorsAffected: number };
      expect(body.tripsOwned).toBe(1);
      expect(body.collaboratorsAffected, '不可把 owner 自己算進共編人數').toBe(2);
    });
  });

  it('純 OAuth 帳號只輸入確認字串仍不能刪除', async () => {
    // Google 登入的使用者沒有 password_hash，不能要求他打密碼。
    // 改要求顯式確認字串，避免誤觸這個不可逆操作。
    const u = await seedUser(); // 無密碼

    await expect(onRequestDelete(ctx(await authedRequest(u.id, {}))), '無密碼帳號仍需確認')
      .rejects.toMatchObject({ code: 'ACCOUNT_DELETE_CONFIRM_REQUIRED' });

    await expect(onRequestDelete(ctx(await authedRequest(u.id, { confirm: 'DELETE' }))))
      .rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });

    const left = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(u.id).first<{ n: number }>();
    expect(left!.n).toBe(1);
  });

  it('抹除批次失敗後可用同一個未過期的 Google 證明重試', async () => {
    const u = await seedUser();
    const request = await authedRequest(u.id, { confirm: 'DELETE' });
    expect(await grantDeleteReauth(db, request, u.id)).toBe(true);
    await db.prepare(`CREATE TRIGGER account_delete_retry_fail BEFORE DELETE ON users
      WHEN OLD.id = '${u.id}' BEGIN SELECT RAISE(ABORT, 'simulated erasure failure'); END`).run();
    try {
      await expect(onRequestDelete(ctx(request.clone()))).rejects.toThrow();
      expect(await db.prepare('SELECT id FROM users WHERE id = ?').bind(u.id).first()).not.toBeNull();
    } finally {
      await db.prepare('DROP TRIGGER account_delete_retry_fail').run();
    }
    const res = await onRequestDelete(ctx(request.clone()));
    expect(res.status).toBe(200);
    expect(await db.prepare('SELECT id FROM users WHERE id = ?').bind(u.id).first()).toBeNull();
  });

  it('mobile Bearer 可讀刪除預覽，不能只憑 token 刪除', async () => {
    const u = await seedUser();
    await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES (?, 'google', ?)")
      .bind(u.id, `mobile-google-${u.id}`).run();
    await db.prepare("INSERT INTO oauth_models (name, id, payload, expires_at) VALUES ('AccessToken', ?, ?, ?)")
      .bind(`mobile-token-${u.id}`, JSON.stringify({ user_id: u.id, client_id: 'tripline-mobile', scopes: ['openid', 'profile'], grantId: `grant-${u.id}` }), Date.now() + 60000).run();
    const authEnv = mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com' });
    async function call(method: 'GET' | 'DELETE') {
      const request = new Request('https://x.com/api/account', {
        method, headers: { Authorization: `Bearer mobile-token-${u.id}` },
        ...(method === 'DELETE' ? { body: JSON.stringify({ confirm: 'DELETE' }) } : {}),
      });
      const data = {};
      const context = { request, env: authEnv, data, params: {}, waitUntil: () => {}, passThroughOnException: () => {},
        next: () => (method === 'GET' ? onRequestGet : onRequestDelete)({ request, env: authEnv, data } as never) };
      return middleware(context as never);
    }
    expect((await call('GET')).status).toBe(200);
    expect((await call('DELETE')).status).toBe(403);
  });

  it('mobile challenge 綁定 grant，可查狀態並取消；別的 grant 無法讀取', async () => {
    const u = await seedUser();
    await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES (?, 'google', ?)")
      .bind(u.id, `mobile-google-${u.id}`).run();
    const auth = mockAuth({ userId: u.id, clientId: 'tripline-mobile', grantId: `grant-${u.id}` });
    const mobileEnv = mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com', MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT });
    const req = (method: string, challengeId?: string) => new Request(
      `https://x.com/api/account/delete-reauth${challengeId ? `?challenge_id=${challengeId}` : ''}`, { method },
    );
    const started = await startMobileChallenge(mockContext({ request: req('POST'), env: mobileEnv, auth }) as never);
    expect(started.status).toBe(200);
    const body = await started.json() as { challengeId: string; authorizeUrl: string; expiresIn: number };
    expect(body.expiresIn).toBe(300);
    expect(body.authorizeUrl).toContain(`challenge=${body.challengeId}`);
    const otherGrant = mockAuth({ ...auth, grantId: 'another-grant' });
    await expect(mobileChallengeStatus(mockContext({ request: req('GET', body.challengeId), env: mobileEnv, auth: otherGrant }) as never))
      .rejects.toMatchObject({ code: 'DATA_NOT_FOUND' });
    expect(await (await mobileChallengeStatus(mockContext({ request: req('GET', body.challengeId), env: mobileEnv, auth }) as never)).json())
      .toMatchObject({ status: 'pending' });
    expect((await cancelMobileChallenge(mockContext({ request: req('DELETE', body.challengeId), env: mobileEnv, auth }) as never)).status).toBe(200);
    expect(await (await mobileChallengeStatus(mockContext({ request: req('GET', body.challengeId), env: mobileEnv, auth }) as never)).json())
      .toMatchObject({ status: 'cancelled' });
  });

  it('mobile Bearer 的 Google challenge 完成後只准同 grant 刪除一次', async () => {
    const u = await seedUser();
    await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES (?, 'google', ?)")
      .bind(u.id, `mobile-google-${u.id}`).run();
    const auth = mockAuth({ userId: u.id, clientId: 'tripline-mobile', grantId: `grant-${u.id}` });
    const mobileEnv = mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret',
      MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT });
    const started = await startMobileChallenge(mockContext({ request: new Request('https://x.com/api/account/delete-reauth', { method: 'POST' }), env: mobileEnv, auth }) as never);
    const { challengeId, authorizeUrl } = await started.json() as { challengeId: string; authorizeUrl: string };
    const google = await startGoogle(mockContext({ request: new Request(authorizeUrl), env: mobileEnv }) as never);
    const state = new URL(google.headers.get('Location')!).searchParams.get('state')!;
    const idToken = googleToken({ sub: `mobile-google-${u.id}`, email: u.email, email_verified: true, auth_time: Math.floor(Date.now() / 1000) });
    const provider = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id_token: idToken, access_token: 'a' })));
    try {
      const done = await completeGoogle(mockContext({ request: new Request(`https://x.com/api/oauth/callback/google?code=c&state=${state}`), env: mobileEnv }) as never);
      expect(done.status).toBe(302);
      expect(done.headers.get('Location')).toBe(`${MOBILE_PROD_REDIRECT}?challenge_id=${challengeId}&status=verified`);
      const check = await mobileChallengeStatus(mockContext({ request: new Request(`https://x.com/api/account/delete-reauth?challenge_id=${challengeId}`), env: mobileEnv, auth }) as never);
      expect(await check.json()).toMatchObject({ status: 'verified' });
      const deleteRequest = new Request('https://x.com/api/account', { method: 'DELETE', headers: { Authorization: 'Bearer mobile-token' },
        body: JSON.stringify({ confirm: 'DELETE', challengeId }) });
      const otherGrant = mockAuth({ ...auth, grantId: 'other-grant' });
      await expect(onRequestDelete(mockContext({ request: deleteRequest.clone(), env: mobileEnv, auth: otherGrant }) as never))
        .rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
      expect((await onRequestDelete(mockContext({ request: deleteRequest, env: mobileEnv, auth }) as never)).status).toBe(200);
      expect(await db.prepare('SELECT id FROM users WHERE id = ?').bind(u.id).first()).toBeNull();
    } finally { provider.mockRestore(); }
  });

  it('mobile 使用者拒絕 Google 驗證會得到可重試的失敗狀態，帳號不動', async () => {
    const u = await seedUser();
    await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES (?, 'google', ?)")
      .bind(u.id, `mobile-google-${u.id}`).run();
    const auth = mockAuth({ userId: u.id, clientId: 'tripline-mobile', grantId: `grant-${u.id}` });
    const mobileEnv = mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret',
      MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT });
    const started = await startMobileChallenge(mockContext({ request: new Request('https://x.com/api/account/delete-reauth', { method: 'POST' }), env: mobileEnv, auth }) as never);
    const { challengeId, authorizeUrl } = await started.json() as { challengeId: string; authorizeUrl: string };
    const google = await startGoogle(mockContext({ request: new Request(authorizeUrl), env: mobileEnv }) as never);
    const state = new URL(google.headers.get('Location')!).searchParams.get('state')!;
    const denied = await completeGoogle(mockContext({ request: new Request(`https://x.com/api/oauth/callback/google?error=access_denied&state=${state}`), env: mobileEnv }) as never);
    expect(denied.headers.get('Location')).toBe(`${MOBILE_PROD_REDIRECT}?challenge_id=${challengeId}&status=failed`);
    const check = await mobileChallengeStatus(mockContext({ request: new Request(`https://x.com/api/account/delete-reauth?challenge_id=${challengeId}`), env: mobileEnv, auth }) as never);
    expect(await check.json()).toMatchObject({ status: 'failed' });
    expect(await db.prepare('SELECT id FROM users WHERE id = ?').bind(u.id).first()).not.toBeNull();
  });

  it('同帳號完成 Google 近期驗證後可一次性刪除', async () => {
    const u = await seedUser();
    await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES (?, 'google', ?)")
      .bind(u.id, 'google-sub').run();
    const cookie = (await authedRequest(u.id, {})).headers.get('Cookie')!;
    const oauthCtx = (request: Request) => ({ ...ctx(request), env: { ...env(), GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret' } });
    const start = await startGoogle(oauthCtx(new Request('https://x.com/api/oauth/login/google?purpose=account-delete', { headers: { Cookie: cookie } })));
    const location = new URL(start.headers.get('Location')!);
    expect(location.searchParams.get('prompt')).toBe('select_account');
    expect(location.searchParams.get('max_age')).toBe('0');
    expect(JSON.parse(location.searchParams.get('claims')!)).toEqual({ id_token: { auth_time: { essential: true } } });
    const state = location.searchParams.get('state')!;
    const idToken = googleToken({ sub: 'google-sub', email: u.email, email_verified: true, auth_time: Math.floor(Date.now() / 1000) });
    const provider = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id_token: idToken, access_token: 'a' })));
    try {
      const done = await completeGoogle(oauthCtx(new Request(`https://x.com/api/oauth/callback/google?code=c&state=${state}`, { headers: { Cookie: cookie } })));
      expect(new URL(done.headers.get('Location')!).pathname + new URL(done.headers.get('Location')!).search).toBe('/account?deleteReauth=done');
      expect(done.headers.get('Set-Cookie')).toBeNull();
      const deleteRequest = new Request('https://x.com/api/account', { method: 'DELETE', headers: { Cookie: cookie }, body: JSON.stringify({ confirm: 'DELETE' }) });
      expect((await onRequestDelete(ctx(deleteRequest))).status).toBe(200);
    } finally { provider.mockRestore(); }
  });

  it.each([
    ['另一個 Google 帳號', 'different-sub', Math.floor(Date.now() / 1000)],
    ['不是近期驗證', 'google-sub', Math.floor(Date.now() / 1000) - 600],
    ['未來的驗證時間', 'google-sub', Math.floor(Date.now() / 1000) + 600],
  ])('%s 不得取得刪除授權', async (_case, sub, authTime) => {
    const u = await seedUser();
    const ownSub = `google-sub-${u.id}`;
    await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES (?, 'google', ?)")
      .bind(u.id, ownSub).run();
    const cookie = (await authedRequest(u.id, {})).headers.get('Cookie')!;
    const oauthCtx = (request: Request) => ({ ...ctx(request), env: { ...env(), GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret' } });
    const start = await startGoogle(oauthCtx(new Request('https://x.com/api/oauth/login/google?purpose=account-delete', { headers: { Cookie: cookie } })));
    const state = new URL(start.headers.get('Location')!).searchParams.get('state')!;
    const idToken = googleToken({ sub: sub === 'google-sub' ? ownSub : sub, email: u.email, email_verified: true, auth_time: authTime });
    const provider = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id_token: idToken, access_token: 'a' })));
    try {
      const done = await completeGoogle(oauthCtx(new Request(`https://x.com/api/oauth/callback/google?code=c&state=${state}`, { headers: { Cookie: cookie } })));
      expect(done.status).toBe(302);
      expect(done.headers.get('Location')).toBe('https://x.com/account?deleteReauth=failed');
      await expect(onRequestDelete(ctx(new Request('https://x.com/api/account', {
        method: 'DELETE', headers: { Cookie: cookie }, body: JSON.stringify({ confirm: 'DELETE' }),
      })))).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
      expect(await db.prepare('SELECT id FROM users WHERE id = ?').bind(u.id).first()).not.toBeNull();
    } finally { provider.mockRestore(); }
  });
});
