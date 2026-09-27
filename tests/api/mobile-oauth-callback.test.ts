import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockContext, mockEnv } from './helpers';
import { onRequestGet as authorize } from '../../functions/api/oauth/authorize';
import { onRequestPost as token } from '../../functions/api/oauth/token';
import { onRequestPost as consent } from '../../functions/api/oauth/consent';
import { signSessionToken } from '../../src/server/session';
import { MOBILE_PROD_REDIRECT, MOBILE_UAT_REDIRECT } from '../../functions/api/_mobileOAuth';

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); }, 30000);
afterAll(disposeMiniflare);

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
    const env = mockEnv(db, { ENVIRONMENT: 'production', PUBLIC_ORIGIN: origin });
    const valid = await authorize(mockContext({ request: new Request(authUrl(origin, 'tripline-mobile', MOBILE_PROD_REDIRECT)), env }) as never);
    expect(valid.status).toBe(302);
    expect(valid.headers.get('Location')).toMatch(/^\/login\?/);
    for (const [clientId, redirectUri] of [
      ['tripline-mobile', 'http://127.0.0.1:8765'],
      ['tripline-mobile-uat', MOBILE_UAT_REDIRECT],
    ]) {
      const denied = await authorize(mockContext({ request: new Request(authUrl(origin, clientId, redirectUri)), env }) as never);
      expect(denied.status).toBe(400);
      expect(denied.headers.get('Location')).toBeNull();
    }
  });

  it('UAT only starts UAT client from its canonical host', async () => {
    const origin = 'https://uat.trip-planner-dby.pages.dev';
    const env = mockEnv(db, { ENVIRONMENT: 'preview' });
    const valid = await authorize(mockContext({ request: new Request(authUrl(origin, 'tripline-mobile-uat', MOBILE_UAT_REDIRECT)), env }) as never);
    expect(valid.status).toBe(302);
    expect(valid.headers.get('Location')).toMatch(/^\/login\?/);
    const preview = await authorize(mockContext({ request: new Request(authUrl('https://random-preview.trip-planner-dby.pages.dev', 'tripline-mobile-uat', MOBILE_UAT_REDIRECT)), env }) as never);
    expect(preview.status).toBe(400);
  });

  it('production token endpoint rejects the UAT public client', async () => {
    const origin = 'https://trip-planner-dby.pages.dev';
    const env = mockEnv(db, { ENVIRONMENT: 'production', PUBLIC_ORIGIN: origin });
    const request = new Request(`${origin}/api/oauth/token`, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: 'tripline-mobile-uat', refresh_token: 'unknown' }) });
    const response = await token(mockContext({ request, env }) as never);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_client' });
  });

  it('UAT public client completes PKCE code-to-token with exact redirect and one-use code', async () => {
    const origin = 'https://uat.trip-planner-dby.pages.dev';
    const env = mockEnv(db, { ENVIRONMENT: 'preview', SESSION_SECRET: 'mobile-test-secret' });
    const uid = 'mobile-flow-user';
    await db.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)').bind(uid, 'mobile-flow@example.com').run();
    const session = await signSessionToken(uid, env.SESSION_SECRET!);
    const cookie = `tripline_session=${session}`;
    const verifier = 'mobile-pkce-verifier-'.repeat(3);
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const challenge = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const params = new URLSearchParams({ response_type: 'code', client_id: 'tripline-mobile-uat',
      redirect_uri: MOBILE_UAT_REDIRECT, scope: 'profile', state: 'state-preserved',
      code_challenge: challenge, code_challenge_method: 'S256' });
    const authorizeRequest = () => new Request(`${origin}/api/oauth/authorize?${params}`, { headers: { Cookie: cookie } });
    const first = await authorize(mockContext({ request: authorizeRequest(), env }) as never);
    expect(first.headers.get('Location')).toMatch(/^\/oauth\/consent\?/);
    const approved = await consent(mockContext({ request: new Request(`${origin}/api/oauth/consent`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...Object.fromEntries(params), decision: 'allow' }),
    }), env }) as never);
    expect(approved.status).toBe(302);
    const issued = await authorize(mockContext({ request: authorizeRequest(), env }) as never);
    const callback = new URL(issued.headers.get('Location')!);
    expect(callback.origin + callback.pathname).toBe(MOBILE_UAT_REDIRECT);
    expect(callback.searchParams.get('state')).toBe('state-preserved');
    const code = callback.searchParams.get('code')!;
    const exchange = (codeVerifier: string) => token(mockContext({ request: new Request(`${origin}/api/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'tripline-mobile-uat',
        redirect_uri: MOBILE_UAT_REDIRECT, code, code_verifier: codeVerifier }),
    }), env }) as never);
    expect((await exchange('wrong-verifier')).status).toBe(400);
    const success = await exchange(verifier);
    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({ token_type: 'Bearer', scope: 'profile' });
    expect((await exchange(verifier)).status).toBe(400);
  });
});
