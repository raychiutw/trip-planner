/**
 * GET /api/oauth/login/google?redirect_after_login=/manage
 *
 * V2-P1 OAuth flow start — Google OIDC client redirect。
 *
 * Flow:
 *   1. Validate GOOGLE_CLIENT_ID env (503 if missing)
 *   2. Generate cryptographically random `state` (32 bytes base64url)
 *   3. Store state in D1 oauth_models name='OAuthState' with redirect_after_login
 *      + 5min TTL (CSRF protection — callback 收到 code 時 validate state matches)
 *   4. Build Google authorize URL (response_type=code + PKCE later)
 *   5. 302 redirect
 *
 * V2-P5 routing fix: 從 `/api/oauth/authorize?provider=google` 搬到
 * `/api/oauth/login/google` — 解放 `/authorize` 給 OAuth Server。
 *
 * Callback handler (functions/api/oauth/callback/google.ts)。
 *
 * 安全性備註：
 *   - state 是 CSRF token + 1-time replay guard（D1 destroy on consume in callback）
 *   - 沒 PKCE 因 client_secret 在 server side（Google OIDC for confidential client OK）
 *     V2-P5 加 PKCE for public clients（mobile / SPA flow）
 *   - redirect_after_login 限制 same-origin 路徑（不允許 absolute URL，防 open redirect）
 */
import { D1Adapter } from '../../../../src/server/oauth-d1-adapter';
import { generateOpaqueToken } from '../../_utils';
import { requireSessionUser } from '../../_session';
import { mobileOAuthContract } from '../../_mobileOAuth';
import { deleteReauthSessionId, mobileCallbackUrl, readMobileDeleteChallenge, transitionMobileDeleteChallenge } from '../../account/_deleteReauth';
import type { Env } from '../../_types';

const STATE_TTL_SEC = 5 * 60; // 5 minutes — user 通常 OAuth flow < 30s
const SAFE_REDIRECT_DEFAULT = '/manage';

/** 限制 redirect_after_login 為 same-origin 路徑（防 open redirect attack） */
function sanitizeRedirect(value: string | null): string {
  if (!value) return SAFE_REDIRECT_DEFAULT;
  // 必須以 / 開頭且不以 // 開頭（後者是 protocol-relative，會跳出去）
  if (!value.startsWith('/') || value.startsWith('//')) return SAFE_REDIRECT_DEFAULT;
  return value;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  const clientId = context.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new Response(
      JSON.stringify({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'GOOGLE_CLIENT_ID 未設定 — 需 ops 在 Cloudflare secrets 加入' } }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const state = generateOpaqueToken();
  const deleteReauth = url.searchParams.get('purpose') === 'account-delete';
  let reauth: { uid: string; sessionId?: string; challengeId?: string; grantId?: string; clientId?: string } | undefined;
  let redirectAfterLogin = sanitizeRedirect(url.searchParams.get('redirect_after_login'));
  if (deleteReauth) {
    const challengeId = url.searchParams.get('challenge');
    if (challengeId) {
      const challenge = await readMobileDeleteChallenge(context.env.DB, challengeId);
      const contract = mobileOAuthContract(context.env, context.request);
      if (!challenge || !contract || challenge.expired || challenge.status !== 'pending' || challenge.clientId !== contract.clientId ||
          !(await transitionMobileDeleteChallenge(context.env.DB, challengeId, challenge.uid, challenge.grantId, 'pending', 'started'))) {
        return new Response(JSON.stringify({ error: { code: 'ACCOUNT_DELETE_REAUTH_REQUIRED' } }), { status: 403, headers: { 'content-type': 'application/json' } });
      }
      reauth = { uid: challenge.uid, challengeId, grantId: challenge.grantId, clientId: challenge.clientId };
      redirectAfterLogin = mobileCallbackUrl(context.env).toString();
    } else {
      const session = await requireSessionUser(context.request, context.env);
      const sessionId = await deleteReauthSessionId(context.request);
      const identity = await context.env.DB.prepare("SELECT 1 FROM auth_identities WHERE user_id = ? AND provider = 'google'")
        .bind(session.uid).first();
      if (!sessionId || !identity) return new Response(JSON.stringify({ error: { code: 'ACCOUNT_DELETE_REAUTH_UNAVAILABLE' } }), { status: 400, headers: { 'content-type': 'application/json' } });
      reauth = { uid: session.uid, sessionId };
      redirectAfterLogin = '/account?deleteReauth=done';
    }
  }

  // Store state in D1 (CSRF protection + replay guard via consume on callback)
  const adapter = new D1Adapter(context.env.DB, 'OAuthState');
  await adapter.upsert(
    state,
    { provider: 'google', redirectAfterLogin, createdAt: Date.now(), ...(reauth ? { reauth } : {}) },
    STATE_TTL_SEC,
  );

  // Build Google OIDC authorize URL
  const callbackUri = `${url.origin}/api/oauth/callback/google`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUri,
    scope: 'openid profile email',
    state,
    access_type: 'offline', // 取 refresh_token (V2-P5 用)
    prompt: deleteReauth ? 'select_account' : 'consent',
  });
  if (deleteReauth) {
    params.set('max_age', '0');
    params.set('claims', JSON.stringify({ id_token: { auth_time: { essential: true } } }));
  }
  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return Response.redirect(authorizeUrl, 302);
};
