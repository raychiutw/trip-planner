/**
 * GET /api/oauth/callback/google?code=...&state=...
 *
 * V2-P1 OAuth flow completion — Google OIDC client callback。
 *
 * **DEPLOY NOTE (V2-P5 routing fix)**: Google Cloud Console redirect_uri
 * 需從舊路徑 `/api/oauth/callback` 改成 `/api/oauth/callback/google`。
 * 同時 Google client redirect URL 從 `/api/oauth/authorize?provider=google`
 * 改成 `/api/oauth/login/google`。
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
import { D1Adapter, type AdapterPayload } from '../../../../src/server/oauth-d1-adapter';
import { issueSession } from '../../_session';
import { requireSessionUser } from '../../_session';
import { mobileOAuthContract } from '../../_mobileOAuth';
import { deleteReauthSessionId, grantDeleteReauth, readMobileDeleteChallenge, transitionMobileDeleteChallenge } from '../../account/_deleteReauth';
import { verifyGoogleIdToken } from '../../../../src/server/oauth-client/google-id-token';
import type { Env } from '../../_types';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface OAuthStatePayload extends AdapterPayload {
  provider: string;
  redirectAfterLogin: string;
  createdAt: number;
  reauth?: { uid: string; sessionId?: string; challengeId?: string; grantId?: string; clientId?: string };
}

function errorResponse(code: string, message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

/**
 * Recover from a concurrent first-time-login race: two requests for the same
 * Google `sub` both miss the initial SELECT and race to INSERT auth_identities,
 * one losing on the UNIQUE(provider, provider_user_id) constraint. On a
 * UNIQUE/constraint error, re-run the identity lookup to adopt the winner's
 * user_id (mirrors signup.ts's `includes('UNIQUE')` guard). Non-UNIQUE failures
 * — and a UNIQUE error with no recoverable row — re-throw so genuine DB errors
 * still surface as 500 rather than being masked.
 */
async function recoverIdentityRace(db: D1Database, sub: string, err: unknown): Promise<string> {
  const msg = (err as Error)?.message ?? '';
  const upper = msg.toUpperCase();
  if (!upper.includes('UNIQUE') && !upper.includes('CONSTRAINT')) {
    throw err;
  }
  const winner = await db
    .prepare('SELECT user_id FROM auth_identities WHERE provider = ? AND provider_user_id = ?')
    .bind('google', sub)
    .first<{ user_id: string }>();
  if (!winner) {
    throw err;
  }
  return winner.user_id;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const providerError = url.searchParams.get('error');

  if (!state) {
    return errorResponse('OAUTH_MISSING_PARAMS', '缺少 code 或 state');
  }

  // 1. Validate state (CSRF + replay guard)
  const stateAdapter = new D1Adapter(context.env.DB, 'OAuthState');
  const stateRow = (await stateAdapter.find(state)) as OAuthStatePayload | undefined;
  if (!stateRow) {
    return errorResponse('OAUTH_INVALID_STATE', 'state 過期或已使用 — 請重新登入');
  }
  await stateAdapter.destroy(state); // one-time use

  const reauthFailure = async (message: string, status = 403): Promise<Response> => {
    const reauth = stateRow.reauth;
    if (reauth?.challengeId && reauth.grantId && reauth.clientId === mobileOAuthContract(context.env, context.request)?.clientId) {
      await transitionMobileDeleteChallenge(context.env.DB, reauth.challengeId, reauth.uid, reauth.grantId, 'started', 'failed');
      const redirect = new URL(stateRow.redirectAfterLogin);
      redirect.searchParams.set('challenge_id', reauth.challengeId);
      redirect.searchParams.set('status', 'failed');
      return Response.redirect(redirect, 302);
    }
    return errorResponse('ACCOUNT_DELETE_REAUTH_REQUIRED', message, status);
  };

  if (providerError) return stateRow.reauth ? reauthFailure('Google 驗證未完成') : errorResponse('OAUTH_PROVIDER_DENIED', 'Google 驗證未完成');
  if (!code) return stateRow.reauth ? reauthFailure('缺少授權碼') : errorResponse('OAUTH_MISSING_PARAMS', '缺少 code 或 state');

  // 2. Validate env
  const clientId = context.env.GOOGLE_CLIENT_ID;
  const clientSecret = context.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorResponse('OAUTH_NOT_CONFIGURED', 'Google OAuth secrets 未設定', 503);
  }

  // 3. Token exchange with Google
  const callbackUri = `${url.origin}/api/oauth/callback/google`;
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
    if (stateRow.reauth) return reauthFailure('Google 驗證失敗', 502);
    return errorResponse('OAUTH_TOKEN_EXCHANGE_FAILED', `Google token exchange ${tokenRes.status}: ${errText.slice(0, 200)}`, 502);
  }

  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;

  // 4. Verify id_token signature + claims (signed by Google JWKS, aud=our client_id,
  //    iss=accounts.google.com, exp not passed). Throws on any mismatch — defends
  //    against token-substitution and account-takeover via attacker-controlled sub/email.
  let claims;
  try {
    claims = await verifyGoogleIdToken(tokenJson.id_token, clientId);
  } catch (err) {
    if (stateRow.reauth) return reauthFailure('Google 憑證無效', 401);
    return errorResponse(
      'OAUTH_INVALID_ID_TOKEN',
      `id_token 驗證失敗: ${(err as Error).message}`,
      401,
    );
  }
  const sub = claims.sub;
  const email = typeof claims.email === 'string' ? claims.email : '';
  const email_verified = claims.email_verified === true;
  const name = typeof claims.name === 'string' ? claims.name : undefined;
  const picture = typeof claims.picture === 'string' ? claims.picture : undefined;
  if (!sub || !email) {
    if (stateRow.reauth) return reauthFailure('Google 憑證缺少身分資訊');
    return errorResponse('OAUTH_INVALID_ID_TOKEN', 'id_token 缺 sub/email claim');
  }
  if (stateRow.reauth) {
    const authTime = claims['auth_time'];
    if (typeof authTime !== 'number' || !Number.isFinite(authTime) ||
        authTime * 1000 < stateRow.createdAt - 5000 || authTime * 1000 > Date.now() + 5000 ||
        Date.now() - authTime * 1000 > 5 * 60 * 1000) {
      return reauthFailure('請重新驗證身分');
    }
    const identity = await context.env.DB.prepare('SELECT user_id FROM auth_identities WHERE provider = ? AND provider_user_id = ?')
      .bind('google', sub).first<{ user_id: string }>();
    if (identity?.user_id !== stateRow.reauth.uid) return reauthFailure('驗證帳號不符');
    if (stateRow.reauth.challengeId && stateRow.reauth.grantId && stateRow.reauth.clientId === mobileOAuthContract(context.env, context.request)?.clientId) {
      const challenge = await readMobileDeleteChallenge(context.env.DB, stateRow.reauth.challengeId);
      if (!challenge || challenge.uid !== identity.user_id || challenge.grantId !== stateRow.reauth.grantId ||
          challenge.clientId !== stateRow.reauth.clientId || challenge.expired ||
          !(await transitionMobileDeleteChallenge(context.env.DB, stateRow.reauth.challengeId, identity.user_id,
            challenge.grantId, 'started', 'verified'))) {
        return reauthFailure('請重新驗證身分');
      }
      const mobileRedirect = new URL(stateRow.redirectAfterLogin);
      mobileRedirect.searchParams.set('challenge_id', stateRow.reauth.challengeId);
      mobileRedirect.searchParams.set('status', 'verified');
      return Response.redirect(mobileRedirect, 302);
    }
    const current = await requireSessionUser(context.request, context.env).catch(() => null);
    const sessionId = await deleteReauthSessionId(context.request);
    if (!current || current.uid !== stateRow.reauth.uid || !sessionId || sessionId !== stateRow.reauth.sessionId ||
        !(await grantDeleteReauth(context.env.DB, context.request, current.uid))) {
      return errorResponse('ACCOUNT_DELETE_REAUTH_REQUIRED', '請重新驗證身分', 403);
    }
    return Response.redirect(new URL(stateRow.redirectAfterLogin, url.origin), 302);
  }
  const now = new Date().toISOString();

  // 5. Lookup or create auth_identities + users
  // v2.33.98 security: email merge — 之前若 user 先用 local password signup 同 email，
  // 再用 Google login 走 else 分支 INSERT INTO users 撞 UNIQUE constraint → 500
  // 也阻擋了合法 user 用兩個 provider。改：先 SELECT users by email 看是否存在，
  // 若存在 + email_verified_at 已設 → link new auth_identity 到 existing user，
  // 若存在但 unverified → reject (防 squat) 要求走 password reset 或 verify 路徑。
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
    // v2.33.98 security: new account creation 路徑強制 email_verified=true。
    // 防 attacker 用 alias email 註冊 Google account 預先 squat victim's email。
    if (!email_verified) {
      return errorResponse(
        'OAUTH_EMAIL_UNVERIFIED',
        'Google account email 未驗證，請先在 Google 完成 email 驗證後再登入',
        400,
      );
    }
    // 檢查 email 是否已被 local provider 佔用
    const existingUserByEmail = await context.env.DB
      .prepare('SELECT id, email_verified_at FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email_verified_at: string | null }>();

    if (existingUserByEmail) {
      // Email 已存在 — 若已驗證則 link Google identity；否則 reject 防 squat
      if (!existingUserByEmail.email_verified_at) {
        return errorResponse(
          'OAUTH_EMAIL_CONFLICT',
          '此 email 已註冊但未驗證 — 請先用密碼登入並完成 email 驗證，再合併 Google 登入',
          409,
        );
      }
      userId = existingUserByEmail.id;
      try {
        await context.env.DB
          .prepare(
            'INSERT INTO auth_identities (user_id, provider, provider_user_id, last_used_at) VALUES (?, ?, ?, ?)',
          )
          .bind(userId, 'google', sub, now)
          .run();
      } catch (err) {
        userId = await recoverIdentityRace(context.env.DB, sub, err);
      }
    } else {
      userId = crypto.randomUUID();
      try {
        await context.env.DB
          .prepare(
            'INSERT INTO users (id, email, email_verified_at, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(userId, email, now, name ?? null, picture ?? null)
          .run();
        await context.env.DB
          .prepare(
            'INSERT INTO auth_identities (user_id, provider, provider_user_id, last_used_at) VALUES (?, ?, ?, ?)',
          )
          .bind(userId, 'google', sub, now)
          .run();
      } catch (err) {
        userId = await recoverIdentityRace(context.env.DB, sub, err);
      }
    }
  }

  // 6. Issue session + redirect
  const response = new Response(null, {
    status: 302,
    headers: { Location: stateRow.redirectAfterLogin || '/manage' },
  });
  await issueSession(context.request, response, userId, context.env);
  return response;
};
