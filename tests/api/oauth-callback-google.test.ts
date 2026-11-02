/**
 * GET /api/oauth/callback/google — V2-P1
 *
 * 走 HTTP 邊界（tests/api/http.ts）：state、使用者、identity 都放進真實 D1，
 * 結果改讀 users / auth_identities / session_devices / oauth_models 的資料變化。
 *
 * 外部邊界只 stub 兩個：Google 的 token endpoint（fetch）與 id_token 驗章
 * （verifyGoogleIdToken 會去抓 Google 的 live JWKS；真實驗章由 jwt-module / google-id-token 的單元測試涵蓋）。
 * 這裡驗的是 callback 流程本身（state 驗證、建立使用者、發 session）。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/server/oauth-client/google-id-token', () => ({
  verifyGoogleIdToken: vi.fn(async (idToken: string) => {
    // Decode payload without signature verification (test-only).
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('JWT must have 3 parts');
    const payloadB64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (payloadB64.length % 4)) % 4;
    const json = atob(payloadB64 + '='.repeat(padLen));
    return JSON.parse(json);
  }),
}));

import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi } from './http';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';
import { verifySessionToken } from '../../src/server/session';
import type { Env } from '../../functions/api/_types';

const SESSION_SECRET = 'session-secret-test';
// 套件共用同一個 D1：state / email / sub 都用本檔專用的
const EXISTING_EMAIL = 'h1-cb-existing@example.com';
const EXISTING_USER_ID = 'h1-cb-existing-user';
const EXISTING_SUB = 'h1-cb-sub-existing';
const NEW_EMAIL = 'h1-cb-new@example.com';
const NEW_SUB = 'h1-cb-sub-new';
const STATE_PREFIX = 'h1-cb-state-';

let db: D1Database;

/** Minimal id_token JWT — header.payload.signature where payload is base64url(JSON) */
function makeIdToken(payload: object): string {
  const enc = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return [enc('{"alg":"RS256"}'), enc(JSON.stringify(payload)), 'fake-signature'].join('.');
}

const api = (overrides: Partial<Env> = {}) => createApi({ env: mockEnv(db, overrides) });
const configured = { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'secret', SESSION_SECRET };

async function putState(name: string, redirectAfterLogin = '/manage'): Promise<string> {
  const id = STATE_PREFIX + name;
  await new D1Adapter(db, 'OAuthState').upsert(id, { provider: 'google', redirectAfterLogin, createdAt: Date.now() }, 300);
  return id;
}

const stateExists = async (id: string) =>
  (await db.prepare("SELECT 1 AS x FROM oauth_models WHERE name = 'OAuthState' AND id = ?").bind(id).first()) !== null;

const callback = (state: string, overrides: Partial<Env> = {}) =>
  api(overrides).get(`https://x.com/api/oauth/callback/google?code=auth-code&state=${state}`);

let fetchSpy: ReturnType<typeof vi.spyOn>;

function googleReturns(body: BodyInit, status = 200) {
  fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status }));
}
const googleIssues = (claims: object) => googleReturns(JSON.stringify({
  access_token: 'at', id_token: makeIdToken(claims), expires_in: 3600, token_type: 'Bearer',
}));

async function cleanup() {
  await db.prepare("DELETE FROM oauth_models WHERE name = 'OAuthState' AND id LIKE ?").bind(`${STATE_PREFIX}%`).run();
  for (const sub of [EXISTING_SUB, NEW_SUB]) {
    await db.prepare("DELETE FROM auth_identities WHERE provider = 'google' AND provider_user_id = ?").bind(sub).run();
  }
  await db.prepare('DELETE FROM session_devices WHERE user_id IN (SELECT id FROM users WHERE email IN (?, ?))').bind(EXISTING_EMAIL, NEW_EMAIL).run();
  await db.prepare('DELETE FROM users WHERE email IN (?, ?)').bind(EXISTING_EMAIL, NEW_EMAIL).run();
}

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  await cleanup();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await cleanup();
  await disposeMiniflare();
});

describe('GET /api/oauth/callback/google', () => {
  it('400 OAUTH_MISSING_PARAMS when no code/state', async () => {
    const res = await api().get('https://x.com/api/oauth/callback/google');
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_MISSING_PARAMS');
  });

  it('400 OAUTH_INVALID_STATE when state not in D1', async () => {
    const res = await callback('h1-cb-state-missing');
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_INVALID_STATE');
  });

  it('503 when GOOGLE_CLIENT_SECRET missing (after state validate)', async () => {
    const state = await putState('no-secret');
    const res = await callback(state, { GOOGLE_CLIENT_ID: 'gid' }); // CLIENT_SECRET missing
    expect(res.status).toBe(503);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_NOT_CONFIGURED');
  });

  it('happy path: existing identity → update last_used_at + 302 redirect with session cookie', async () => {
    await db.prepare('INSERT INTO users (id, email, email_verified_at, display_name) VALUES (?, ?, ?, ?)')
      .bind(EXISTING_USER_ID, EXISTING_EMAIL, '2026-01-01T00:00:00.000Z', 'Existing').run();
    await db.prepare("INSERT INTO auth_identities (user_id, provider, provider_user_id, last_used_at) VALUES (?, 'google', ?, '2000-01-01T00:00:00.000Z')")
      .bind(EXISTING_USER_ID, EXISTING_SUB).run();
    const state = await putState('existing');
    googleIssues({ sub: EXISTING_SUB, email: EXISTING_EMAIL, name: 'User Name' });

    const res = await callback(state, configured);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/manage');
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(/tripline_session=/);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
    // token exchange 的 redirect_uri 以請求的 origin 組成
    const sent = new URLSearchParams((fetchSpy.mock.calls[0]![1] as { body: URLSearchParams }).body);
    expect(sent.get('redirect_uri')).toBe('https://x.com/api/oauth/callback/google');
    expect(sent.get('code')).toBe('auth-code');

    // 資料變化：last_used_at 被更新、session 指向既有使用者、state 用過即銷毀
    const identity = await db.prepare("SELECT last_used_at FROM auth_identities WHERE provider = 'google' AND provider_user_id = ?")
      .bind(EXISTING_SUB).first<{ last_used_at: string }>();
    expect(identity?.last_used_at).not.toBe('2000-01-01T00:00:00.000Z');
    const token = /tripline_session=([^;]+)/.exec(cookie)![1]!;
    expect((await verifySessionToken(token, SESSION_SECRET))?.uid).toBe(EXISTING_USER_ID);
    expect(await stateExists(state)).toBe(false);
    const users = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').bind(EXISTING_EMAIL).first<{ n: number }>();
    expect(users?.n).toBe(1);
  });

  it('happy path: new user → create user + identity row + redirect', async () => {
    const state = await putState('new', '/explore');
    googleIssues({ sub: NEW_SUB, email: NEW_EMAIL, email_verified: true, name: 'New' });

    const res = await callback(state, configured);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/explore');
    expect(res.headers.get('Set-Cookie')).toMatch(/tripline_session=/);
    // 確認真的寫進 users + auth_identities
    const user = await db.prepare('SELECT id, display_name, email_verified_at FROM users WHERE email = ?')
      .bind(NEW_EMAIL).first<{ id: string; display_name: string; email_verified_at: string | null }>();
    expect(user).not.toBeNull();
    expect(user!.display_name).toBe('New');
    expect(user!.email_verified_at).toBeTruthy();
    const identity = await db.prepare("SELECT user_id FROM auth_identities WHERE provider = 'google' AND provider_user_id = ?")
      .bind(NEW_SUB).first<{ user_id: string }>();
    expect(identity?.user_id).toBe(user!.id);
    // state 一次性：重放同一個 state 被拒
    fetchSpy.mockClear();
    const replay = await callback(state, configured);
    expect(replay.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('新帳號的 Google email 未驗證 → 400 OAUTH_EMAIL_UNVERIFIED，不建使用者（mutation 補的缺口）', async () => {
    const state = await putState('unverified');
    googleIssues({ sub: NEW_SUB, email: NEW_EMAIL, email_verified: false, name: 'New' });
    const res = await callback(state, configured);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_EMAIL_UNVERIFIED');
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(await db.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(NEW_EMAIL).first()).toBeNull();
    expect(await db.prepare("SELECT 1 AS x FROM auth_identities WHERE provider = 'google' AND provider_user_id = ?").bind(NEW_SUB).first()).toBeNull();
  });

  it('502 OAUTH_TOKEN_EXCHANGE_FAILED when Google rejects code', async () => {
    const state = await putState('rejected');
    googleReturns('invalid_grant', 400);
    const res = await callback(state, configured);
    expect(res.status).toBe(502);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('400 OAUTH_INVALID_ID_TOKEN when id_token missing sub/email', async () => {
    const state = await putState('bad-claims');
    googleIssues({ aud: 'no-sub-no-email' }); // missing sub/email
    const res = await callback(state, configured);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_INVALID_ID_TOKEN');
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });
});
