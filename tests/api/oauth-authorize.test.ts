/**
 * GET /api/oauth/authorize — V2-P4
 * 走 HTTP 邊界（tests/api/http.ts）：client 與 consent 都放進真實 D1，
 * 授權碼與 PKCE 欄位改讀 oauth_models，不看 mock 呼叫形狀。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi } from './http';
import { signSessionToken } from '../../src/server/session';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';

const SECRET = 'session-secret-test';
// 套件共用同一個 D1：client_id 與使用者都用本檔專用的
const CLIENT = 'h1-authz-partner';
const PUBLIC_CLIENT = 'h1-authz-mobile';
const USER = 'h1-authz-user';
const CB = 'https://partner.com/cb';

let db: D1Database;
let api: ReturnType<typeof createApi>;

async function seedClient(clientId: string, type: 'confidential' | 'public') {
  await db.prepare(`INSERT OR REPLACE INTO client_apps
    (client_id, client_type, app_name, redirect_uris, allowed_scopes, status)
    VALUES (?, ?, 'Partner X', ?, ?, 'active')`)
    .bind(clientId, type, JSON.stringify([CB]), JSON.stringify(['openid', 'profile', 'email'])).run();
}

async function grantConsent(clientId: string, scopes: string[]) {
  await new D1Adapter(db, 'Consent').upsert(
    `${USER}:${clientId}`,
    { user_id: USER, client_id: clientId, scopes, grantedAt: Date.now() },
    60,
  );
}

async function sessionCookie() {
  return `tripline_session=${await signSessionToken(USER, SECRET)}`;
}

/** 本檔建立過的授權碼（用 client_id 篩，避免撈到其他檔案的資料）。 */
async function storedCodes(clientId: string) {
  const { results } = await db
    .prepare("SELECT id, payload FROM oauth_models WHERE name = 'AuthorizationCode' AND json_extract(payload, '$.client_id') = ?")
    .bind(clientId).all<{ id: string; payload: string }>();
  return results.map(r => ({ id: r.id, payload: JSON.parse(r.payload) as Record<string, unknown> }));
}

const authorize = (params: Record<string, string>, cookie?: string) =>
  api.get(`https://x.com/api/oauth/authorize?${new URLSearchParams(params)}`, cookie ? { headers: { Cookie: cookie } } : {});

const PKCE = { code_challenge: 'test-pkce-challenge', code_challenge_method: 'S256' };

const CLEAN = "DELETE FROM oauth_models WHERE name IN ('Consent', 'AuthorizationCode') AND (id LIKE 'h1-authz-%' OR json_extract(payload, '$.client_id') LIKE 'h1-authz-%' OR json_extract(payload, '$.user_id') = 'h1-authz-user')";

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { SESSION_SECRET: SECRET }) });
  await seedClient(CLIENT, 'confidential');
  await seedClient(PUBLIC_CLIENT, 'public');
});

beforeEach(async () => {
  await db.prepare(CLEAN).run();
});

afterAll(async () => {
  await db.prepare(CLEAN).run();
  await db.prepare("DELETE FROM auth_audit_log WHERE client_id LIKE 'h1-authz-%'").run();
  await db.prepare("DELETE FROM client_apps WHERE client_id LIKE 'h1-authz-%'").run();
  await disposeMiniflare();
});

describe('GET /api/oauth/authorize', () => {
  it('400 when client_id missing (not redirectable)', async () => {
    const res = await authorize({ response_type: 'code' });
    expect(res.status).toBe(400);
  });

  it('400 when client_id unknown (not redirectable)', async () => {
    const res = await authorize({
      client_id: 'h1-authz-unknown', redirect_uri: CB, response_type: 'code', scope: 'openid',
    });
    expect(res.status).toBe(400);
  });

  it('302 to client redirect_uri with error when scope invalid', async () => {
    const res = await authorize({
      client_id: CLIENT, redirect_uri: CB, response_type: 'code',
      scope: 'admin', // not in allowed
      state: 'csrf-1',
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toContain('https://partner.com/cb?');
    expect(loc).toContain('error=invalid_scope');
    expect(loc).toContain('state=csrf-1');
  });

  it('302 to /login when valid request but no session', async () => {
    const res = await authorize({
      client_id: CLIENT, redirect_uri: CB, response_type: 'code', scope: 'openid', state: 's', ...PKCE,
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toMatch(/^\/login\?redirect_after=/);
    expect(decodeURIComponent(loc)).toContain('/api/oauth/authorize?');
    expect(await storedCodes(CLIENT)).toHaveLength(0);
  });

  it('logged in + no Consent → 302 /oauth/consent (V2-P5 integration)', async () => {
    const res = await authorize({
      client_id: CLIENT, redirect_uri: CB, response_type: 'code', scope: 'openid profile', state: 'csrf-xyz', ...PKCE,
    }, await sessionCookie());

    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toMatch(/^\/oauth\/consent\?/);
    expect(loc).toContain(`client_id=${CLIENT}`);
    expect(loc).toContain('state=csrf-xyz');
    expect(loc).toContain('scope=openid+profile'); // URLSearchParams uses + for space
    expect(await storedCodes(CLIENT)).toHaveLength(0);
  });

  it('logged in + has Consent covering all scopes → 302 redirect_uri?code=&state=', async () => {
    await grantConsent(CLIENT, ['openid', 'profile', 'email']);
    const res = await authorize({
      client_id: CLIENT, redirect_uri: CB, response_type: 'code', scope: 'openid profile', state: 'csrf-xyz', ...PKCE,
    }, await sessionCookie());

    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toMatch(/^https:\/\/partner\.com\/cb\?code=[A-Za-z0-9_-]+&state=csrf-xyz$/);
    // 回傳的 code 確實落在 D1，且綁定這位使用者與 client
    const code = new URL(loc).searchParams.get('code')!;
    const stored = await new D1Adapter(db, 'AuthorizationCode').find(code);
    expect(stored?.client_id).toBe(CLIENT);
    expect(stored?.user_id).toBe(USER);
    expect(stored?.redirect_uri).toBe(CB);
    expect(stored?.scopes).toEqual(['openid', 'profile']);
  });

  it('Consent insufficient (missing requested scope) → 302 /oauth/consent', async () => {
    await grantConsent(CLIENT, ['openid']); // missing 'profile'
    const res = await authorize({
      client_id: CLIENT, redirect_uri: CB, response_type: 'code',
      scope: 'openid profile', // requesting profile not in stored consent
      state: 's', ...PKCE,
    }, await sessionCookie());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/^\/oauth\/consent\?/);
    expect(await storedCodes(CLIENT)).toHaveLength(0);
  });

  it('prompt=consent forces re-prompt even with stored Consent', async () => {
    await grantConsent(CLIENT, ['openid', 'profile', 'email']);
    const res = await authorize({
      client_id: CLIENT, redirect_uri: CB, response_type: 'code', scope: 'openid', state: 's',
      prompt: 'consent', ...PKCE,
    }, await sessionCookie());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/^\/oauth\/consent\?/);
    expect(await storedCodes(CLIENT)).toHaveLength(0);
  });

  it('PKCE public client: code_challenge stored (with consent granted)', async () => {
    await grantConsent(PUBLIC_CLIENT, ['openid']);
    const res = await authorize({
      client_id: PUBLIC_CLIENT, redirect_uri: CB, response_type: 'code', scope: 'openid',
      code_challenge: 'pkce-challenge-abc', code_challenge_method: 'S256', state: 's',
    }, await sessionCookie());

    expect(res.status).toBe(302);
    // 原本檢查 INSERT 的 bind 參數（且包在 if 裡，找不到時什麼都不驗）；改讀真實 D1，一定要有一筆
    const codes = await storedCodes(PUBLIC_CLIENT);
    expect(codes).toHaveLength(1);
    expect(codes[0]!.payload.code_challenge).toBe('pkce-challenge-abc');
    expect(codes[0]!.payload.code_challenge_method).toBe('S256');
  });

  it('缺 PKCE（mutation 補的缺口）→ 302 回 client 帶 invalid_request，且不發授權碼', async () => {
    await grantConsent(CLIENT, ['openid']);
    const res = await authorize({
      client_id: CLIENT, redirect_uri: CB, response_type: 'code', scope: 'openid', state: 's',
    }, await sessionCookie());
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('Location')!);
    expect(loc.origin + loc.pathname).toBe(CB);
    expect(loc.searchParams.get('error')).toBe('invalid_request');
    expect(loc.searchParams.has('code')).toBe(false);
    expect(await storedCodes(CLIENT)).toHaveLength(0);
  });

  it('Rejects redirect_uri not in whitelist (not redirectable)', async () => {
    const res = await authorize({
      client_id: CLIENT, redirect_uri: 'https://evil.com/cb', response_type: 'code', scope: 'openid',
    });
    expect(res.status).toBe(400);
    // Not 302 — security critical, attacker shouldn't get redirect to their own URL
    expect(res.headers.get('Location')).toBeNull();
  });
});
