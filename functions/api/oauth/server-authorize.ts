/**
 * GET /api/oauth/server-authorize
 *
 * V2-P4 — OAuth Server `/authorize` endpoint。Tripline as Authorization Server
 * 接收 external client 的 authorize request，驗 + 生成 authorization_code +
 * redirect 回 client redirect_uri (with code + state)。
 *
 * 跟 OAuth Client `/api/oauth/authorize` 不同（後者是 redirect to Google）。
 *
 * Flow:
 *   1. Parse query params (client_id / redirect_uri / response_type / scope /
 *      state / code_challenge / code_challenge_method / prompt)
 *   2. Lookup client_apps row by client_id
 *   3. validateAuthorizeRequest（pure validator from V2-P4 #280）
 *   4. If invalid:
 *      - redirectableToClient=false → 400 JSON
 *      - redirectableToClient=true → 302 redirect_uri?error=...&state=...
 *   5. Check user logged in (session cookie):
 *      - Not logged in → 302 /login?redirect_after=<this URL>
 *   6. (V2-P5 will add: consent screen render)
 *      - For V2-P4 starter: skip consent, auto-approve
 *   7. Generate authorization_code (32 bytes random) + store D1 oauth_models
 *      name='AuthorizationCode' { client_id, user_id, redirect_uri, scopes,
 *      code_challenge, code_challenge_method, used: false } + 10min TTL
 *   8. 302 redirect_uri?code=<code>&state=<state>
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import {
  validateAuthorizeRequest,
  type ClientAppRow,
} from '../../../src/server/oauth-server/validate-authorize-request';
import { getSessionUser } from '../_session';
import type { Env } from '../_types';

const CODE_TTL_SEC = 10 * 60; // RFC 6749 §4.1.2 recommends short

function generateAuthCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonError(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: code, error_description: message }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

function redirectError(
  redirectUri: string,
  errorCode: string,
  errorDescription: string,
  state: string | null,
): Response {
  const params = new URLSearchParams({ error: errorCode, error_description: errorDescription });
  if (state) params.set('state', state);
  return new Response(null, {
    status: 302,
    headers: { Location: `${redirectUri}?${params.toString()}` },
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const params = url.searchParams;

  const req = {
    response_type: params.get('response_type') ?? undefined,
    client_id: params.get('client_id') ?? undefined,
    redirect_uri: params.get('redirect_uri') ?? undefined,
    scope: params.get('scope') ?? undefined,
    state: params.get('state') ?? undefined,
    code_challenge: params.get('code_challenge') ?? undefined,
    code_challenge_method: params.get('code_challenge_method') ?? undefined,
    prompt: params.get('prompt') ?? undefined,
  };

  // Lookup client_apps row (if client_id provided)
  let client: ClientAppRow | null = null;
  if (req.client_id) {
    client = await context.env.DB
      .prepare(
        `SELECT client_id, client_type, app_name, redirect_uris, allowed_scopes, status
         FROM client_apps WHERE client_id = ?`,
      )
      .bind(req.client_id)
      .first<ClientAppRow>();
  }

  // Validate
  const result = validateAuthorizeRequest(req, client);
  if ('code' in result && 'redirectableToClient' in result) {
    if (result.redirectableToClient && req.redirect_uri) {
      return redirectError(req.redirect_uri, result.code, result.message, req.state ?? null);
    }
    return jsonError(result.code, result.message, 400);
  }

  // Check user logged in
  const session = await getSessionUser(context.request, context.env);
  if (!session) {
    // Preserve full request URL — login redirects back here on success
    const loginUrl = `/login?redirect_after=${encodeURIComponent(url.pathname + url.search)}`;
    return new Response(null, { status: 302, headers: { Location: loginUrl } });
  }

  // V2-P5: Consent check — lookup D1 Consent for (user_id, client_id)
  // 若無 consent 或 stored scopes 不含 requested scopes → redirect to /oauth/consent
  // prompt=consent 時强制 re-prompt（user 主動要重新確認）
  const consentAdapter = new D1Adapter(context.env.DB, 'Consent');
  const consentRow = (await consentAdapter.find(`${session.uid}:${result.client.client_id}`)) as
    | { user_id: string; client_id: string; scopes: string[]; grantedAt: number }
    | undefined;

  const needsConsent =
    result.prompt === 'consent' ||
    !consentRow ||
    !result.scopes.every((s) => consentRow.scopes.includes(s));

  if (needsConsent) {
    const consentParams = new URLSearchParams();
    consentParams.set('client_id', result.client.client_id);
    consentParams.set('redirect_uri', result.redirectUri);
    consentParams.set('response_type', 'code');
    consentParams.set('scope', result.scopes.join(' '));
    if (result.state) consentParams.set('state', result.state);
    if (result.codeChallenge) consentParams.set('code_challenge', result.codeChallenge);
    if (result.codeChallengeMethod) consentParams.set('code_challenge_method', result.codeChallengeMethod);
    return new Response(null, {
      status: 302,
      headers: { Location: `/oauth/consent?${consentParams.toString()}` },
    });
  }

  // Consent OK — generate authorization_code + store D1
  const code = generateAuthCode();
  const adapter = new D1Adapter(context.env.DB, 'AuthorizationCode');
  await adapter.upsert(
    code,
    {
      client_id: result.client.client_id,
      user_id: session.uid,
      redirect_uri: result.redirectUri,
      scopes: result.scopes,
      code_challenge: result.codeChallenge,
      code_challenge_method: result.codeChallengeMethod,
      used: false,
    },
    CODE_TTL_SEC,
  );

  // Redirect back to client with code + state
  const redirectParams = new URLSearchParams({ code });
  if (result.state) redirectParams.set('state', result.state);
  return new Response(null, {
    status: 302,
    headers: { Location: `${result.redirectUri}?${redirectParams.toString()}` },
  });
};
