/**
 * POST /api/oauth/token
 *
 * V2-P4 — OAuth Server token endpoint。Exchange authorization_code for
 * access_token + refresh_token。
 *
 * RFC 6749 §4.1.3 + RFC 7636 PKCE。
 *
 * Body (form-urlencoded):
 *   grant_type=authorization_code
 *   code=<code>
 *   redirect_uri=<must match authorize step>
 *   client_id=<client_id>
 *   client_secret=<for confidential clients> (or HTTP Basic auth)
 *   code_verifier=<PKCE — required if code_challenge was present at authorize>
 *
 * Issues opaque access + refresh tokens (random bytes stored in D1) plus an
 * RS256-signed JWT id_token when the request scope includes `openid`.
 *
 * Response (JSON):
 *   { access_token, refresh_token, token_type: 'Bearer', expires_in, scope }
 */
import { D1Adapter, type AdapterPayload } from '../../../src/server/oauth-d1-adapter';
import { verifyPassword } from '../../../src/server/password';
import { issueIdToken } from './_id_token';
import {
  checkRateLimit,
  bumpRateLimit,
  clientIp,
  RATE_LIMITS,
} from '../_rate_limit';
import { recordAuthEvent } from '../_auth_audit';
import { generateOpaqueToken, parseFormOrJson, parseBasicAuth } from '../_utils';
import { oauthErrorResponse, buildRateLimitResponse } from '../_errors';
import type { Env } from '../_types';

import { ACCESS_TOKEN_TTL_SEC, exchangeAuthorizationCode, issueTokenPair } from './_tokenLifecycle';

interface RefreshTokenPayload extends AdapterPayload {
  client_id: string;
  user_id: string;
  scopes: string[];
  grantId: string;
  /** Set on rotation (consume) — re-use attempts after this is set trigger family revoke */
  consumed?: number;
}

interface ClientAppRow {
  client_id: string;
  client_type: 'public' | 'confidential';
  client_secret_hash: string | null;
  status: string;
  allowed_scopes: string;
}

// oauthErrorResponse() helper 已抽到 _errors.ts oauthErrorResponse — RFC 6749 §5.2 flat
// shape 給 OAuth wire endpoint 用。

function tokenResponse(
  tokens: { access_token: string; refresh_token: string },
  scopes: string[],
  idToken: string | null,
): Response {
  const body: Record<string, unknown> = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SEC,
    scope: scopes.join(' '),
  };
  if (idToken) body.id_token = idToken;
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'pragma': 'no-cache',
    },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await parseFormOrJson<Record<string, string>>(context.request);
  const grant_type = body.grant_type;

  if (
    grant_type !== 'authorization_code' &&
    grant_type !== 'refresh_token' &&
    grant_type !== 'client_credentials'
  ) {
    return oauthErrorResponse(
      'unsupported_grant_type',
      'Supported: authorization_code, refresh_token, client_credentials',
    );
  }

  // Client auth: HTTP Basic OR body fields (shared by both grant types)
  const basic = parseBasicAuth(context.request);
  const clientId = basic?.id ?? body.client_id;
  const clientSecret = basic?.secret ?? body.client_secret;

  if (!clientId) {
    return oauthErrorResponse('invalid_client', 'Missing client_id');
  }

  // v2.33.103 SEC-7: per-IP rate-limit 在 client lookup + PBKDF2 verify 前。
  // Confidential client_secret 驗證走 PBKDF2 (100k iter ~50ms CPU)。Attacker
  // 反覆送 wrong secret，per-client_id bucket 擋在 100/min 但前 100 個已經燒
  // ~5s CPU。加 per-IP 50/min cap 提前擋掉。Bump 在 checkRateLimit pass 後即發，
  // 不依賴後續 client 存在與否（任何 POST 都計入 IP quota）。
  const ipKey = `oauth-token:ip:${clientIp(context.request)}`;
  const ipCheck = await checkRateLimit(context.env.DB, ipKey, RATE_LIMITS.OAUTH_TOKEN_PER_IP);
  if (!ipCheck.ok) {
    return buildRateLimitResponse(ipCheck.retryAfter ?? 60, {
      error: 'rate_limited',
      error_description: 'Too many token requests from this IP',
    });
  }
  await bumpRateLimit(context.env.DB, ipKey, RATE_LIMITS.OAUTH_TOKEN_PER_IP);

  // v2.33.101 CR-9: 先 SELECT client_apps 確認 client_id 存在再 rate-limit bump。
  // 之前 unbounded write amplification — attacker POST 任意 client_id 字串都會
  // INSERT rate_limit_buckets row（D1 寫不停）。改：unknown client → 直接
  // invalid_client 不 bump。
  const client = await context.env.DB
    .prepare(
      `SELECT client_id, client_type, client_secret_hash, status, allowed_scopes
       FROM client_apps WHERE client_id = ?`,
    )
    .bind(clientId)
    .first<ClientAppRow>();

  if (!client || client.status !== 'active') {
    return oauthErrorResponse('invalid_client', 'Unknown or inactive client_id', 401);
  }

  // V2-P6 rate limit: per-client_id bucket — throughput cap
  // Preset: 100 attempts / minute, 5min lockout (per RATE_LIMITS.OAUTH_TOKEN)
  // Bump regardless of grant_type / outcome — total per-minute throughput cap
  const tokenKey = `oauth-token:${clientId}`;
  const tokenCheck = await checkRateLimit(context.env.DB, tokenKey, RATE_LIMITS.OAUTH_TOKEN);
  if (!tokenCheck.ok) {
    return buildRateLimitResponse(tokenCheck.retryAfter ?? 60, {
      error: 'rate_limited',
      error_description: 'Too many token requests for this client',
    });
  }
  await bumpRateLimit(context.env.DB, tokenKey, RATE_LIMITS.OAUTH_TOKEN);

  // Confidential client: verify client_secret (both grant types)
  if (client.client_type === 'confidential') {
    if (!clientSecret || !client.client_secret_hash) {
      return oauthErrorResponse('invalid_client', 'client_secret required for confidential client', 401);
    }
    const ok = await verifyPassword(clientSecret, client.client_secret_hash);
    if (!ok) return oauthErrorResponse('invalid_client', 'Invalid client_secret', 401);
  }

  // Branch on grant_type — client_credentials first (RFC 6749 §4.4)
  if (grant_type === 'client_credentials') {
    // Per RFC 6749 §4.4: only confidential clients can use client_credentials.
    // Public clients have no secret to authenticate with → would be unauthenticated
    // service-to-service call, which violates the grant's purpose.
    if (client.client_type !== 'confidential') {
      return oauthErrorResponse(
        'unauthorized_client',
        'client_credentials grant requires a confidential client',
        401,
      );
    }

    // Validate requested scopes are subset of client.allowed_scopes (default: all
    // allowed scopes if request omits scope param).
    const requestedScopes = (body.scope ?? '').split(/\s+/).filter(Boolean);
    let allowedScopes: string[] = [];
    try {
      const parsed: unknown = JSON.parse(client.allowed_scopes ?? '[]');
      if (Array.isArray(parsed)) {
        allowedScopes = parsed.filter((s): s is string => typeof s === 'string');
      }
    } catch {
      /* allowed_scopes corrupt → treat as empty allow-list (deny) */
    }
    const finalScopes = requestedScopes.length === 0 ? allowedScopes : requestedScopes;
    const invalid = finalScopes.filter((s) => !allowedScopes.includes(s));
    if (invalid.length > 0) {
      return oauthErrorResponse(
        'invalid_scope',
        `Scope not permitted for this client: ${invalid.join(', ')}`,
      );
    }

    // Issue access_token only — no refresh_token (RFC 6749 §4.4.3).
    // Service can re-authenticate with credentials when access_token expires.
    const accessToken = generateOpaqueToken(48);
    const grantId = crypto.randomUUID();
    const accessAdapter = new D1Adapter(context.env.DB, 'AccessToken');
    await accessAdapter.upsert(
      accessToken,
      {
        client_id: clientId,
        user_id: null, // client_credentials has no user
        scopes: finalScopes,
        grantId,
      },
      ACCESS_TOKEN_TTL_SEC,
    );

    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'token_issue',
      outcome: 'success',
      userId: null,
      clientId,
      metadata: { grant_type: 'client_credentials', scopes: finalScopes },
    }, context.env);

    return new Response(
      JSON.stringify({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SEC,
        scope: finalScopes.join(' '),
      }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'pragma': 'no-cache',
        },
      },
    );
  }

  if (grant_type === 'refresh_token') {
    const refreshTokenInput = body.refresh_token;
    if (!refreshTokenInput) {
      return oauthErrorResponse('invalid_request', 'Missing refresh_token');
    }

    const refreshAdapter = new D1Adapter(context.env.DB, 'RefreshToken');
    const refreshRow = (await refreshAdapter.find(refreshTokenInput)) as RefreshTokenPayload | undefined;

    if (!refreshRow) {
      return oauthErrorResponse('invalid_grant', 'refresh_token expired or invalid');
    }

    // v2.33.97 security: client_id 不對 → reject 不 cascade。否則 leaked-once
    // refresh_token 被任意 registered client B 提交即觸發 victim grantId family
    // revoke = permanent DoS handle on victim。先驗 client_id 再驗 consumed。
    if (refreshRow.client_id !== clientId) {
      return oauthErrorResponse('invalid_grant', 'refresh_token does not belong to this client');
    }

    // Reuse detection (RFC 6749 §10.4 / OAuth 2.1 §6.1): if this row was already
    // consumed by a prior rotation, the refresh token has been replayed →
    // attacker likely has a stolen token. Cascade-revoke the entire family.
    if (refreshRow.consumed) {
      await new D1Adapter(context.env.DB, 'AccessToken').revokeByGrantId(refreshRow.grantId);
      await new D1Adapter(context.env.DB, 'RefreshToken').revokeByGrantId(refreshRow.grantId);
      await recordAuthEvent(context.env.DB, context.request, {
        eventType: 'token_revoke',
        outcome: 'failure',
        userId: refreshRow.user_id,
        clientId,
        failureReason: 'refresh_token_reuse',
        metadata: { grantId: refreshRow.grantId },
      }, context.env);
      return oauthErrorResponse('invalid_grant', 'refresh_token reuse detected — token family revoked');
    }

    // Optional scope downgrade: caller can request narrower scope
    const requestedScopes = (body.scope ?? '').split(/\s+/).filter(Boolean);
    let finalScopes = refreshRow.scopes;
    if (requestedScopes.length > 0) {
      const invalid = requestedScopes.filter((s) => !refreshRow.scopes.includes(s));
      if (invalid.length > 0) {
        return oauthErrorResponse('invalid_scope', `Cannot widen scope: ${invalid.join(', ')}`);
      }
      finalScopes = requestedScopes;
    }

    // v2.33.58 round 12 C4: 改 atomic CAS consume — 之前先 issue 再 consume，平行
    // POST /token 兩個都過 .consumed 檢查、都 issue、都 consume，refresh family
    // 分裂。現在先 atomic consume(returns boolean)，輸的 caller 收到 false 就 abort
    // + revoke family (race lost = 雙重 rotation 試圖)。
    const won = await refreshAdapter.consume(refreshTokenInput);
    if (!won) {
      // Race lost — 另一個 caller 同時 rotation 已贏走，cascade revoke 保護
      await new D1Adapter(context.env.DB, 'AccessToken').revokeByGrantId(refreshRow.grantId);
      await new D1Adapter(context.env.DB, 'RefreshToken').revokeByGrantId(refreshRow.grantId);
      await recordAuthEvent(context.env.DB, context.request, {
        eventType: 'token_revoke',
        outcome: 'failure',
        userId: refreshRow.user_id,
        clientId,
        failureReason: 'refresh_token_concurrent_rotation',
        metadata: { grantId: refreshRow.grantId },
      }, context.env);
      return oauthErrorResponse('invalid_grant', 'refresh_token concurrent rotation detected — token family revoked');
    }
    const tokens = await issueTokenPair(
      context.env.DB,
      clientId,
      refreshRow.user_id,
      finalScopes,
      { model: 'RefreshToken', id: refreshTokenInput, grantId: refreshRow.grantId },
    );
    if (!tokens) return oauthErrorResponse('invalid_grant', 'refresh_token no longer available');
    let idToken: string | null = null;
    try {
      idToken = await issueIdToken(context.env, context.request, clientId, refreshRow.user_id, finalScopes);
    } catch {
      // 'openid' scope but no signing key configured → fall through
    }
    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'token_issue',
      outcome: 'success',
      userId: refreshRow.user_id,
      clientId,
      metadata: { grant_type: 'refresh_token', scopes: finalScopes },
    }, context.env);
    return tokenResponse(tokens, finalScopes, idToken);
  }

  const result = await exchangeAuthorizationCode(context.env, context.request, clientId, body);
  if (!result.ok) return oauthErrorResponse(result.error, result.description);
  let idToken: string | null = null;
  try {
    idToken = await issueIdToken(context.env, context.request, clientId, result.userId, result.scopes);
  } catch {
    // Preserve optional OIDC signing: a missing key does not fail opaque issuance.
  }
  return tokenResponse(result.tokens, result.scopes, idToken);
};
