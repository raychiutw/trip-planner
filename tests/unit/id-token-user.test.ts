/**
 * id_token 當顯示用使用者資料（#1691）：驗證規則對照 Flutter 的 verifiedIdTokenClaims（sub／aud／exp，不驗簽、不驗 iss），
 * 以及 auth client 對 id_token 的處理（只在記憶體、登出清除）。
 */
import { describe, expect, it, vi } from 'vitest';
vi.unmock('../../src/lib/auth');
import { userFromIdToken } from '../../src/lib/auth/idToken';
import { createAuthClient } from '../../src/lib/auth/client';
import { createMemoryAuthStorage } from '../../src/lib/auth/storage';
import { generateDpopKeyPair } from '../../src/lib/auth/dpop';

const b64u = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (c: Record<string, unknown>) => `${b64u({ alg: 'ES256' })}.${b64u(c)}.sig`;
const NOW = 1_800_000_000_000;
const base = { sub: 'u1', aud: 'tripline-web', email: 'a@b.test', email_verified: true, name: 'Ray', exp: NOW / 1000 + 600 };

describe('userFromIdToken', () => {
  it('合法 token → 顯示用使用者', () => {
    expect(userFromIdToken(jwt(base), 'tripline-web', NOW)).toEqual({
      id: 'u1', email: 'a@b.test', emailVerified: true, displayName: 'Ray', avatarUrl: null, createdAt: '',
    });
  });
  it('aud 可為陣列', () => {
    expect(userFromIdToken(jwt({ ...base, aud: ['x', 'tripline-web'] }), 'tripline-web', NOW)?.id).toBe('u1');
  });
  it('name 等於 email 前綴（伺服器的退路值）→ displayName 為 null', () => {
    expect(userFromIdToken(jwt({ ...base, name: 'a' }), 'tripline-web', NOW)?.displayName).toBeNull();
  });
  it.each([
    ['null', null],
    ['不是 JWT', 'abc'],
    ['payload 不是 JSON', 'a.@@@.c'],
    ['aud 不符', jwt({ ...base, aud: 'other' })],
    ['aud 陣列不含本 client', jwt({ ...base, aud: ['other'] })],
    ['沒有 aud', jwt({ ...base, aud: undefined })],
    ['過期超過 leeway', jwt({ ...base, exp: NOW / 1000 - 61 })],
    ['沒有 exp', jwt({ ...base, exp: undefined })],
    ['exp 不是數字', jwt({ ...base, exp: '9999999999' })],
    ['沒有 sub', jwt({ ...base, sub: '' })],
    ['沒有 email', jwt({ ...base, email: undefined })],
  ])('%s → null（落回 userinfo）', (_l, token) => {
    expect(userFromIdToken(token as string | null, 'tripline-web', NOW)).toBeNull();
  });
  it('剛過期但在 1 分鐘 leeway 內仍可用', () => {
    expect(userFromIdToken(jwt({ ...base, exp: NOW / 1000 - 30 }), 'tripline-web', NOW)).not.toBeNull();
  });
});

describe('auth client 的 id_token', () => {
  const tokenRes = (idToken?: string) => new Response(JSON.stringify({
    access_token: 'at', refresh_token: 'rt2', token_type: 'DPoP', ...(idToken ? { id_token: idToken } : {}),
  }), { status: 200 });

  it('refresh 取得、只在記憶體（storage 看不到）、登出後清除', async () => {
    const storage = createMemoryAuthStorage();
    await storage.saveSession({ refreshToken: 'rt1', keyPair: await generateDpopKeyPair() });
    const idToken = jwt(base);
    const fetchImpl = vi.fn(async () => tokenRes(idToken));
    const c = createAuthClient({ apiBase: 'https://api.test', storage, fetch: fetchImpl as unknown as typeof fetch, lock: (fn) => fn() });
    expect(c.getIdToken()).toBeNull();
    await c.restoreSession();
    expect(c.getIdToken()).toBe(idToken);
    expect(storage.dumpValues().join('|')).not.toContain(idToken);
    await c.logout();
    expect(c.getIdToken()).toBeNull();
  });

  it('新的 token 回應沒有 id_token → 不保留舊的', async () => {
    const storage = createMemoryAuthStorage();
    await storage.saveSession({ refreshToken: 'rt1', keyPair: await generateDpopKeyPair() });
    const responses = [tokenRes(jwt(base)), tokenRes()];
    const c = createAuthClient({ apiBase: 'https://api.test', storage, fetch: (async () => responses.shift()!) as unknown as typeof fetch, lock: (fn) => fn() });
    await c.restoreSession();
    expect(c.getIdToken()).not.toBeNull();
    await c.refresh();
    expect(c.getIdToken()).toBeNull();
  });
});

describe('清憑證一律清掉共享的使用者（非 logoutSession 的路徑）', () => {
  const seed = async () => {
    const { setCachedCurrentUser, getCachedCurrentUser } = await import('../../src/lib/currentUserCache');
    setCachedCurrentUser(Promise.resolve({ id: 'u1' }));
    expect(getCachedCurrentUser()).not.toBeNull();
    return getCachedCurrentUser;
  };

  it('refresh 被拒（invalid_grant → failReauth）', async () => {
    const storage = createMemoryAuthStorage();
    await storage.saveSession({ refreshToken: 'rt1', keyPair: await generateDpopKeyPair() });
    const fetchImpl = async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    const c = createAuthClient({ apiBase: 'https://api.test', storage, fetch: fetchImpl as unknown as typeof fetch, lock: (fn) => fn(), onReauthRequired: () => {} });
    const get = await seed();
    expect(await c.restoreSession()).toBe(false);
    expect(get()).toBeNull();
  });

  it('restoreSession 發現只剩一半殘留', async () => {
    const storage = createMemoryAuthStorage();
    await storage.saveRefreshToken('rt-orphan'); // 有 refresh token、沒有金鑰
    const c = createAuthClient({ apiBase: 'https://api.test', storage, fetch: (async () => new Response('{}')) as unknown as typeof fetch, lock: (fn) => fn() });
    const get = await seed();
    expect(await c.restoreSession()).toBe(false);
    expect(get()).toBeNull();
  });
});
