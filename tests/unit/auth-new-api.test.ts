/**
 * T18：web 登入改 OAuth public client（PKCE + DPoP）的 plumbing。
 * 以「假 api」（tests/unit/__helpers__/fake-oauth-api.ts）做往返測試；不連任何外部服務。
 * 預設關閉：VITE_NEW_API_AUTH !== '1' 時整條新路徑不會被碰到。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createPkcePair } from '../../src/lib/auth/pkce';
import { createDpopProof, exportPublicJwk, generateDpopKeyPair, jwkThumbprint } from '../../src/lib/auth/dpop';
import { createIdbAuthStorage, createMemoryAuthStorage } from '../../src/lib/auth/storage';
import { AuthError, createAuthClient } from '../../src/lib/auth/client';
import { createFakeOAuthApi, FAKE_API_BASE, FAKE_EMAIL, FAKE_PASSWORD } from './__helpers__/fake-oauth-api';

const B64URL = /^[A-Za-z0-9_-]+$/;
const b64u = (bytes: ArrayBuffer) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const sha256B64u = async (s: string) => b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const decodePart = (jwt: string, i: number) => {
  const part = jwt.split('.')[i]!;
  const pad = '='.repeat((4 - (part.length % 4)) % 4);
  return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/') + pad));
};

// ---- 持久儲存探針：任何寫進 localStorage／sessionStorage／cookie 的值都會被記下 ----
function installStorageSpies() {
  const writes: string[] = [];
  const makeStorage = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => { writes.push(`${k}=${v}`); m.set(k, String(v)); },
      removeItem: (k: string) => { m.delete(k); },
      clear: () => m.clear(),
      key: () => null,
      get length() { return m.size; },
    };
  };
  vi.stubGlobal('localStorage', makeStorage());
  vi.stubGlobal('sessionStorage', makeStorage());
  const doc = {
    get cookie() { return ''; },
    set cookie(v: string) { writes.push(`cookie:${v}`); },
  };
  vi.stubGlobal('document', doc);
  return writes;
}

function setup() {
  const api = createFakeOAuthApi();
  const storage = createMemoryAuthStorage();
  const onReauthRequired = vi.fn();
  const make = (overrides: Partial<Parameters<typeof createAuthClient>[0]> = {}) =>
    createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: api.fetch, onReauthRequired, ...overrides });
  return { api, storage, onReauthRequired, make, client: make() };
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe('PKCE', () => {
  it('code_verifier 是 43–128 字元的 base64url，每次不同', async () => {
    const a = await createPkcePair();
    const b = await createPkcePair();
    expect(a.verifier).toMatch(B64URL);
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
    expect(a.verifier.length).toBeLessThanOrEqual(128);
    expect(a.verifier).not.toBe(b.verifier);
  });

  it('challenge = base64url(SHA-256(verifier))，43 字元', async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(challenge).toBe(await sha256B64u(verifier));
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('DPoP 金鑰與 proof', () => {
  it('私鑰不可匯出（exportKey 失敗），公鑰 jwk 不含 d', async () => {
    const kp = await generateDpopKeyPair();
    expect(kp.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('jwk', kp.privateKey)).rejects.toThrow();
    const jwk = await exportPublicJwk(kp);
    expect(jwk).toEqual({ kty: 'EC', crv: 'P-256', x: expect.any(String), y: expect.any(String) });
    expect('d' in jwk).toBe(false);
  });

  it('thumbprint 依 RFC 7638：crv、kty、x、y 字典序、無空白的 SHA-256', async () => {
    const jwk = await exportPublicJwk(await generateDpopKeyPair());
    const expected = await sha256B64u(`{"crv":"P-256","kty":"EC","x":"${jwk.x}","y":"${jwk.y}"}`);
    expect(await jwkThumbprint(jwk)).toBe(expected);
  });

  it('proof 的 header／claims 正確：htm、htu（去掉 query 與 fragment）、iat、每次新 jti；token endpoint 不帶 ath', async () => {
    const kp = await generateDpopKeyPair();
    const jwk = await exportPublicJwk(kp);
    const now = 1_800_000_000_000;
    const p1 = await createDpopProof({ keyPair: kp, method: 'post', url: 'https://api.test/api/oauth/token?x=1#frag', now });
    const p2 = await createDpopProof({ keyPair: kp, method: 'post', url: 'https://api.test/api/oauth/token', now });
    const h = decodePart(p1, 0);
    const c1 = decodePart(p1, 1);
    const c2 = decodePart(p2, 1);
    expect(h).toEqual({ typ: 'dpop+jwt', alg: 'ES256', jwk });
    expect(c1.htm).toBe('POST');
    expect(c1.htu).toBe('https://api.test/api/oauth/token');
    expect(c1.iat).toBe(1_800_000_000);
    expect('ath' in c1).toBe(false);
    expect(c1.jti).toBeTruthy();
    expect(c1.jti).not.toBe(c2.jti);
  });

  it('資源請求的 proof 帶 ath = base64url(SHA-256(access_token))，且簽章可用公鑰驗證', async () => {
    const kp = await generateDpopKeyPair();
    const jwk = await exportPublicJwk(kp);
    const proof = await createDpopProof({ keyPair: kp, method: 'GET', url: 'https://api.test/api/me', accessToken: 'tok-123' });
    expect(decodePart(proof, 1).ath).toBe(await sha256B64u('tok-123'));
    const [h, p, s] = proof.split('.') as [string, string, string];
    const pad = '='.repeat((4 - (s.length % 4)) % 4);
    const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), (ch) => ch.charCodeAt(0));
    const pub = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, new TextEncoder().encode(`${h}.${p}`))).toBe(true);
  });
});

describe('儲存層', () => {
  it('記憶體實作：refresh token 與金鑰存取、clear 清全部', async () => {
    const s = createMemoryAuthStorage();
    const kp = await generateDpopKeyPair();
    await s.saveSession({ refreshToken: 'r1', keyPair: kp });
    expect(await s.getRefreshToken()).toBe('r1');
    expect(await s.getKeyPair()).toBe(kp);
    await s.saveRefreshToken('r2');
    expect(await s.getRefreshToken()).toBe('r2');
    await s.clear();
    expect(await s.getRefreshToken()).toBeNull();
    expect(await s.getKeyPair()).toBeNull();
  });

  it('IndexedDB 轉接層：refresh token 與不可匯出的 CryptoKey 往返，重開連線仍在，clear 清全部', async () => {
    const idb = new IDBFactory();
    const a = createIdbAuthStorage({ indexedDB: idb });
    const kp = await generateDpopKeyPair();
    await a.saveSession({ refreshToken: 'r1', keyPair: kp });
    const b = createIdbAuthStorage({ indexedDB: idb }); // 模擬重新載入
    expect(await b.getRefreshToken()).toBe('r1');
    const loaded = await b.getKeyPair();
    expect(loaded).not.toBeNull();
    expect(loaded!.privateKey.extractable).toBe(false);
    // 取回的金鑰仍可簽章
    const proof = await createDpopProof({ keyPair: loaded!, method: 'GET', url: 'https://api.test/x' });
    expect(proof.split('.')).toHaveLength(3);
    await b.clear();
    expect(await a.getRefreshToken()).toBeNull();
    expect(await a.getKeyPair()).toBeNull();
  });

  it('建立轉接層時不碰 indexedDB（延遲到第一次使用）', () => {
    const touched = vi.fn();
    vi.stubGlobal('indexedDB', undefined);
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get: () => { touched(); return undefined; } });
    createIdbAuthStorage();
    expect(touched).not.toHaveBeenCalled();
    Reflect.deleteProperty(globalThis, 'indexedDB');
  });
});

describe('login 往返', () => {
  it('帳密 → PKCE + dpop_jkt 換 code → token endpoint 帶 DPoP proof → 已登入，資源請求成功', async () => {
    const { api, client } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    expect(client.isAuthenticated()).toBe(true);

    const loginReq = api.requests.find((r) => r.url.endsWith('/api/oauth/login'))!;
    const body = JSON.parse(loginReq.body);
    expect(body).toMatchObject({ email: FAKE_EMAIL, client_id: 'tripline-web', code_challenge_method: 'S256' });
    expect(body.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.dpop_jkt).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const tokenReq = api.tokenRequests()[0]!;
    const params = Object.fromEntries(new URLSearchParams(tokenReq.body));
    expect(params).toMatchObject({ grant_type: 'authorization_code', client_id: 'tripline-web' });
    expect(params.code_verifier).toBeTruthy();
    expect('redirect_uri' in params).toBe(false);
    expect(tokenReq.headers['dpop']).toBeTruthy();

    const res = await client.apiFetch(`${FAKE_API_BASE}/api/me`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: FAKE_EMAIL });
  });

  it('登入請求明確帶 scope：保留 openid profile email，並加上 trips:read trips:write（#521）', async () => {
    const { api, client } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    const body = JSON.parse(api.requests.find((r) => r.url.endsWith('/api/oauth/login'))!.body);
    expect(typeof body.scope).toBe('string');
    expect(body.scope.split(' ').sort()).toEqual(['email', 'openid', 'profile', 'trips:read', 'trips:write']);
  });

  it('密碼錯誤 → AuthError(LOGIN_INVALID, 401)，沒有任何東西被存起來', async () => {
    const { storage, client } = setup();
    await expect(client.login(FAKE_EMAIL, 'wrong')).rejects.toMatchObject({ code: 'LOGIN_INVALID', status: 401 });
    expect(client.isAuthenticated()).toBe(false);
    expect(await storage.getRefreshToken()).toBeNull();
    expect(await storage.getKeyPair()).toBeNull();
  });

  it('被鎖定 → LOGIN_RATE_LIMITED，帶 retryAfter 秒數', async () => {
    const { client } = setup();
    const err = await client.login('locked@example.test', 'x').catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err).toMatchObject({ code: 'LOGIN_RATE_LIMITED', status: 429, retryAfter: 600 });
  });
});

describe('access token 不落地', () => {
  it('登入、refresh、restore 之後，localStorage／sessionStorage／cookie／IndexedDB 都不含 access token', async () => {
    const writes = installStorageSpies();
    const { api, storage } = setup();
    const seen = new Set<string>();
    const origFetch = api.fetch;
    const spy: typeof fetch = async (i, init) => {
      const res = await origFetch(i, init);
      if (new URL(typeof i === 'string' ? i : (i as Request).url).pathname === '/api/oauth/token') {
        const j = await res.clone().json();
        seen.add(j.access_token);
      }
      return res;
    };
    const c = createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: spy });
    await c.login(FAKE_EMAIL, FAKE_PASSWORD);
    await c.refresh();
    expect(seen.size).toBe(2);

    const persisted = [
      ...writes,
      JSON.stringify(await storage.getRefreshToken()),
      ...storage.dumpValues(),
    ].join('\n');
    for (const t of seen) expect(persisted).not.toContain(t);
    // 同時確認探針有效：refresh token 確實有存進去（不是「什麼都沒存」的假綠）
    expect(persisted).toContain((await storage.getRefreshToken())!);
  });

  it('真 IndexedDB 轉接層也不含 access token（只有 refresh token 與金鑰）', async () => {
    const idb = new IDBFactory();
    const api = createFakeOAuthApi();
    const issued: string[] = [];
    const capture: typeof fetch = async (i, init) => {
      const res = await api.fetch(i, init);
      if (String(i).endsWith('/api/oauth/token')) issued.push((await res.clone().json()).access_token);
      return res;
    };
    const storage = createIdbAuthStorage({ indexedDB: idb });
    const c = createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: capture });
    await c.login(FAKE_EMAIL, FAKE_PASSWORD);
    await c.refresh();
    expect(issued).toHaveLength(2);

    const all = await new Promise<unknown[]>((resolve, reject) => {
      const open = idb.open('tripline-auth');
      open.onsuccess = () => {
        const db = open.result;
        const name = db.objectStoreNames[0]!;
        const out: unknown[] = [];
        const cur = db.transaction(name, 'readonly').objectStore(name).openCursor();
        cur.onsuccess = () => {
          const cursor = cur.result;
          if (cursor) { out.push(cursor.value); cursor.continue(); } else resolve(out);
        };
        cur.onerror = () => reject(cur.error);
      };
      open.onerror = () => reject(open.error);
    });
    expect(all).toHaveLength(2); // refresh token 與金鑰對，沒有第三樣
    const strings = all.filter((v): v is string => typeof v === 'string');
    expect(strings).toEqual([(await storage.getRefreshToken())!]);
    for (const t of issued) expect(strings.join('')).not.toContain(t);
  });
});

describe('restoreSession（重新整理頁面）', () => {
  it('重新載入模組後，用持久的 refresh token ＋金鑰換新 access token，仍然登入且 refresh 已輪替', async () => {
    const { api, storage } = setup();
    const first = createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: api.fetch });
    await first.login(FAKE_EMAIL, FAKE_PASSWORD);
    const before = await storage.getRefreshToken();

    vi.resetModules();
    const fresh = await import('../../src/lib/auth/client');
    const reloaded = fresh.createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: api.fetch });
    expect(reloaded.isAuthenticated()).toBe(false); // 記憶體裡的 access token 沒了
    expect(await reloaded.restoreSession()).toBe(true);
    expect(reloaded.isAuthenticated()).toBe(true);
    expect(await storage.getRefreshToken()).not.toBe(before);
    expect((await reloaded.apiFetch(`${FAKE_API_BASE}/api/me`)).status).toBe(200);
  });

  it('沒有 refresh token＋金鑰（含只剩舊 cookie 的人）→ 視為未登入，不打任何請求', async () => {
    const { api, client } = setup();
    expect(await client.restoreSession()).toBe(false);
    expect(api.requests).toHaveLength(0);
  });

  it('只有 refresh token、缺金鑰 → 視為未登入並清掉殘留', async () => {
    const { api, storage, client } = setup();
    await storage.saveRefreshToken('orphan');
    expect(await client.restoreSession()).toBe(false);
    expect(await storage.getRefreshToken()).toBeNull();
    expect(api.requests).toHaveLength(0);
  });
});

describe('refresh', () => {
  it('輪替：存新 refresh token；舊的重放 → invalid_grant，整個 family 失效（新的也不能用）', async () => {
    const { api, storage, client, onReauthRequired } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    const r0 = (await storage.getRefreshToken())!;
    await client.refresh();
    const r1 = (await storage.getRefreshToken())!;
    expect(r1).not.toBe(r0);

    // 攻擊者／舊分頁拿舊 refresh 重放（用同一把金鑰簽 proof，等於最壞情況）
    const kp = (await storage.getKeyPair())!;
    const proof = await createDpopProof({ keyPair: kp, method: 'POST', url: `${FAKE_API_BASE}/api/oauth/token` });
    const replay = await api.fetch(`${FAKE_API_BASE}/api/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', DPoP: proof },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: r0, client_id: 'tripline-web' }),
    });
    expect((await replay.json()).error).toBe('invalid_grant');
    expect(api.isRefreshRevoked(r1)).toBe(true);

    // 合法 client 下一次 refresh 也失敗 → 清除並要求重新登入
    await expect(client.refresh()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(client.isAuthenticated()).toBe(false);
    expect(await storage.getRefreshToken()).toBeNull();
    expect(await storage.getKeyPair()).toBeNull();
    expect(onReauthRequired).toHaveBeenCalledTimes(1);
  });

  it('single-flight：併發 5 次 refresh 只送一個請求，共用結果', async () => {
    const { api, client } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    api.state.tokenDelayMs = 20;
    await Promise.all([client.refresh(), client.refresh(), client.refresh(), client.refresh(), client.refresh()]);
    expect(api.state.refreshCalls).toBe(1);
    // 結束後可以再發新的一輪
    await client.refresh();
    expect(api.state.refreshCalls).toBe(2);
  });

  it('暫時性失敗（5xx）不清除本地憑證、不要求重新登入', async () => {
    const { api, storage, client, onReauthRequired } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    api.state.failRefreshWith503 = true;
    await expect(client.refresh()).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    expect(await storage.getRefreshToken()).not.toBeNull();
    expect(onReauthRequired).not.toHaveBeenCalled();
    api.state.failRefreshWith503 = false;
    await client.refresh(); // 之後恢復正常，舊 refresh 仍有效
    expect(client.isAuthenticated()).toBe(true);
  });

  it('跨分頁：兩個 client 共用儲存時，後者在鎖內讀到前者輪替後的 refresh token（不會誤觸重用偵測）', async () => {
    const { api, storage, make } = setup();
    const a = make();
    await a.login(FAKE_EMAIL, FAKE_PASSWORD);
    const b = make();
    await b.restoreSession();
    await a.refresh();
    await b.refresh();
    expect(api.isRefreshRevoked((await storage.getRefreshToken())!)).toBe(false);
  });

  it('登出期間進行中的 refresh 不會讓 session 復活', async () => {
    const { api, storage, client } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    api.state.tokenDelayMs = 30;
    const pending = client.refresh().catch((e) => e);
    await new Promise((r) => setTimeout(r, 5));
    await client.logout();
    await pending;
    expect(client.isAuthenticated()).toBe(false);
    expect(await storage.getRefreshToken()).toBeNull();
  });
});

describe('apiFetch', () => {
  it('附 Authorization: DPoP 與新 proof：htm／htu／ath 正確、每次 jti 不同', async () => {
    const { api, client } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    await client.apiFetch(`${FAKE_API_BASE}/api/me?x=1`);
    await client.apiFetch(`${FAKE_API_BASE}/api/me?x=1`);
    const reqs = api.requests.filter((r) => r.url.includes('/api/me'));
    expect(reqs).toHaveLength(2);
    const [r1, r2] = reqs as [typeof reqs[0], typeof reqs[0]];
    const token = r1!.headers['authorization']!.replace(/^DPoP /, '');
    expect(r1!.headers['authorization']).toMatch(/^DPoP \S+$/);
    expect(r1!.dpopClaims).toMatchObject({ htm: 'GET', htu: `${FAKE_API_BASE}/api/me`, ath: await sha256B64u(token) });
    expect(r1!.dpopClaims!.jti).not.toBe(r2!.dpopClaims!.jti);
  });

  it('401 → refresh 一次後重試一次，成功', async () => {
    const { api, client } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    api.expireAccessTokens();
    const res = await client.apiFetch(`${FAKE_API_BASE}/api/me`);
    expect(res.status).toBe(200);
    expect(api.state.refreshCalls).toBe(1);
    expect(api.requests.filter((r) => r.url.endsWith('/api/me'))).toHaveLength(2);
  });

  it('重試後仍 401 → 不無限重試：只 refresh 一次、只重試一次，把 401 回給呼叫端', async () => {
    const { api, client } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    api.state.rejectResource = true;
    const res = await client.apiFetch(`${FAKE_API_BASE}/api/me`);
    expect(res.status).toBe(401);
    expect(api.state.refreshCalls).toBe(1);
    expect(api.requests.filter((r) => r.url.endsWith('/api/me'))).toHaveLength(2);
  });

  it('refresh 失敗（被撤銷）→ 清除並通知需要重新登入', async () => {
    const { api, storage, client, onReauthRequired } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    // 讓 api 端把 refresh 撤銷：先正常 refresh 一次，再用舊 token 無法……直接用重放製造 family 撤銷
    const r0 = (await storage.getRefreshToken())!;
    await client.refresh();
    const kp = (await storage.getKeyPair())!;
    await api.fetch(`${FAKE_API_BASE}/api/oauth/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        DPoP: await createDpopProof({ keyPair: kp, method: 'POST', url: `${FAKE_API_BASE}/api/oauth/token` }),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: r0, client_id: 'tripline-web' }),
    });
    api.expireAccessTokens();
    await expect(client.apiFetch(`${FAKE_API_BASE}/api/me`)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(onReauthRequired).toHaveBeenCalledTimes(1);
    expect(await storage.getRefreshToken()).toBeNull();
  });

  it('沒有登入就呼叫 → AUTH_REQUIRED 並通知，不送出任何請求', async () => {
    const { api, client, onReauthRequired } = setup();
    await expect(client.apiFetch(`${FAKE_API_BASE}/api/me`)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(onReauthRequired).toHaveBeenCalled();
    expect(api.requests).toHaveLength(0);
  });

  it('別的請求已經 refresh 過 → 遲到的 401 直接用新 token 重試，不多輪替一次', async () => {
    const { api, storage, onReauthRequired } = setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let held = false;
    const slow: typeof fetch = async (i, init) => {
      const res = await api.fetch(i, init); // 先在 api 端得到結果（此時 token 已過期 → 401）
      if (!held && String(i).endsWith('/api/me')) { held = true; await gate; }
      return res;
    };
    const c = createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: slow, onReauthRequired });
    await c.login(FAKE_EMAIL, FAKE_PASSWORD);
    api.expireAccessTokens();
    const b = c.apiFetch('/api/me'); // 401 的回應被扣住
    await new Promise((r) => setTimeout(r, 5));
    const a = await c.apiFetch('/api/me'); // 這個走完 refresh＋重試
    expect(a.status).toBe(200);
    release();
    expect((await b).status).toBe(200);
    expect(api.state.refreshCalls).toBe(1);
  });

  it('頁面重新整理後第一次呼叫會自動用 refresh 還原 access token', async () => {
    const { api, storage, make } = setup();
    await make().login(FAKE_EMAIL, FAKE_PASSWORD);
    const reloaded = make();
    const res = await reloaded.apiFetch(`${FAKE_API_BASE}/api/me`);
    expect(res.status).toBe(200);
    expect(api.state.refreshCalls).toBe(1);
    expect(await storage.getRefreshToken()).not.toBeNull();
  });

  it('相對路徑以 apiBase 解析', async () => {
    const { api, client } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    await client.apiFetch('/api/me');
    expect(api.requests.at(-1)!.url).toBe(`${FAKE_API_BASE}/api/me`);
  });
});

describe('logout', () => {
  it('呼叫 api logout 撤銷 grant；舊 access 與 refresh 都失效；本地清空', async () => {
    const { api, storage, client } = setup();
    await client.login(FAKE_EMAIL, FAKE_PASSWORD);
    await client.apiFetch(`${FAKE_API_BASE}/api/me`);
    const oldAccess = api.requests.at(-1)!.headers['authorization']!.replace(/^DPoP /, '');
    const oldRefresh = (await storage.getRefreshToken())!;
    expect(api.isAccessValid(oldAccess)).toBe(true);
    await client.logout();
    expect(api.requests.some((r) => r.url.endsWith('/api/oauth/logout') && r.method === 'POST')).toBe(true);
    expect(api.isAccessValid(oldAccess)).toBe(false);
    expect(api.isRefreshRevoked(oldRefresh)).toBe(true);
    expect(client.isAuthenticated()).toBe(false);
    expect(await storage.getRefreshToken()).toBeNull();
    expect(await storage.getKeyPair()).toBeNull();
  });

  it('api logout 失敗（網路錯誤）時仍清掉本地', async () => {
    const { storage } = setup();
    const api2 = createFakeOAuthApi();
    const flaky: typeof fetch = async (i, init) => {
      if (String(i).endsWith('/api/oauth/logout')) throw new TypeError('network down');
      return api2.fetch(i, init);
    };
    const c = createAuthClient({ apiBase: FAKE_API_BASE, storage, fetch: flaky });
    await c.login(FAKE_EMAIL, FAKE_PASSWORD);
    await expect(c.logout()).resolves.toBeUndefined();
    expect(c.isAuthenticated()).toBe(false);
    expect(await storage.getRefreshToken()).toBeNull();
  });

  it('只有 refresh token（重新整理後尚未還原）登出時，先還原再撤銷 grant', async () => {
    const { api, storage, make } = setup();
    await make().login(FAKE_EMAIL, FAKE_PASSWORD);
    const reloaded = make();
    await reloaded.logout();
    expect(api.requests.some((r) => r.url.endsWith('/api/oauth/logout'))).toBe(true);
    expect(await storage.getRefreshToken()).toBeNull();
  });
});

describe('feature flag（預設關閉）', () => {
  it('未設定或不是 "1" → getNewApiAuth／useNewApiAuth 回 null，不呼叫 fetch、不碰 IndexedDB', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const idbTouched = vi.fn();
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get: () => { idbTouched(); return undefined; } });
    for (const v of [undefined, '', '0', 'true']) {
      vi.stubEnv('VITE_NEW_API_AUTH', v as string);
      vi.resetModules();
      const mod = await import('../../src/lib/auth');
      expect(mod.isNewApiAuthEnabled()).toBe(false);
      expect(mod.getNewApiAuth()).toBeNull();
      expect(mod.useNewApiAuth()).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(idbTouched).not.toHaveBeenCalled();
    Reflect.deleteProperty(globalThis, 'indexedDB');
  });

  it('VITE_NEW_API_AUTH=1 且有 VITE_API_BASE_URL → 回同一個單例 client', async () => {
    vi.stubEnv('VITE_NEW_API_AUTH', '1');
    vi.stubEnv('VITE_API_BASE_URL', FAKE_API_BASE);
    vi.resetModules();
    const mod = await import('../../src/lib/auth');
    expect(mod.isNewApiAuthEnabled()).toBe(true);
    const c = mod.useNewApiAuth();
    expect(c).not.toBeNull();
    expect(mod.getNewApiAuth()).toBe(c);
  });

  it('啟用但沒設 VITE_API_BASE_URL → 明確丟設定錯誤（不要悄悄打到同源）', async () => {
    vi.stubEnv('VITE_NEW_API_AUTH', '1');
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.resetModules();
    const mod = await import('../../src/lib/auth');
    expect(() => mod.getNewApiAuth()).toThrow(/VITE_API_BASE_URL/);
  });
});
