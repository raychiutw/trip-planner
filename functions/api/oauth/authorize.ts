/**
 * GET /api/oauth/authorize?provider=google&redirect_after_login=/manage
 *
 * V2-P1 OAuth flow start — Google OIDC client redirect。
 *
 * Flow:
 *   1. Validate provider=google (其他暫不支援)
 *   2. Validate GOOGLE_CLIENT_ID env (503 if missing)
 *   3. Generate cryptographically random `state` (32 bytes base64url)
 *   4. Store state in D1 oauth_models name='OAuthState' with redirect_after_login
 *      + 5min TTL (CSRF protection — callback 收到 code 時 validate state matches)
 *   5. Build Google authorize URL (response_type=code + PKCE later)
 *   6. 302 redirect
 *
 * Callback handler (functions/api/oauth/callback.ts) — V2-P1 next slice。
 *
 * 安全性備註：
 *   - state 是 CSRF token + 1-time replay guard（D1 destroy on consume in callback）
 *   - 沒 PKCE 因 client_secret 在 server side（Google OIDC for confidential client OK）
 *     V2-P5 加 PKCE for public clients（mobile / SPA flow）
 *   - redirect_after_login 限制 same-origin 路徑（不允許 absolute URL，防 open redirect）
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import type { Env } from '../_types';

const STATE_TTL_SEC = 5 * 60; // 5 minutes — user 通常 OAuth flow < 30s
const SAFE_REDIRECT_DEFAULT = '/manage';

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 限制 redirect_after_login 為 same-origin 路徑（防 open redirect attack） */
function sanitizeRedirect(value: string | null): string {
  if (!value) return SAFE_REDIRECT_DEFAULT;
  // 必須以 / 開頭且不以 // 開頭（後者是 protocol-relative，會跳出去）
  if (!value.startsWith('/') || value.startsWith('//')) return SAFE_REDIRECT_DEFAULT;
  return value;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const provider = url.searchParams.get('provider');
  if (provider !== 'google') {
    return new Response(
      JSON.stringify({ error: { code: 'PROVIDER_UNSUPPORTED', message: '只支援 provider=google（V2-P1）' } }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const clientId = context.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new Response(
      JSON.stringify({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'GOOGLE_CLIENT_ID 未設定 — 需 ops 在 Cloudflare secrets 加入' } }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const state = generateState();
  const redirectAfterLogin = sanitizeRedirect(url.searchParams.get('redirect_after_login'));

  // Store state in D1 (CSRF protection + replay guard via consume on callback)
  const adapter = new D1Adapter(context.env.DB, 'OAuthState');
  await adapter.upsert(
    state,
    { provider: 'google', redirectAfterLogin, createdAt: Date.now() },
    STATE_TTL_SEC,
  );

  // Build Google OIDC authorize URL
  const callbackUri = `${url.origin}/api/oauth/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUri,
    scope: 'openid profile email',
    state,
    access_type: 'offline', // 取 refresh_token (V2-P5 用)
    prompt: 'consent',      // 強制 consent screen 確保拿 refresh_token
  });
  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return Response.redirect(authorizeUrl, 302);
};
