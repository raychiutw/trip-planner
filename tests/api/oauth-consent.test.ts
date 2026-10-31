/**
 * POST /api/oauth/consent — V2-P5
 * 走 HTTP 邊界（tests/api/http.ts）：經真實 middleware（含 CSRF Origin 檢查），
 * client 放進真實 D1，「有沒有記下同意」改讀 oauth_models 的 Consent 資料列。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi } from './http';
import { signSessionToken } from '../../src/server/session';

const SECRET = 'session-secret-test';
// 套件共用同一個 D1：client_id 與使用者都用本檔專用的
const CLIENT = 'h1-consent-partner';
const USER = 'h1-consent-user';
const ORIGIN = 'https://trip-planner-dby.pages.dev';
const CB = 'https://x.com/cb';
const CB_WITH_QUERY = 'https://x.com/cb?source=1&code=stale';
const KEY = `${USER}:${CLIENT}`;

let db: D1Database;
let api: ReturnType<typeof createApi>;

const sessionCookie = async (uid = USER, ttl?: number) =>
  `tripline_session=${await signSessionToken(uid, SECRET, ttl)}`;

const consent = (form: Record<string, string>, cookie?: string, origin: string | null = ORIGIN) =>
  api.request('POST', 'https://x.com/api/oauth/consent', {
    form,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
  });

async function storedConsent() {
  const row = await db
    .prepare("SELECT payload, expires_at FROM oauth_models WHERE name = 'Consent' AND id LIKE 'h1-consent-%'")
    .all<{ payload: string; expires_at: number }>();
  return row.results.map(r => ({ payload: JSON.parse(r.payload) as Record<string, unknown>, expiresAt: r.expires_at }));
}

const CLEAN = "DELETE FROM oauth_models WHERE name = 'Consent' AND id LIKE 'h1-consent-%'";

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { SESSION_SECRET: SECRET }) });
  await db.prepare(`INSERT OR REPLACE INTO client_apps
    (client_id, client_type, app_name, redirect_uris, allowed_scopes, status)
    VALUES (?, 'public', 'Partner', ?, ?, 'active')`)
    .bind(CLIENT, JSON.stringify([CB, 'https://x.com/alt', CB_WITH_QUERY]), JSON.stringify(['openid', 'profile'])).run();
});

beforeEach(async () => {
  await db.prepare(CLEAN).run();
});

afterAll(async () => {
  await db.prepare(CLEAN).run();
  await db.prepare("DELETE FROM auth_audit_log WHERE client_id LIKE 'h1-consent-%'").run();
  await db.prepare("DELETE FROM client_apps WHERE client_id LIKE 'h1-consent-%'").run();
  await disposeMiniflare();
});

describe('POST /api/oauth/consent', () => {
  it('does not record consent or redirect when an unknown client is allowed', async () => {
    const res = await consent({
      client_id: 'h1-consent-unknown', redirect_uri: 'https://attacker.com/cb',
      response_type: 'code', scope: 'openid', decision: 'allow',
      code_challenge: 'challenge', code_challenge_method: 'S256',
    }, await sessionCookie());
    expect(res.status).toBe(400);
    expect(res.headers.get('Location')).toBeNull();
    expect(await storedConsent()).toHaveLength(0);
  });

  it.each([
    ['unregistered redirect', 'https://attacker.com/cb', 'openid', 'challenge', 'S256', 'code', 400, null],
    ['disallowed scope', CB, 'admin', 'challenge', 'S256', 'code', 302, 'invalid_scope'],
    ['missing PKCE', CB, 'openid', '', '', 'code', 302, 'invalid_request'],
    ['missing response type', CB, 'openid', 'challenge', 'S256', '', 302, 'unsupported_response_type'],
  ])('allow with %s never records consent', async (_case, redirectUri, scope, challenge, method, responseType, status, errorCode) => {
    const res = await consent({
      client_id: CLIENT, redirect_uri: redirectUri,
      response_type: responseType, scope, decision: 'allow',
      code_challenge: challenge, code_challenge_method: method,
    }, await sessionCookie());
    expect(res.status).toBe(status);
    const location = res.headers.get('Location');
    if (errorCode) {
      expect(location).toContain('https://x.com/cb?error=' + errorCode);
      expect(location).not.toContain('code=');
    } else {
      expect(location).toBeNull();
    }
    expect(await storedConsent()).toHaveLength(0);
  });

  it('302 to /login when no session (preserve params via redirect_after)', async () => {
    const res = await consent({
      client_id: CLIENT, redirect_uri: CB, scope: 'openid', state: 's',
      response_type: 'code', decision: 'allow',
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toMatch(/^\/login\?redirect_after=/);
    expect(decodeURIComponent(loc)).toContain('/oauth/consent?');
    expect(decodeURIComponent(loc)).toContain(`client_id=${CLIENT}`);
    expect(await storedConsent()).toHaveLength(0);
  });

  it('expired session returns to login without recording consent', async () => {
    const res = await consent({
      client_id: CLIENT, redirect_uri: CB,
      response_type: 'code', scope: 'openid', decision: 'allow',
      code_challenge: 'challenge', code_challenge_method: 'S256',
    }, await sessionCookie(USER, -1));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/^\/login\?redirect_after=/);
    expect(await storedConsent()).toHaveLength(0);
  });

  it('decision=deny + redirect_uri in client_apps allowlist → 302 with error=access_denied', async () => {
    const res = await consent({
      client_id: CLIENT, redirect_uri: CB, scope: 'openid', state: 'csrf-1', decision: 'deny',
    }, await sessionCookie());
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toContain('https://x.com/cb');
    expect(loc).toContain('error=access_denied');
    expect(loc).toContain('state=csrf-1');
    expect(await storedConsent()).toHaveLength(0);
  });

  it('preserves an allowlisted redirect query when denying', async () => {
    const res = await consent({
      client_id: CLIENT, redirect_uri: CB_WITH_QUERY, scope: 'openid', state: 'csrf-1', decision: 'deny',
    }, await sessionCookie());
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location')!);
    expect(location.searchParams.get('source')).toBe('1');
    expect(location.searchParams.has('code')).toBe(false);
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('state')).toBe('csrf-1');
  });

  it('decision=deny + redirect_uri NOT in allowlist → 400 (open-redirect guard)', async () => {
    const res = await consent({
      client_id: CLIENT, redirect_uri: 'https://attacker.com/phish', scope: 'openid', state: 's', decision: 'deny',
    }, await sessionCookie());
    expect(res.status).toBe(400);
    expect(res.headers.get('Location')).toBeNull();
    const json = await res.json() as { error: string; error_description?: string };
    expect(json.error).toBe('invalid_request');
    expect(json.error_description).toContain('not registered');
  });

  it('decision=deny + unknown client_id → 400 (open-redirect guard)', async () => {
    const res = await consent({
      client_id: 'h1-consent-unknown', redirect_uri: 'https://attacker.com', scope: 'openid', state: 's', decision: 'deny',
    }, await sessionCookie());
    expect(res.status).toBe(400);
    expect(res.headers.get('Location')).toBeNull();
  });

  it('decision=allow → store Consent in D1 + 302 back to /api/oauth/authorize', async () => {
    const res = await consent({
      client_id: CLIENT, redirect_uri: CB, response_type: 'code', scope: 'openid profile',
      state: 'csrf-x', decision: 'allow', code_challenge: 'challenge', code_challenge_method: 'S256',
    }, await sessionCookie());

    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toContain('/api/oauth/authorize?');
    expect(loc).toContain(`client_id=${CLIENT}`);
    expect(loc).toContain('state=csrf-x');

    // 讀真實 D1：key = uid:client_id
    const row = await db.prepare("SELECT payload FROM oauth_models WHERE name = 'Consent' AND id = ?")
      .bind(KEY).first<{ payload: string }>();
    expect(row).not.toBeNull();
    const payload = JSON.parse(row!.payload);
    expect(payload.user_id).toBe(USER);
    expect(payload.client_id).toBe(CLIENT);
    expect(payload.scopes).toEqual(['openid', 'profile']);
  });

  it('400 invalid_request when decision missing or unknown', async () => {
    const cookie = await sessionCookie();
    const r1 = await consent({ client_id: 'p', redirect_uri: 'r', scope: 'openid' }, cookie);
    expect(r1.status).toBe(400);

    const r2 = await consent({ client_id: 'p', redirect_uri: 'r', scope: 'openid', decision: 'maybe' }, cookie);
    expect(r2.status).toBe(400);
    expect(await storedConsent()).toHaveLength(0);

    // mutation 補的缺口：其餘參數都合法時，未知的 decision 也不能記下同意
    const valid = {
      client_id: CLIENT, redirect_uri: CB, response_type: 'code', scope: 'openid',
      code_challenge: 'challenge', code_challenge_method: 'S256',
    };
    const r3 = await consent({ ...valid, decision: 'maybe' }, cookie);
    expect(r3.status).toBe(400);
    const r4 = await consent(valid, cookie);
    expect(r4.status).toBe(400);
    expect(await storedConsent()).toHaveLength(0);
  });

  it('400 when decision=allow but client_id missing', async () => {
    const res = await consent({ decision: 'allow', scope: 'openid' }, await sessionCookie());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error_description: string }).error_description).toContain('client_id');
  });

  it('Consent TTL = 1 year', async () => {
    const before = Date.now();
    await consent({
      client_id: CLIENT, redirect_uri: CB, scope: 'openid',
      decision: 'allow', response_type: 'code', state: 's',
      code_challenge: 'challenge', code_challenge_method: 'S256',
    }, await sessionCookie());
    const after = Date.now();
    const rows = await storedConsent();
    // 原本包在 if 裡，找不到 INSERT 就什麼都不驗；改讀真實 D1，一定要有一筆
    expect(rows).toHaveLength(1);
    const year = 365 * 24 * 60 * 60 * 1000;
    expect(rows[0]!.expiresAt).toBeGreaterThanOrEqual(before + year);
    expect(rows[0]!.expiresAt).toBeLessThanOrEqual(after + year);
  });
});

// 以下是 mutation 發現原測試沒有涵蓋、而 HTTP 邊界才看得到的缺口：consent 是 session cookie 認證的
// browser form POST，middleware 的 CSRF Origin 檢查是唯一防線。
describe('POST /api/oauth/consent — CSRF（經 middleware）', () => {
  const allowForm = {
    client_id: CLIENT, redirect_uri: CB, response_type: 'code', scope: 'openid',
    state: 's', decision: 'allow', code_challenge: 'challenge', code_challenge_method: 'S256',
  };

  it('缺 Origin → 403，不記同意', async () => {
    const res = await consent(allowForm, await sessionCookie(), null);
    expect(res.status).toBe(403);
    expect(await storedConsent()).toHaveLength(0);
  });

  it('不在白名單的 Origin → 403，不記同意', async () => {
    const res = await consent(allowForm, await sessionCookie(), 'https://evil.example');
    expect(res.status).toBe(403);
    expect(await storedConsent()).toHaveLength(0);
  });
});
