/**
 * mobile OAuth callback 的註冊與環境政策 —— 走 HTTP 邊界（tests/api/http.ts）。
 * 公開端點（authorize／token）不需認證；consent 用 session cookie（harness 自動補允許的 Origin）。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi } from './http';
import type { Env } from '../../functions/api/_types';
import { MOBILE_PROD_REDIRECT, MOBILE_UAT_REDIRECT } from '../../functions/api/_mobileOAuth';

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); }, 30000);
afterAll(async () => {
  // 共用 D1：清掉流程測試建立的使用者與其授權碼、grant、token
  await db.prepare("DELETE FROM oauth_models WHERE payload LIKE '%mobile-flow-user%'").run();
  await db.prepare("DELETE FROM session_devices WHERE user_id = 'mobile-flow-user'").run();
  await db.prepare("DELETE FROM users WHERE id = 'mobile-flow-user'").run();
  await disposeMiniflare();
});

const apiFor = (overrides: Partial<Env>) => createApi({ env: mockEnv(db, overrides) });

function authUrl(origin: string, clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({ response_type: 'code', client_id: clientId,
    redirect_uri: redirectUri, scope: 'openid profile', state: 'mobile-state',
    code_challenge: 'challenge-'.repeat(5), code_challenge_method: 'S256' });
  return `${origin}/api/oauth/authorize?${params}`;
}

describe('mobile OAuth callback registry and environment policy', () => {
  it('registers exact production and UAT callbacks as public clients in D1', async () => {
    const prod = await db.prepare('SELECT client_type, redirect_uris FROM client_apps WHERE client_id = ?')
      .bind('tripline-mobile').first<{ client_type: string; redirect_uris: string }>();
    const uat = await db.prepare('SELECT client_type, redirect_uris FROM client_apps WHERE client_id = ?')
      .bind('tripline-mobile-uat').first<{ client_type: string; redirect_uris: string }>();
    expect(prod?.client_type).toBe('public');
    expect(JSON.parse(prod!.redirect_uris)).toContain(MOBILE_PROD_REDIRECT);
    expect(uat?.client_type).toBe('public');
    expect(JSON.parse(uat!.redirect_uris)).toEqual([MOBILE_UAT_REDIRECT]);
  });

  it('production only starts the registered production client and callback', async () => {
    const origin = 'https://trip-planner-dby.pages.dev';
    const api = apiFor({ ENVIRONMENT: 'production', PUBLIC_ORIGIN: origin });
    const valid = await api.get(authUrl(origin, 'tripline-mobile', MOBILE_PROD_REDIRECT));
    expect(valid.status).toBe(302);
    expect(valid.headers.get('Location')).toMatch(/^\/login\?/);
    for (const [clientId, redirectUri] of [
      ['tripline-mobile', 'http://127.0.0.1:8765'],
      ['tripline-mobile-uat', MOBILE_UAT_REDIRECT],
    ]) {
      const denied = await api.get(authUrl(origin, clientId, redirectUri));
      expect(denied.status).toBe(400);
      expect(denied.headers.get('Location')).toBeNull();
    }
  });

  it('UAT only starts UAT client from its canonical host', async () => {
    const origin = 'https://uat.trip-planner-dby.pages.dev';
    const api = apiFor({ ENVIRONMENT: 'preview' });
    const valid = await api.get(authUrl(origin, 'tripline-mobile-uat', MOBILE_UAT_REDIRECT));
    expect(valid.status).toBe(302);
    expect(valid.headers.get('Location')).toMatch(/^\/login\?/);
    const preview = await api.get(authUrl('https://random-preview.trip-planner-dby.pages.dev', 'tripline-mobile-uat', MOBILE_UAT_REDIRECT));
    expect(preview.status).toBe(400);
  });

  it('production token endpoint rejects the UAT public client', async () => {
    const origin = 'https://trip-planner-dby.pages.dev';
    const api = apiFor({ ENVIRONMENT: 'production', PUBLIC_ORIGIN: origin });
    const response = await api.request('POST', `${origin}/api/oauth/token`, {
      form: { grant_type: 'refresh_token', client_id: 'tripline-mobile-uat', refresh_token: 'unknown' },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_client' });
  });

  it('UAT public client completes PKCE code-to-token with exact redirect and one-use code', async () => {
    const origin = 'https://uat.trip-planner-dby.pages.dev';
    const api = apiFor({ ENVIRONMENT: 'preview', SESSION_SECRET: 'mobile-test-secret' });
    const uid = 'mobile-flow-user';
    const { cookie } = await api.sessionFor('mobile-flow@example.com', uid);
    const verifier = 'mobile-pkce-verifier-'.repeat(3);
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const challenge = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const params = {
      response_type: 'code', client_id: 'tripline-mobile-uat', redirect_uri: MOBILE_UAT_REDIRECT,
      scope: 'profile', state: 'state-preserved', code_challenge: challenge, code_challenge_method: 'S256',
    };
    const authorizeUrl = `${origin}/api/oauth/authorize?${new URLSearchParams(params)}`;
    const first = await api.get(authorizeUrl, { cookie });
    expect(first.headers.get('Location')).toMatch(/^\/oauth\/consent\?/);
    const approved = await api.request('POST', `${origin}/api/oauth/consent`, { cookie, form: { ...params, decision: 'allow' } });
    expect(approved.status).toBe(302);
    const issued = await api.get(authorizeUrl, { cookie });
    const callback = new URL(issued.headers.get('Location')!);
    expect(callback.origin + callback.pathname).toBe(MOBILE_UAT_REDIRECT);
    expect(callback.searchParams.get('state')).toBe('state-preserved');
    const code = callback.searchParams.get('code')!;
    const exchange = (codeVerifier: string) => api.request('POST', `${origin}/api/oauth/token`, {
      form: { grant_type: 'authorization_code', client_id: 'tripline-mobile-uat', redirect_uri: MOBILE_UAT_REDIRECT, code, code_verifier: codeVerifier },
    });
    expect((await exchange('wrong-verifier')).status).toBe(400);
    const success = await exchange(verifier);
    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({ token_type: 'Bearer', scope: 'profile' });
    expect((await exchange(verifier)).status).toBe(400);
  });
});
