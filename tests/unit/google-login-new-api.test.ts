/**
 * 網頁版 Google 登入改走新 api（flutter#527／spec #525）：auth client 的「發起」與「回跳換 token」。
 * 以假 api（__helpers__/fake-oauth-api.ts，契約對照後端 login/google.ts、callback/google.ts、token.ts）做往返；不連任何外部服務。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { AuthError, createAuthClient, LOGIN_SCOPE } from '../../src/lib/auth/client';
import { exportPublicJwk } from '../../src/lib/auth/dpop';
import { createIdbAuthStorage, createMemoryAuthStorage } from '../../src/lib/auth/storage';
import { createFakeOAuthApi, FAKE_API_BASE, FAKE_WEB_REDIRECT_URI } from './__helpers__/fake-oauth-api';

const b64u = (bytes: ArrayBuffer) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const sha256B64u = async (s: string) => b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const thumbprint = async (keyPair: CryptoKeyPair) => {
  const j = await exportPublicJwk(keyPair);
  return sha256B64u(JSON.stringify({ crv: j.crv, kty: j.kty, x: j.x, y: j.y }));
};

function setup() {
  const api = createFakeOAuthApi();
  const storage = createMemoryAuthStorage();
  const client = createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: api.fetch });
  return { api, storage, client };
}
const callbackParams = (location: string) => new URL(location).searchParams;

afterEach(() => { vi.unstubAllGlobals(); });

describe('startGoogleLogin（發起）', () => {
  it('回傳新 api 的 Google 入口，帶齊參數：client_id、redirect_uri、S256 challenge、state、scope、dpop_jkt，且沒有多餘參數', async () => {
    const { storage, client } = setup();
    const href = await client.startGoogleLogin({ redirectUri: FAKE_WEB_REDIRECT_URI, redirectAfterLogin: '/trips?selected=t1' });
    const u = new URL(href);
    expect(`${u.origin}${u.pathname}`).toBe(`${FAKE_API_BASE}/api/oauth/login/google`);
    const pending = (await storage.takePendingLogin())!;
    expect([...u.searchParams.keys()].sort()).toEqual(
      ['client_id', 'code_challenge', 'code_challenge_method', 'dpop_jkt', 'redirect_uri', 'scope', 'state'],
    );
    expect(u.searchParams.get('client_id')).toBe('tripline-web');
    expect(u.searchParams.get('redirect_uri')).toBe(FAKE_WEB_REDIRECT_URI);
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('scope')).toBe(LOGIN_SCOPE);
    expect(u.searchParams.get('scope')!.split(' ')).toEqual(expect.arrayContaining(['trips:read', 'trips:write']));
    // challenge 對得上暫存的 verifier、jkt 對得上暫存的金鑰、state 對得上暫存的 state
    expect(u.searchParams.get('code_challenge')).toBe(await sha256B64u(pending.verifier));
    expect(u.searchParams.get('dpop_jkt')).toBe(await thumbprint(pending.keyPair));
    expect(u.searchParams.get('state')).toBe(pending.state);
    expect(pending.state.length).toBeGreaterThanOrEqual(32);
    expect(pending.redirectAfterLogin).toBe('/trips?selected=t1');
  });

  it('每次發起的 state、verifier、金鑰都不同', async () => {
    const { storage, client } = setup();
    await client.startGoogleLogin({ redirectUri: FAKE_WEB_REDIRECT_URI });
    const a = (await storage.takePendingLogin())!;
    await client.startGoogleLogin({ redirectUri: FAKE_WEB_REDIRECT_URI });
    const b = (await storage.takePendingLogin())!;
    expect(a.state).not.toBe(b.state);
    expect(a.verifier).not.toBe(b.verifier);
    expect(await thumbprint(a.keyPair)).not.toBe(await thumbprint(b.keyPair));
  });

  it('redirect_after_login 不是站內路徑（//evil.com、絕對網址）一律不暫存', async () => {
    for (const bad of ['//evil.com', 'https://evil.com/x', '/\\evil.com']) {
      const { storage, client } = setup();
      await client.startGoogleLogin({ redirectUri: FAKE_WEB_REDIRECT_URI, redirectAfterLogin: bad });
      expect((await storage.takePendingLogin())!.redirectAfterLogin).toBeNull();
    }
  });

  it('暫存不進 localStorage／sessionStorage／cookie（金鑰只能在 IndexedDB）', async () => {
    const { client } = setup();
    const writes: string[] = [];
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => { writes.push(`${k}=${v}`); });
    await client.startGoogleLogin({ redirectUri: FAKE_WEB_REDIRECT_URI });
    spy.mockRestore();
    expect(writes).toEqual([]);
  });
});

describe('finishGoogleLogin（回跳換 token）', () => {
  async function begin(redirectAfterLogin?: string) {
    const ctx = setup();
    const href = await ctx.client.startGoogleLogin({ redirectUri: FAKE_WEB_REDIRECT_URI, redirectAfterLogin });
    return { ...ctx, href };
  }

  it('成功：以 verifier 與 DPoP proof 換 token，請求只含 grant_type／client_id／code／code_verifier，不帶 redirect_uri（第一方 code 沒有）', async () => {
    const { api, storage, client, href } = await begin('/trips?selected=t1');
    const back = api.googleLogin(href)!;
    const result = await client.finishGoogleLogin(callbackParams(back));
    expect(result.redirectAfterLogin).toBe('/trips?selected=t1');

    const [req] = api.tokenRequests();
    expect(req!.method).toBe('POST');
    expect(req!.url).toBe(`${FAKE_API_BASE}/api/oauth/token`);
    const form = new URLSearchParams(req!.body);
    expect([...form.keys()].sort()).toEqual(['client_id', 'code', 'code_verifier', 'grant_type']);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('client_id')).toBe('tripline-web');
    expect(form.get('code')).toBe(callbackParams(back).get('code'));
    expect(form.get('code_verifier')).toBeTruthy();
    expect(req!.headers['dpop']).toBeTruthy();
    expect(req!.dpopClaims).toMatchObject({ htm: 'POST', htu: `${FAKE_API_BASE}/api/oauth/token` });

    // 登入完成：refresh token＋金鑰落地、access token 在記憶體、暫存已刪
    expect(await storage.getRefreshToken()).toBeTruthy();
    expect(await storage.getKeyPair()).toBeTruthy();
    expect(client.isAuthenticated()).toBe(true);
    expect(await storage.takePendingLogin()).toBeNull();
  });

  it('換到的 token 綁定發起時的 DPoP 金鑰（之後打 API 帶 DPoP 並成功）', async () => {
    const { api, client, href } = await begin();
    await client.finishGoogleLogin(callbackParams(api.googleLogin(href)!));
    const res = await client.apiFetch('/api/me');
    expect(res.status).toBe(200);
  });

  it('state 不符：拒絕、不打 token 端點、不登入、暫存清掉', async () => {
    const { api, storage, client, href } = await begin();
    const back = new URL(api.googleLogin(href)!);
    back.searchParams.set('state', 'forged-state');
    await expect(client.finishGoogleLogin(back.searchParams)).rejects.toMatchObject({ name: 'AuthError', code: 'OAUTH_STATE_MISMATCH' });
    expect(api.tokenRequests()).toHaveLength(0);
    expect(client.isAuthenticated()).toBe(false);
    expect(await storage.getRefreshToken()).toBeNull();
    expect(await storage.takePendingLogin()).toBeNull();
  });

  it('回跳沒帶 state：拒絕、不打 token 端點', async () => {
    const { api, client, href } = await begin();
    const back = new URL(api.googleLogin(href)!);
    back.searchParams.delete('state');
    await expect(client.finishGoogleLogin(back.searchParams)).rejects.toMatchObject({ code: 'OAUTH_STATE_MISMATCH' });
    expect(api.tokenRequests()).toHaveLength(0);
  });

  it('沒有暫存（不是從這個瀏覽器發起的回跳）：拒絕、不打 token 端點', async () => {
    const { api, client } = setup();
    await expect(client.finishGoogleLogin(new URLSearchParams({ code: 'c', state: 's' })))
      .rejects.toMatchObject({ code: 'OAUTH_STATE_MISMATCH' });
    expect(api.tokenRequests()).toHaveLength(0);
  });

  it('同一個回跳網址重放：第二次被拒（暫存用過即刪），token 端點只被打一次', async () => {
    const { api, client, href } = await begin();
    const params = callbackParams(api.googleLogin(href)!);
    await client.finishGoogleLogin(params);
    await expect(client.finishGoogleLogin(params)).rejects.toMatchObject({ code: 'OAUTH_STATE_MISMATCH' });
    expect(api.tokenRequests()).toHaveLength(1);
  });

  it('使用者在 Google 取消（error=access_denied 且 state 正確）：丟出該錯誤碼、不打 token 端點、暫存清掉', async () => {
    const { api, storage, client, href } = await begin();
    const back = api.googleLogin(href, { deny: true })!;
    await expect(client.finishGoogleLogin(callbackParams(back))).rejects.toMatchObject({ code: 'access_denied' });
    expect(api.tokenRequests()).toHaveLength(0);
    expect(await storage.takePendingLogin()).toBeNull();
  });

  it('error 回跳但 state 不符：以 state 錯誤處理（不採信別人偽造的 error）', async () => {
    const { client, href, api } = await begin();
    const back = new URL(api.googleLogin(href, { deny: true })!);
    back.searchParams.set('state', 'forged');
    await expect(client.finishGoogleLogin(back.searchParams)).rejects.toMatchObject({ code: 'OAUTH_STATE_MISMATCH' });
  });

  it('有 state 但沒有 code：AUTH_PROTOCOL，不打 token 端點', async () => {
    const { api, client, href } = await begin();
    const back = new URL(api.googleLogin(href)!);
    back.searchParams.delete('code');
    await expect(client.finishGoogleLogin(back.searchParams)).rejects.toMatchObject({ code: 'AUTH_PROTOCOL' });
    expect(api.tokenRequests()).toHaveLength(0);
  });

  it('token 端點拒絕（code 無效）：丟 AuthError、不登入、暫存已清', async () => {
    const { api, storage, client, href } = await begin();
    const back = new URL(api.googleLogin(href)!);
    back.searchParams.set('code', 'not-a-real-code');
    const err = await client.finishGoogleLogin(back.searchParams).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).code).toBe('invalid_grant');
    expect(client.isAuthenticated()).toBe(false);
    expect(await storage.getRefreshToken()).toBeNull();
    expect(await storage.takePendingLogin()).toBeNull();
  });

  it('暫存的 redirect_after_login 在換 token 成功後原樣回傳；沒設定時為 null', async () => {
    const { api, client, href } = await begin();
    const r = await client.finishGoogleLogin(callbackParams(api.googleLogin(href)!));
    expect(r.redirectAfterLogin).toBeNull();
  });
});

describe('IndexedDB 暫存', () => {
  it('金鑰可存進 IndexedDB 並取回；take 之後就沒有了（用過即刪）', async () => {
    const idb = new IDBFactory();
    const storage = createIdbAuthStorage({ indexedDB: idb });
    const api = createFakeOAuthApi();
    const client = createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: api.fetch });
    const href = await client.startGoogleLogin({ redirectUri: FAKE_WEB_REDIRECT_URI, redirectAfterLogin: '/trips' });
    const first = (await storage.takePendingLogin())!;
    expect(first.keyPair.privateKey.extractable).toBe(false);
    expect(new URL(href).searchParams.get('state')).toBe(first.state);
    expect(await storage.takePendingLogin()).toBeNull();
  });

  it('IndexedDB 往返：發起後回跳可完成登入', async () => {
    const idb = new IDBFactory();
    const storage = createIdbAuthStorage({ indexedDB: idb });
    const api = createFakeOAuthApi();
    const client = createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: api.fetch });
    const href = await client.startGoogleLogin({ redirectUri: FAKE_WEB_REDIRECT_URI });
    // 模擬整頁跳轉：全新的 client 與 storage 實例，只共用 IndexedDB
    const client2 = createAuthClient({ apiBase: FAKE_API_BASE, storage: createIdbAuthStorage({ indexedDB: idb }), fetch: api.fetch });
    await client2.finishGoogleLogin(callbackParams(api.googleLogin(href)!));
    expect(client2.isAuthenticated()).toBe(true);
  });
});
