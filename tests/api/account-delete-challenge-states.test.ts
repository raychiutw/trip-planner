// @vitest-environment node
/**
 * mobile 帳號刪除 challenge 狀態機的負向路徑守門（#1347）。
 *
 * Value: protects=只有 verified、未過期、同 uid／同 grant／同環境 client 的 challenge 能刪帳號，且抹除失敗後可重試; fails_when=任何一個 status／過期／uid／grant／client 條件被放寬，或失敗後的 used→verified 還原被拿掉; why_new=account-delete.test.ts 只走 happy path 與「別的 grant」一個負例; seam=none; no_claim=真實 Google 往返與 Flutter 實機（callback 以 mock 的 id_token 驗證）
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';
import { onRequestDelete } from '../../functions/api/account/index';
import { onRequestGet as startGoogle } from '../../functions/api/oauth/login/google';
import { onRequestGet as completeGoogle } from '../../functions/api/oauth/callback/google';
import { onRequestDelete as cancelChallenge } from '../../functions/api/account/delete-reauth';
import { createMobileDeleteChallenge, readMobileDeleteChallenge } from '../../functions/api/account/_deleteReauth';
import { MOBILE_PROD_REDIRECT } from '../../functions/api/_mobileOAuth';
import { createTestDb, disposeMiniflare } from './setup';
import { mockAuth, mockContext, mockEnv } from './helpers';

const SESSION_SECRET = 'test-secret-32-chars-long-enough';
vi.mock('../../src/server/oauth-client/google-id-token', () => ({
  verifyGoogleIdToken: vi.fn(async (idToken: string) => JSON.parse(atob(idToken.split('.')[1]!))),
}));
type Status = 'pending' | 'started' | 'verified' | 'failed' | 'cancelled' | 'used';

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); }, 30000);
afterAll(disposeMiniflare);

let seq = 0;
async function seed() {
  const id = `chal-u${++seq}`;
  await db.prepare("INSERT INTO users (id, email, display_name, status) VALUES (?, ?, ?, 'active')").bind(id, `${id}@example.com`, id).run();
  await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES (?, 'google', ?)").bind(id, `g-${id}`).run();
  const grantId = `grant-${id}`;
  return { id, grantId, auth: mockAuth({ userId: id, clientId: 'tripline-mobile', grantId }) };
}
const env = () => mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com', MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT });
async function challengeIn(u: { id: string; grantId: string }, status: Status, opts: { expiresAt?: number; clientId?: string } = {}) {
  const cid = await createMobileDeleteChallenge(db, u.id, u.grantId, opts.clientId ?? 'tripline-mobile');
  await db.prepare("UPDATE oauth_models SET payload = json_set(payload, '$.status', ?), expires_at = ? WHERE name = 'AccountDeleteChallenge' AND id = ?")
    .bind(status, opts.expiresAt ?? Date.now() + 60_000, cid).run();
  return cid;
}
const statusOf = async (cid: string) => (await readMobileDeleteChallenge(db, cid))?.status;
const userExists = async (id: string) => (await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()) !== null;
const del = (u: { auth: ReturnType<typeof mockAuth> }, body: object) => onRequestDelete(mockContext({
  request: new Request('https://x.com/api/account', { method: 'DELETE', headers: { Authorization: 'Bearer t' }, body: JSON.stringify(body) }),
  env: env(), auth: u.auth }) as never);
const cancel = (u: { auth: ReturnType<typeof mockAuth> }, cid: string) => cancelChallenge(mockContext({
  request: new Request(`https://x.com/api/account/delete-reauth?challenge_id=${cid}`, { method: 'DELETE' }), env: env(), auth: u.auth }) as never);

describe('DELETE /api/account：mobile challenge 只有 verified 才能消耗', () => {
  it.each(['pending', 'started', 'failed', 'cancelled', 'used'] as const)('status=%s 被拒，帳號與 challenge 不變', async (status) => {
    const u = await seed();
    const cid = await challengeIn(u, status);
    await expect(del(u, { confirm: 'DELETE', challengeId: cid })).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
    expect(await userExists(u.id)).toBe(true);
    expect(await statusOf(cid)).toBe(status);
  });

  it('已過期的 verified 被拒', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'verified', { expiresAt: Date.now() - 1000 });
    await expect(del(u, { confirm: 'DELETE', challengeId: cid })).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
    expect(await userExists(u.id)).toBe(true);
  });

  it('別人的 challenge、缺 challengeId、不存在的 challengeId、與環境不符的 client 都被拒', async () => {
    const a = await seed(); const b = await seed();
    const bChallenge = await challengeIn(b, 'verified');
    await expect(del(a, { confirm: 'DELETE', challengeId: bChallenge })).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
    await expect(del(a, { confirm: 'DELETE' })).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
    await expect(del(a, { confirm: 'DELETE', challengeId: 'does-not-exist' })).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
    const uatChallenge = await challengeIn(a, 'verified', { clientId: 'tripline-mobile-uat' }); // production 環境不認 UAT client
    await expect(del(a, { confirm: 'DELETE', challengeId: uatChallenge })).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
    expect(await userExists(a.id) && await userExists(b.id)).toBe(true);
    expect(await statusOf(bChallenge)).toBe('verified');
  });

  it('兩個並行 DELETE 打同一個 verified challenge：只有一個成功', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'verified');
    const results = await Promise.allSettled([del(u, { confirm: 'DELETE', challengeId: cid }), del(u, { confirm: 'DELETE', challengeId: cid })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await userExists(u.id)).toBe(false);
  });

  it('抹除失敗：challenge 從 used 還原成 verified 可重試；過期後不會被還原', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'verified');
    await db.prepare(`CREATE TRIGGER chal_fail_${u.id.replace(/-/g, '_')} BEFORE DELETE ON users
      WHEN OLD.id = '${u.id}' BEGIN SELECT RAISE(ABORT, 'simulated erasure failure'); END`).run();
    await expect(del(u, { confirm: 'DELETE', challengeId: cid })).rejects.toThrow();
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
    await expect(del(u, { confirm: 'DELETE', challengeId: cid })).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
    expect(await userExists(u.id)).toBe(true);
  });

  it('used 不能取消（DATA_CONFLICT），狀態不被改寫', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'used');
    await expect(cancel(u, cid)).rejects.toMatchObject({ code: 'DATA_CONFLICT' });
    expect(await statusOf(cid)).toBe('used');
  });
});

describe('GET /api/oauth/login/google?purpose=account-delete：只有 pending 能開始', () => {
  it.each(['started', 'verified', 'failed', 'cancelled', 'used'] as const)('status=%s 被拒（403），狀態不變', async (status) => {
    const u = await seed();
    const cid = await challengeIn(u, status);
    const res = await startGoogle(mockContext({
      request: new Request(`https://x.com/api/oauth/login/google?purpose=account-delete&challenge=${cid}`),
      env: mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret', MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT }) }) as never);
    expect(res.status).toBe(403);
    expect(await statusOf(cid)).toBe(status);
  });

  it('同一個 pending challenge 開始兩次：第二次被拒', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'pending');
    const start = () => startGoogle(mockContext({
      request: new Request(`https://x.com/api/oauth/login/google?purpose=account-delete&challenge=${cid}`),
      env: mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret', MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT }) }) as never);
    expect((await start()).status).toBe(302);
    expect(await statusOf(cid)).toBe('started');
    expect((await start()).status).toBe(403);
  });
});

describe('開始驗證時 state 寫入失敗', () => {
  it('challenge 還原成 pending，使用者可立即重試而不必等 5 分鐘過期', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'pending');
    const e = mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret', MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT });
    const start = () => startGoogle(mockContext({ request: new Request(`https://x.com/api/oauth/login/google?purpose=account-delete&challenge=${cid}`), env: e }) as never);
    const broken = vi.spyOn(D1Adapter.prototype, 'upsert').mockRejectedValueOnce(new Error('d1 write failed'));
    try {
      await expect(start()).rejects.toThrow('d1 write failed');
    } finally { broken.mockRestore(); }
    expect(await statusOf(cid)).toBe('pending');
    expect((await start()).status).toBe(302);
  });
});

describe('GET /api/oauth/callback/google：取消後的 callback 不能讓 challenge 復活', () => {
  it('started 時被取消，之後 Google 回來（驗證成功）也只會得到 failed，challenge 維持 cancelled 且不能刪帳號', async () => {
    const u = await seed();
    const cid = await challengeIn(u, 'pending');
    const e = mockEnv(db, { SESSION_SECRET, ENVIRONMENT: 'production', PUBLIC_ORIGIN: 'https://x.com', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret', MOBILE_OAUTH_CALLBACK_URL: MOBILE_PROD_REDIRECT });
    const google = await startGoogle(mockContext({ request: new Request(`https://x.com/api/oauth/login/google?purpose=account-delete&challenge=${cid}`), env: e }) as never);
    const state = new URL(google.headers.get('Location')!).searchParams.get('state')!;
    expect((await cancel(u, cid)).status).toBe(200);
    const idToken = `h.${btoa(JSON.stringify({ sub: `g-${u.id}`, email: `${u.id}@example.com`, email_verified: true, auth_time: Math.floor(Date.now() / 1000) }))}.s`;
    const provider = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id_token: idToken, access_token: 'a' })));
    try {
      const done = await completeGoogle(mockContext({ request: new Request(`https://x.com/api/oauth/callback/google?code=c&state=${state}`), env: e }) as never);
      expect(done.headers.get('Location')).toBe(`${MOBILE_PROD_REDIRECT}?challenge_id=${cid}&status=failed`);
    } finally { provider.mockRestore(); }
    expect(await statusOf(cid)).toBe('cancelled');
    await expect(del(u, { confirm: 'DELETE', challengeId: cid })).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' });
    expect(await userExists(u.id)).toBe(true);
  });
});
