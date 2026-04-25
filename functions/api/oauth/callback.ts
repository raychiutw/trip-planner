/**
 * GET /api/oauth/callback?code=...&state=...
 *
 * V2-P1 OAuth flow completion — Google OIDC client callback。
 *
 * Flow:
 *   1. Validate state (D1 oauth_models name='OAuthState' lookup + destroy on use)
 *   2. POST https://oauth2.googleapis.com/token { code, client_id, client_secret, redirect_uri, grant_type: 'authorization_code' }
 *      → { access_token, id_token, refresh_token? }
 *   3. Decode id_token (parse JWT payload — no signature verify, trust HTTPS to Google)
 *   4. Look up auth_identities by (provider='google', provider_user_id=sub)
 *      a. If found: update last_used_at
 *      b. If not: create user + auth_identities row
 *   5. issueSession(uid)
 *   6. 302 redirect to state.redirectAfterLogin
 */
import { D1Adapter, type AdapterPayload } from '../../../src/server/oauth-d1-adapter';
import { issueSession } from '../_session';
import type { Env } from '../_types';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface GoogleIdTokenPayload {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

interface OAuthStatePayload extends AdapterPayload {
  provider: string;
  redirectAfterLogin: string;
  createdAt: number;
}

function errorResponse(code: string, message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

/** Decode JWT payload (base64url middle part). 不驗 signature — trust Google HTTPS endpoint。 */
function decodeJwtPayload(idToken: string): GoogleIdTokenPayload | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  const payloadB64 = parts[1];
  if (!payloadB64) return null;
  try {
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (payloadB64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as GoogleIdTokenPayload;
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return errorResponse('OAUTH_MISSING_PARAMS', '缺少 code 或 state');
  }

  // 1. Validate state (CSRF + replay guard)
  const stateAdapter = new D1Adapter(context.env.DB, 'OAuthState');
  const stateRow = (await stateAdapter.find(state)) as OAuthStatePayload | undefined;
  if (!stateRow) {
    return errorResponse('OAUTH_INVALID_STATE', 'state 過期或已使用 — 請重新登入');
  }
  await stateAdapter.destroy(state); // one-time use

  // 2. Validate env
  const clientId = context.env.GOOGLE_CLIENT_ID;
  const clientSecret = context.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorResponse('OAUTH_NOT_CONFIGURED', 'Google OAuth secrets 未設定', 503);
  }

  // 3. Token exchange with Google
  const callbackUri = `${url.origin}/api/oauth/callback`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return errorResponse('OAUTH_TOKEN_EXCHANGE_FAILED', `Google token exchange ${tokenRes.status}: ${errText.slice(0, 200)}`, 502);
  }

  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;

  // 4. Parse id_token
  const idPayload = decodeJwtPayload(tokenJson.id_token);
  if (!idPayload || !idPayload.sub || !idPayload.email) {
    return errorResponse('OAUTH_INVALID_ID_TOKEN', 'id_token 解析失敗或缺 sub/email');
  }

  const { sub, email, email_verified, name, picture } = idPayload;
  const now = new Date().toISOString();

  // 5. Lookup or create auth_identities + users
  const existing = await context.env.DB
    .prepare('SELECT user_id FROM auth_identities WHERE provider = ? AND provider_user_id = ?')
    .bind('google', sub)
    .first<{ user_id: string }>();

  let userId: string;
  if (existing) {
    userId = existing.user_id;
    await context.env.DB
      .prepare('UPDATE auth_identities SET last_used_at = ? WHERE provider = ? AND provider_user_id = ?')
      .bind(now, 'google', sub)
      .run();
  } else {
    userId = crypto.randomUUID();
    await context.env.DB
      .prepare(
        'INSERT INTO users (id, email, email_verified_at, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(userId, email, email_verified ? now : null, name ?? null, picture ?? null)
      .run();
    await context.env.DB
      .prepare(
        'INSERT INTO auth_identities (user_id, provider, provider_user_id, last_used_at) VALUES (?, ?, ?, ?)',
      )
      .bind(userId, 'google', sub, now)
      .run();
  }

  // 6. Issue session + redirect
  const response = new Response(null, {
    status: 302,
    headers: { Location: stateRow.redirectAfterLogin || '/manage' },
  });
  await issueSession(context.request, response, userId, context.env);
  return response;
};
