// @vitest-environment node
/**
 * mobile 帳號刪除 challenge 狀態機的負向路徑守門（#1347）。
 *
 * Value: protects=只有 verified、未過期、同 uid／同 grant／同環境 client 的 challenge 能刪帳號，且抹除失敗後可重試; fails_when=任何一個 status／過期／uid／grant／client 條件被放寬，或失敗後的 used→verified 還原被拿掉; why_new=account-delete.test.ts 只走 happy path 與「別的 grant」一個負例; seam=none; no_claim=真實 Google 往返與 Flutter 實機（callback 以 mock 的 id_token 驗證）
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';
import { createMobileDeleteChallenge, readMobileDeleteChallenge } from '../../functions/api/account/_deleteReauth';
import { MOBILE_PROD_REDIRECT } from '../../functions/api/_mobileOAuth';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi, type Api } from './http';

const SESSION_SECRET = 'test-secret-32-chars-long-enough';
const ORIGIN = 'https://x.com';
vi.mock('../../src/server/oauth-client/google-id-token', () => ({
  verifyGoogleIdToken: vi.fn(async (idToken: string) => JSON.parse(atob(idToken.split('.')[1]!))),
}));
type Status = 'pending' | 'started' | 'verified' | 'failed' | 'cancelled' | 'used';

let db: D1Database;
let api: Api;
beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, {
    SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: ORIGIN,
    GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret', MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT,
  }) });
}, 30000);
afterAll(async () => {
  // 共用 D1：清掉本檔建立的使用者、身分、AccessToken 與 challenge
  await db.prepare("DELETE FROM oauth_models WHERE payload LIKE '%chal-u%'").run();
  await db.prepare("DELETE FROM auth_identities WHERE user_id LIKE 'chal-u%'").run();
  await db.prepare("DELETE FROM users WHERE id LIKE 'chal-u%'").run();
  await disposeMiniflare();
});

let seq = 0;
/** 一位 mobile 使用者：google 身分 + 一個綁 grant 的真實 AccessToken（經真實 middleware 驗證）。 */
async function seed() {
  const id = `chal-u${++seq}`;
  await db.prepare("INSERT INTO users (id, email, display_name, status) VALUES (?, ?, ?, 'active')").bind(id, `${id}@example.com`, id).run();
  await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES (?, 'google', ?)").bind(id, `g-${id}`).run();
  const grantId = `grant-${id}`;
  const token = `chal-token-${id}`;
  await db.prepare("INSERT INTO oauth_models (name, id, payload, expires_at) VALUES ('AccessToken', ?, ?, ?)")
    .bind(token, JSON.stringify({ user_id: id, client_id: 'tripline-mobile', scopes: ['openid', 'profile'], grantId }), Date.now() + 600_000).run();
  return { id, grantId, token };
}
async function challengeIn(u: { id: string; grantId: string }, status: Status, opts: { expiresAt?: number; clientId?: string } = {}) {
  const cid = await createMobileDeleteChallenge(db, u.id, u.grantId, opts.clientId ?? 'tripline-mobile');
  await db.prepare("UPDATE oauth_models SET payload = json_set(payload, '$.status', ?), expires_at = ? WHERE name = 'AccountDeleteChallenge' AND id = ?")
    .bind(status, opts.expiresAt ?? Date.now() + 60_000, cid).run();
  return cid;
}
const statusOf = async (cid: string) => (await readMobileDeleteChallenge(db, cid))?.status;
const userExists = async (id: string) => (await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()) !== null;
const del = (u: { token: string }, body: object) =>
  api.request('DELETE', `${ORIGIN}/api/account`, { bearer: u.token, json: body });
const cancel = (u: { token: string }, cid: string) =>
  api.request('DELETE', `${ORIGIN}/api/account/delete-reauth?challenge_id=${cid}`, { bearer: u.token });
const startGoogle = (cid: string) =>
  api.get(`${ORIGIN}/api/oauth/login/google?purpose=account-delete&challenge=${cid}`);
const errorCode = async (res: Response) => (await res.json() as { error: { code: string } }).error.code;
/** 被拒：403 ACCOUNT_DELETE_REAUTH_REQUIRED。 */
async function expectReauthRequired(res: Response) {
  expect(res.status).toBe(403);
  expect(await errorCode(res)).toBe('ACCOUNT_DELETE_REAUTH_REQUIRED');
}

describe('DELETE /api/account：mobile challenge 只有 verified 才能消耗', () => {
  it.each(['pending', 'started', 'failed', 'cancelled', 'used'] as const)('status=%s 被拒，帳號與 challenge 不變', async (status) => {
    const u = await seed();
    const cid = await challengeIn(u, status);
    await expectReauthRequired(await del(u, { confirm: 'DELETE', challengeId: cid }));
    expect(await userExists(u.id)).toBe(true);
    expect(await statusOf(cid)).toBe(status);
  });

  it('已過期的 verified 被拒', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'verified', { expiresAt: Date.now() - 1000 });
    await expectReauthRequired(await del(u, { confirm: 'DELETE', challengeId: cid }));
    expect(await userExists(u.id)).toBe(true);
  });

  it('別人的 challenge、缺 challengeId、不存在的 challengeId、與環境不符的 client 都被拒', async () => {
    const a = await seed(); const b = await seed();
    const bChallenge = await challengeIn(b, 'verified');
    await expectReauthRequired(await del(a, { confirm: 'DELETE', challengeId: bChallenge }));
    await expectReauthRequired(await del(a, { confirm: 'DELETE' }));
    await expectReauthRequired(await del(a, { confirm: 'DELETE', challengeId: 'does-not-exist' }));
    const uatChallenge = await challengeIn(a, 'verified', { clientId: 'tripline-mobile-uat' }); // production 環境不認 UAT client
    await expectReauthRequired(await del(a, { confirm: 'DELETE', challengeId: uatChallenge }));
    expect(await userExists(a.id) && await userExists(b.id)).toBe(true);
    expect(await statusOf(bChallenge)).toBe('verified');
  });

  it('兩個並行 DELETE 打同一個 verified challenge：只有一個成功', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'verified');
    const results = await Promise.all([del(u, { confirm: 'DELETE', challengeId: cid }), del(u, { confirm: 'DELETE', challengeId: cid })]);
    expect(results.map((r) => r.status).sort(), '一個 200、另一個 403').toEqual([200, 403]);
    expect(await userExists(u.id)).toBe(false);
  });

  it('抹除失敗：challenge 從 used 還原成 verified，同一個 challenge 可重試', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'verified');
    await db.prepare(`CREATE TRIGGER chal_fail_${u.id.replace(/-/g, '_')} BEFORE DELETE ON users
      WHEN OLD.id = '${u.id}' BEGIN SELECT RAISE(ABORT, 'simulated erasure failure'); END`).run();
    expect((await del(u, { confirm: 'DELETE', challengeId: cid })).status, '抹除失敗要回錯誤').toBeGreaterThanOrEqual(500);
    expect(await userExists(u.id)).toBe(true);
    expect(await statusOf(cid)).toBe('verified');
    await db.prepare(`DROP TRIGGER chal_fail_${u.id.replace(/-/g, '_')}`).run();
    expect((await del(u, { confirm: 'DELETE', challengeId: cid })).status).toBe(200);
    expect(await userExists(u.id)).toBe(false);
  });
});

describe('DELETE /api/account/delete-reauth：取消只能從未完成的狀態發生', () => {
  it.each(['pending', 'started', 'verified'] as const)('%s → cancelled，之後不能再被消耗', async (status) => {
    const u = await seed();
    const cid = await challengeIn(u, status);
    expect((await cancel(u, cid)).status).toBe(200);
    expect(await statusOf(cid)).toBe('cancelled');
    await expectReauthRequired(await del(u, { confirm: 'DELETE', challengeId: cid }));
    expect(await userExists(u.id)).toBe(true);
  });

  it('used 不能取消（DATA_CONFLICT），狀態不被改寫', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'used');
    const refused = await cancel(u, cid);
    expect(refused.status).toBe(409);
    expect(await errorCode(refused)).toBe('DATA_CONFLICT');
    expect(await statusOf(cid)).toBe('used');
  });
});

describe('GET /api/oauth/login/google?purpose=account-delete：只有 pending 能開始', () => {
  it.each(['started', 'verified', 'failed', 'cancelled', 'used'] as const)('status=%s 被拒（403），狀態不變', async (status) => {
    const u = await seed();
    const cid = await challengeIn(u, status);
    const res = await startGoogle(cid);
    expect(res.status).toBe(403);
    expect(await statusOf(cid)).toBe(status);
  });

  it('與環境不符的 client（production 不認 UAT client）不能開始驗證，狀態仍是 pending', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'pending', { clientId: 'tripline-mobile-uat' });
    expect((await startGoogle(cid)).status).toBe(403);
    expect(await statusOf(cid)).toBe('pending');
  });

  it('同一個 pending challenge 開始兩次：第二次被拒', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'pending');
    const start = () => startGoogle(cid);
    expect((await start()).status).toBe(302);
    expect(await statusOf(cid)).toBe('started');
    expect((await start()).status).toBe(403);
  });
});

describe('開始驗證時 state 寫入失敗', () => {
  it('challenge 還原成 pending，使用者可立即重試而不必等 5 分鐘過期', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'pending');
    const start = () => startGoogle(cid);
    const broken = vi.spyOn(D1Adapter.prototype, 'upsert').mockRejectedValueOnce(new Error('d1 write failed'));
    try {
      expect((await start()).status, 'state 寫入失敗要回錯誤').toBeGreaterThanOrEqual(500);
    } finally { broken.mockRestore(); }
    expect(await statusOf(cid)).toBe('pending');
    expect((await start()).status).toBe(302);
  });
});

describe('GET /api/oauth/callback/google：取消後的 callback 不能讓 challenge 復活', () => {
  it('started 時被取消，之後 Google 回來（驗證成功）也只會得到 failed，challenge 維持 cancelled 且不能刪帳號', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'pending');
    const google = await startGoogle(cid);
    const state = new URL(google.headers.get('Location')!).searchParams.get('state')!;
    expect((await cancel(u, cid)).status).toBe(200);
    const idToken = `h.${btoa(JSON.stringify({ sub: `g-${u.id}`, email: `${u.id}@example.com`, email_verified: true, auth_time: Math.floor(Date.now() / 1000) }))}.s`;
    const provider = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id_token: idToken, access_token: 'a' })));
    try {
      const done = await api.get(`${ORIGIN}/api/oauth/callback/google?code=c&state=${state}`);
      expect(done.headers.get('Location')).toBe(`${MOBILE_PROD_REDIRECT}?challenge_id=${cid}&status=failed`);
    } finally { provider.mockRestore(); }
    expect(await statusOf(cid)).toBe('cancelled');
    await expectReauthRequired(await del(u, { confirm: 'DELETE', challengeId: cid }));
    expect(await userExists(u.id)).toBe(true);
  });
});
