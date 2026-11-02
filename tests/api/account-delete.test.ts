// @vitest-environment node
/**
 * DELETE /api/account — 帳號刪除 endpoint
 *
 * Google Play 對「可建立帳號的 app」**強制要求**帳號刪除路徑（app 內 + 網頁各一條）。
 *
 * 走 HTTP 邊界（tests/api/http.ts），session 是真實簽出的 cookie；
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
import { hashPassword } from '../../src/server/password';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi, type Api } from './http';
import { MOBILE_PROD_REDIRECT } from '../../functions/api/_mobileOAuth';

const SESSION_SECRET = 'test-secret-32-chars-long-enough';
const ORIGIN = 'https://x.com';

// Google id_token 驗證：測試用的 id_token 是「header.<base64 claims>.signature」，直接把 claims 當驗證結果
vi.mock('../../src/server/oauth-client/google-id-token', () => ({
  verifyGoogleIdToken: vi.fn(async (idToken: string) => JSON.parse(atob(idToken.split('.')[1]!))),
}));

function googleToken(claims: object): string {
  return `header.${btoa(JSON.stringify(claims))}.signature`;
}

describe('DELETE /api/account', () => {
  let db: D1Database;
  let api: Api;

  beforeAll(async () => {
    db = await createTestDb();
    api = createApi({ env: mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: ORIGIN }) });
  }, 30000);

  afterAll(async () => {
    // 共用 D1：清掉自己建立的資料（成功刪除的帳號本來就沒了，這裡收失敗案例留下的）
    await db.prepare(`DELETE FROM trip_permissions WHERE trip_id IN ('del-trip-1','del-trip-2','preview-trip','preview-trip-a','preview-trip-b')`).run();
    await db.prepare(`DELETE FROM trips WHERE id IN ('del-trip-1','del-trip-2','preview-trip','preview-trip-a','preview-trip-b')`).run();
    await db.prepare(`DELETE FROM session_devices WHERE user_id LIKE 'del-u%'`).run();
    await db.prepare(`DELETE FROM auth_identities WHERE user_id LIKE 'del-u%'`).run();
    await db.prepare(`DELETE FROM oauth_models WHERE id = 'access-before-delete' OR id LIKE 'mobile-token-%'`).run();
    await db.prepare(`DELETE FROM users WHERE id LIKE 'del-u%'`).run();
    await disposeMiniflare();
  });

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

  async function del(u: { id: string; email: string }, body: unknown): Promise<Response> {
    const { cookie } = await api.sessionFor(u.email, u.id);
    return api.request('DELETE', '/api/account', { cookie, json: body });
  }

  async function userCount(id: string): Promise<number> {
    const row = await db.prepare('SELECT count(*) AS n FROM users WHERE id = ?').bind(id).first<{ n: number }>();
    return row!.n;
  }

  async function errorCode(res: Response): Promise<string> {
    return (await res.json() as { error: { code: string } }).error.code;
  }

  it('未登入 → AUTH_REQUIRED', async () => {
    const res = await api.request('DELETE', '/api/account', { headers: { Origin: 'https://trip-planner-dby.pages.dev' } });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('AUTH_REQUIRED');
  });

  it('有密碼身分但沒帶密碼 → 400，且資料不動', async () => {
    const u = await seedUser('correct-horse-battery');
    const res = await del(u, {});
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe('ACCOUNT_DELETE_CONFIRM_REQUIRED');

    expect(await userCount(u.id), '未確認前不得刪除任何資料').toBe(1);
  });

  it('密碼錯 → 401，且資料不動', async () => {
    const u = await seedUser('correct-horse-battery');
    const res = await del(u, { password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('ACCOUNT_DELETE_PASSWORD_INVALID');

    expect(await userCount(u.id), '密碼錯時不得刪除任何資料').toBe(1);
  });

  it('密碼正確 → 200，使用者與其行程都消失', async () => {
    const u = await seedUser('correct-horse-battery');
    await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
      .bind('del-trip-1', '待刪', u.id).run();

    const res = await del(u, { password: 'correct-horse-battery' });
    expect(res.status).toBe(200);

    const trip = await db.prepare('SELECT count(*) AS n FROM trips WHERE id = ?').bind('del-trip-1').first<{ n: number }>();
    expect(await userCount(u.id), '使用者應消失').toBe(0);
    expect(trip!.n, '擁有的行程應一併刪除').toBe(0);
  });

  it('成功時清除 session cookie（不能讓已刪帳號的 cookie 還能用）', async () => {
    const u = await seedUser('correct-horse-battery');
    await db.prepare("INSERT INTO oauth_models (name, id, payload, expires_at) VALUES ('AccessToken', ?, ?, ?)")
      .bind('access-before-delete', JSON.stringify({ user_id: u.id, client_id: 'tripline-mobile', scopes: ['openid'] }), Date.now() + 60000).run();
    const res = await del(u, { password: 'correct-horse-battery' });
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

    const res = await del(u, { password: 'correct-horse-battery' });
    const json = await res.json() as { ok: boolean; tripsDeleted: number };
    expect(json.ok).toBe(true);
    expect(json.tripsDeleted).toBe(1);
  });

  // ── GET /api/account —— 刪除前的影響預覽 ──────────────────────────
  // 確認對話框必須顯示「會刪掉什麼」。owner 決策是「行程一併刪除，含共編者的」，
  // 所以使用者按下去之前一定要看到受影響的共編人數 —— 猜不得，只能後端算。
  describe('GET /api/account — 刪除影響預覽', () => {
    async function preview(u: { id: string; email: string }): Promise<Response> {
      const { cookie } = await api.sessionFor(u.email, u.id);
      return api.get('/api/account', { cookie });
    }

    it('未登入 → AUTH_REQUIRED', async () => {
      const res = await api.get('/api/account');
      expect(res.status).toBe(401);
      expect(await errorCode(res)).toBe('AUTH_REQUIRED');
    });

    it('回報該帳號要用密碼還是確認字串', async () => {
      const withPw = await seedUser('correct-horse-battery');
      const r1 = await preview(withPw);
      expect((await r1.json() as { hasPassword: boolean }).hasPassword).toBe(true);

      const oauthOnly = await seedUser();
      const r2 = await preview(oauthOnly);
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

      const res = await preview(owner);
      const body = await res.json() as { tripsOwned: number; collaboratorsAffected: number };
      expect(body.tripsOwned).toBe(1);
      expect(body.collaboratorsAffected, '不可把 owner 自己算進共編人數').toBe(2);
    });

    it('同一位共編者出現在多個行程，只算一人（DISTINCT）', async () => {
      const owner = await seedUser('preview-pass-1234');
      const mate = await seedUser();
      for (const tripId of ['preview-trip-a', 'preview-trip-b']) {
        await db.prepare(`INSERT INTO trips (id, name, owner_user_id, published) VALUES (?, ?, ?, 1)`)
          .bind(tripId, tripId, owner.id).run();
        await db.prepare(`INSERT INTO trip_permissions (trip_id, user_id, role) VALUES (?, ?, 'member')`)
          .bind(tripId, mate.id).run();
      }
      const body = await (await preview(owner)).json() as { tripsOwned: number; collaboratorsAffected: number };
      expect(body.tripsOwned).toBe(2);
      expect(body.collaboratorsAffected).toBe(1);
    });
  });

  it('同時帶有效的 session cookie 與 Bearer 標頭：以瀏覽器身分處理，不被導去 mobile 路徑', async () => {
    // 共用 cookie 的 webview 或會自動加標頭的代理，可能讓請求同時帶兩者；middleware 以 cookie 優先認證，
    // 這支 endpoint 也要看「實際認證出來的身分」而不是「有沒有 Authorization 標頭」。
    const u = await seedUser('correct-horse-battery');
    const { cookie } = await api.sessionFor(u.email, u.id);
    const both = { cookie, headers: { Authorization: 'Bearer some-other-token' } };

    const preview = await api.get('/api/account', both);
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({ hasPassword: true });

    const deleted = await api.request('DELETE', '/api/account', { ...both, json: { password: 'correct-horse-battery' } });
    expect(deleted.status).toBe(200);
    expect(await userCount(u.id)).toBe(0);
  });

  it('純 OAuth 帳號只輸入確認字串仍不能刪除', async () => {
    // Google 登入的使用者沒有 password_hash，不能要求他打密碼；只輸入確認字串也不夠，必須先完成近期的 Google 重新驗證。
    const u = await seedUser(); // 無密碼

    const refused = await del(u, {});
    expect(refused.status, '無密碼帳號仍需確認').toBe(400);
    expect(await errorCode(refused)).toBe('ACCOUNT_DELETE_CONFIRM_REQUIRED');

    const noProof = await del(u, { confirm: 'DELETE' });
    expect(noProof.status).toBe(403);
    expect(await errorCode(noProof)).toBe('ACCOUNT_DELETE_REAUTH_REQUIRED');
    expect(await userCount(u.id)).toBe(1);
  });

  // ── Google 重新驗證（cookie flow）與 mobile challenge —— 全走 HTTP 邊界 ──
  describe('Google 近期重新驗證', () => {
    /** 帶 Google 設定的 api（env 與 prod 相同：production + PUBLIC_ORIGIN）。 */
    const apiG = () => createApi({ env: mockEnv(db, {
      SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: ORIGIN,
      GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret', MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT,
    }) });

    async function seedGoogleUser(): Promise<{ id: string; email: string; sub: string }> {
      const u = await seedUser();
      const sub = `google-sub-${u.id}`;
      await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES (?, 'google', ?)")
        .bind(u.id, sub).run();
      return { ...u, sub };
    }

    /** 用 Google 的 token endpoint 回應 id_token（攔 global fetch），打 callback。 */
    async function callback(api2: Api, state: string, idToken: string, opts: { cookie?: string } = {}): Promise<Response> {
      const provider = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id_token: idToken, access_token: 'a' })));
      try {
        return await api2.get(`${ORIGIN}/api/oauth/callback/google?code=c&state=${state}`, opts.cookie ? { cookie: opts.cookie } : {});
      } finally { provider.mockRestore(); }
    }

    const nowSec = () => Math.floor(Date.now() / 1000);

    /** 瀏覽器 flow：開始 → 取得 state。 */
    async function startCookieFlow(api2: Api, cookie: string): Promise<{ res: Response; location: URL; state: string }> {
      const res = await api2.get(`${ORIGIN}/api/oauth/login/google?purpose=account-delete`, { cookie });
      const location = new URL(res.headers.get('Location')!);
      return { res, location, state: location.searchParams.get('state')! };
    }

    /** mobile：以 AccessToken（綁 grant）呼叫。AccessToken 是真實 D1 資料列，經真實 middleware 驗證。 */
    async function mobileToken(userId: string, grant: string): Promise<string> {
      const id = `mobile-token-${userId}-${grant}`;
      await db.prepare("INSERT INTO oauth_models (name, id, payload, expires_at) VALUES ('AccessToken', ?, ?, ?)")
        .bind(id, JSON.stringify({ user_id: userId, client_id: 'tripline-mobile', scopes: ['openid', 'profile'], grantId: `grant-${userId}-${grant}` }), Date.now() + 60000).run();
      return id;
    }

    it('瀏覽器流程無法開始（沒登入、沒有 Google 身分）→ 導回 /account?deleteReauth=failed，不是一頁 JSON', async () => {
      // 這是整頁導覽（window.location.href），回 JSON 會讓使用者停在一頁空白的 JSON 上、沒有路回 app。
      const api2 = apiG();
      const noSession = await api2.get(`${ORIGIN}/api/oauth/login/google?purpose=account-delete`);
      expect(noSession.status).toBe(302);
      expect(noSession.headers.get('Location')).toBe(`${ORIGIN}/account?deleteReauth=failed`);

      const pwOnly = await seedUser('correct-horse-battery'); // 只有密碼身分，沒有 Google
      const { cookie } = await api2.sessionFor(pwOnly.email, pwOnly.id);
      const noGoogle = await api2.get(`${ORIGIN}/api/oauth/login/google?purpose=account-delete`, { cookie });
      expect(noGoogle.status).toBe(302);
      expect(noGoogle.headers.get('Location')).toBe(`${ORIGIN}/account?deleteReauth=failed`);
      expect(await userCount(pwOnly.id), '開始失敗不得動到帳號').toBe(1);
    });

    it('抹除批次失敗後可用同一個未過期的 Google 證明重試', async () => {
      const u = await seedGoogleUser();
      const api2 = apiG();
      const { cookie } = await api2.sessionFor(u.email, u.id);
      const { state } = await startCookieFlow(api2, cookie);
      expect((await callback(api2, state, googleToken({ sub: u.sub, email: u.email, email_verified: true, auth_time: nowSec() }), { cookie })).status).toBe(302);

      await db.prepare(`CREATE TRIGGER account_delete_retry_fail BEFORE DELETE ON users
        WHEN OLD.id = '${u.id}' BEGIN SELECT RAISE(ABORT, 'simulated erasure failure'); END`).run();
      try {
        const failed = await api2.request('DELETE', `${ORIGIN}/api/account`, { cookie, json: { confirm: 'DELETE' } });
        expect(failed.status, '抹除失敗要回錯誤').toBeGreaterThanOrEqual(500);
        expect(await userCount(u.id), '失敗時使用者資料不得消失').toBe(1);
      } finally {
        await db.prepare('DROP TRIGGER account_delete_retry_fail').run();
      }
      const retried = await api2.request('DELETE', `${ORIGIN}/api/account`, { cookie, json: { confirm: 'DELETE' } });
      expect(retried.status, '同一個證明在未過期前可重試').toBe(200);
      expect(await userCount(u.id)).toBe(0);
    });

    it('mobile Bearer 可讀刪除預覽，不能只憑 token 刪除', async () => {
      const u = await seedGoogleUser();
      const token = await mobileToken(u.id, 'a');
      const api2 = apiG();
      expect((await api2.get(`${ORIGIN}/api/account`, { bearer: token })).status).toBe(200);
      const del2 = await api2.request('DELETE', `${ORIGIN}/api/account`, { bearer: token, json: { confirm: 'DELETE' } });
      expect(del2.status).toBe(403);
      expect(await userCount(u.id)).toBe(1);
    });

    it('mobile challenge 綁定 grant，可查狀態並取消；別的 grant 無法讀取', async () => {
      const u = await seedGoogleUser();
      const tokenA = await mobileToken(u.id, 'a');
      const tokenB = await mobileToken(u.id, 'b'); // 同一個使用者、另一個 grant
      const api2 = apiG();
      const url = (challengeId?: string) => `${ORIGIN}/api/account/delete-reauth${challengeId ? `?challenge_id=${challengeId}` : ''}`;

      const started = await api2.request('POST', url(), { bearer: tokenA });
      expect(started.status).toBe(200);
      const body = await started.json() as { challengeId: string; authorizeUrl: string; expiresIn: number };
      expect(body.expiresIn).toBe(300);
      expect(body.authorizeUrl).toContain(`challenge=${body.challengeId}`);

      const other = await api2.get(url(body.challengeId), { bearer: tokenB });
      expect(other.status).toBe(404);
      expect(await errorCode(other)).toBe('DATA_NOT_FOUND');

      expect(await (await api2.get(url(body.challengeId), { bearer: tokenA })).json()).toMatchObject({ status: 'pending' });
      expect((await api2.request('DELETE', url(body.challengeId), { bearer: tokenA })).status).toBe(200);
      expect(await (await api2.get(url(body.challengeId), { bearer: tokenA })).json()).toMatchObject({ status: 'cancelled' });
    });

    it('mobile Bearer 的 Google challenge 完成後只准同 grant 刪除一次', async () => {
      const u = await seedGoogleUser();
      const tokenA = await mobileToken(u.id, 'a');
      const tokenB = await mobileToken(u.id, 'b');
      const api2 = apiG();

      const started = await api2.request('POST', `${ORIGIN}/api/account/delete-reauth`, { bearer: tokenA });
      const { challengeId, authorizeUrl } = await started.json() as { challengeId: string; authorizeUrl: string };
      const google = await api2.get(authorizeUrl);
      const state = new URL(google.headers.get('Location')!).searchParams.get('state')!;

      const done = await callback(api2, state, googleToken({ sub: u.sub, email: u.email, email_verified: true, auth_time: nowSec() }));
      expect(done.status).toBe(302);
      expect(done.headers.get('Location')).toBe(`${MOBILE_PROD_REDIRECT}?challenge_id=${challengeId}&status=verified`);
      expect(await (await api2.get(`${ORIGIN}/api/account/delete-reauth?challenge_id=${challengeId}`, { bearer: tokenA })).json())
        .toMatchObject({ status: 'verified' });

      const otherGrant = await api2.request('DELETE', `${ORIGIN}/api/account`, { bearer: tokenB, json: { confirm: 'DELETE', challengeId } });
      expect(otherGrant.status).toBe(403);
      expect(await errorCode(otherGrant)).toBe('ACCOUNT_DELETE_REAUTH_REQUIRED');

      expect((await api2.request('DELETE', `${ORIGIN}/api/account`, { bearer: tokenA, json: { confirm: 'DELETE', challengeId } })).status).toBe(200);
      expect(await userCount(u.id)).toBe(0);
    });

    it('mobile 使用者拒絕 Google 驗證會得到可重試的失敗狀態，帳號不動', async () => {
      const u = await seedGoogleUser();
      const token = await mobileToken(u.id, 'a');
      const api2 = apiG();
      const started = await api2.request('POST', `${ORIGIN}/api/account/delete-reauth`, { bearer: token });
      const { challengeId, authorizeUrl } = await started.json() as { challengeId: string; authorizeUrl: string };
      const google = await api2.get(authorizeUrl);
      const state = new URL(google.headers.get('Location')!).searchParams.get('state')!;

      const denied = await api2.get(`${ORIGIN}/api/oauth/callback/google?error=access_denied&state=${state}`);
      expect(denied.headers.get('Location')).toBe(`${MOBILE_PROD_REDIRECT}?challenge_id=${challengeId}&status=failed`);
      expect(await (await api2.get(`${ORIGIN}/api/account/delete-reauth?challenge_id=${challengeId}`, { bearer: token })).json())
        .toMatchObject({ status: 'failed' });
      expect(await userCount(u.id)).toBe(1);
    });

    it('同帳號完成 Google 近期驗證後可一次性刪除', async () => {
      const u = await seedGoogleUser();
      const api2 = apiG();
      const { cookie } = await api2.sessionFor(u.email, u.id);
      const { res: start, location, state } = await startCookieFlow(api2, cookie);
      expect(start.status).toBe(302);
      expect(location.searchParams.get('prompt')).toBe('select_account');
      expect(location.searchParams.get('max_age')).toBe('0');
      expect(JSON.parse(location.searchParams.get('claims')!)).toEqual({ id_token: { auth_time: { essential: true } } });

      const done = await callback(api2, state, googleToken({ sub: u.sub, email: u.email, email_verified: true, auth_time: nowSec() }), { cookie });
      const to = new URL(done.headers.get('Location')!);
      expect(to.pathname + to.search).toBe('/account?deleteReauth=done');
      expect(done.headers.get('Set-Cookie'), '重新驗證不得換發 session').toBeNull();

      expect((await api2.request('DELETE', `${ORIGIN}/api/account`, { cookie, json: { confirm: 'DELETE' } })).status).toBe(200);
      expect(await userCount(u.id)).toBe(0);
    });

    it('重新驗證綁定開始流程的那個 session：換另一個 session 完成不得取得刪除授權', async () => {
      const u = await seedGoogleUser();
      const api2 = apiG();
      const first = await api2.sessionFor(u.email, u.id);
      const second = await api2.sessionFor(u.email, u.id); // 同一個使用者的另一台裝置
      expect(first.sid).not.toBe(second.sid);

      const { state } = await startCookieFlow(api2, first.cookie);
      const done = await callback(api2, state, googleToken({ sub: u.sub, email: u.email, email_verified: true, auth_time: nowSec() }), { cookie: second.cookie });
      expect(done.headers.get('Location')).toBe(`${ORIGIN}/account?deleteReauth=failed`);

      for (const cookie of [first.cookie, second.cookie]) {
        const refused = await api2.request('DELETE', `${ORIGIN}/api/account`, { cookie, json: { confirm: 'DELETE' } });
        expect(refused.status).toBe(403);
        expect(await errorCode(refused)).toBe('ACCOUNT_DELETE_REAUTH_REQUIRED');
      }
      expect(await userCount(u.id)).toBe(1);
    });

    it.each([
      ['另一個 Google 帳號', 'different-sub', 0],
      ['不是近期驗證', 'own', -600],
      ['未來的驗證時間', 'own', 600],
    ])('%s 不得取得刪除授權', async (_case, who, skew) => {
      const u = await seedGoogleUser();
      const api2 = apiG();
      const { cookie } = await api2.sessionFor(u.email, u.id);
      const { state } = await startCookieFlow(api2, cookie);
      const done = await callback(api2, state, googleToken({
        sub: who === 'own' ? u.sub : who, email: u.email, email_verified: true, auth_time: nowSec() + skew,
      }), { cookie });
      expect(done.status).toBe(302);
      expect(done.headers.get('Location')).toBe(`${ORIGIN}/account?deleteReauth=failed`);

      const refused = await api2.request('DELETE', `${ORIGIN}/api/account`, { cookie, json: { confirm: 'DELETE' } });
      expect(refused.status).toBe(403);
      expect(await errorCode(refused)).toBe('ACCOUNT_DELETE_REAUTH_REQUIRED');
      expect(await userCount(u.id)).toBe(1);
    });
  });
});
