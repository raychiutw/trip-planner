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

const ACCESS_TOKEN_TTL_SEC = 60 * 60;          // 1h
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60; // 30d

interface AuthorizationCodePayload extends AdapterPayload {
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scopes: string[];
  code_challenge: string | null;
  code_challenge_method: 'S256' | null;
  /** Set to grantId of the issued tokens after consume — enables RFC 6749 §10.5 cascade revoke on replay */
  grantId?: string;
}

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

/** Compute SHA-256 hash of code_verifier and base64url encode (per RFC 7636 §4.6). */
async function pkceTransform(verifier: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Issue access+refresh tokens. If `existingGrantId` is provided (rotation case),
 * the new pair inherits it so revokeByGrantId can cascade across the entire
 * token family — necessary for RFC 6749 §10.5 / OAuth 2.1 §6.1 reuse detection.
 */
async function issueTokenPair(
  db: Env['DB'],
  clientId: string,
  userId: string,
  scopes: string[],
  existingGrantId?: string,
): Promise<{ access_token: string; refresh_token: string; grantId: string }> {
  const grantId = existingGrantId ?? crypto.randomUUID();
  // 48 bytes (~64 char base64url) — RFC 6749 doesn't fix length but 32 bytes
  // ~256 bits of entropy is the de-facto minimum; bump to 48 for headroom.
  const accessToken = generateOpaqueToken(48);
  const refreshToken = generateOpaqueToken(48);

  const accessAdapter = new D1Adapter(db, 'AccessToken');
  await accessAdapter.upsert(
    accessToken,
    { client_id: clientId, user_id: userId, scopes, grantId },
    ACCESS_TOKEN_TTL_SEC,
  );

  const refreshAdapter = new D1Adapter(db, 'RefreshToken');
  await refreshAdapter.upsert(
    refreshToken,
    { client_id: clientId, user_id: userId, scopes, grantId },
    REFRESH_TOKEN_TTL_SEC,
  );

  return { access_token: accessToken, refresh_token: refreshToken, grantId };
}

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
  const ipBump = await bumpRateLimit(context.env.DB, ipKey, RATE_LIMITS.OAUTH_TOKEN_PER_IP);
  if (!ipBump.ok) {
    return buildRateLimitResponse(ipBump.retryAfter ?? 60, {
      error: 'rate_limited',
      error_description: 'Too many token requests from this IP',
    });
  }

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
  const tokenBump = await bumpRateLimit(context.env.DB, tokenKey, RATE_LIMITS.OAUTH_TOKEN);
  if (!tokenBump.ok) {
    return buildRateLimitResponse(tokenBump.retryAfter ?? 60, {
      error: 'rate_limited',
      error_description: 'Too many token requests for this client',
    });
  }

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
      refreshRow.grantId,
    );
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

  // grant_type === 'authorization_code'
  const code = body.code;
  if (!code) return oauthErrorResponse('invalid_request', 'Missing code');

  const codeAdapter = new D1Adapter(context.env.DB, 'AuthorizationCode');
  const codeRow = (await codeAdapter.find(code)) as AuthorizationCodePayload | undefined;

  if (!codeRow) {
    return oauthErrorResponse('invalid_grant', 'Authorization code expired or invalid');
  }
  // v2.33.97 security: client_id 不對 → reject 不 cascade。否則 leaked auth code
  // 被任意 registered client B 提交即觸發 victim grantId family revoke (DoS)。
  if (codeRow.client_id !== clientId) {
    return oauthErrorResponse('invalid_grant', 'code does not belong to this client');
  }
  if (codeRow.consumed) {
    // Replay attack — RFC 6749 §10.5: cascade-revoke all tokens issued from this grant
    if (codeRow.grantId) {
      await new D1Adapter(context.env.DB, 'AccessToken').revokeByGrantId(codeRow.grantId);
      await new D1Adapter(context.env.DB, 'RefreshToken').revokeByGrantId(codeRow.grantId);
    }
    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'token_issue',
      outcome: 'failure',
      userId: codeRow.user_id,
      clientId,
      failureReason: 'auth_code_replay',
      metadata: { grantId: codeRow.grantId ?? null, scopes: codeRow.scopes },
    }, context.env);
    return oauthErrorResponse('invalid_grant', 'Authorization code already used (replay detected — tokens revoked)');
  }
  if (codeRow.redirect_uri !== body.redirect_uri) {
    return oauthErrorResponse('invalid_grant', 'redirect_uri mismatch');
  }

  // PKCE verify (if code_challenge was present at authorize)
  if (codeRow.code_challenge) {
    if (!body.code_verifier) {
      return oauthErrorResponse('invalid_grant', 'code_verifier required (PKCE)');
    }
    const expectedChallenge = await pkceTransform(body.code_verifier);
    if (expectedChallenge !== codeRow.code_challenge) {
      return oauthErrorResponse('invalid_grant', 'code_verifier does not match code_challenge');
    }
  }

  // v2.33.58 round 12 C4: atomic CAS consume BEFORE issueTokenPair。
  // 之前 unconditional UPDATE，平行 2 個 POST /token 都過 consumed 檢查、都 issue、
  // 都 consume，產生 2 個獨立 grantId。改 conditional UPDATE 後輸的 caller 收到 false
  // 就 abort，避免 double-spend。
  const won = await codeAdapter.consume(code);
  if (!won) {
    // Race lost — 另一個 caller 平行 exchange 同 code，treat 同 replay
    await recordAuthEvent(context.env.DB, context.request, {
      eventType: 'token_issue',
      outcome: 'failure',
      userId: codeRow.user_id,
      clientId,
      failureReason: 'auth_code_concurrent_exchange',
      metadata: { scopes: codeRow.scopes },
    }, context.env);
    return oauthErrorResponse('invalid_grant', 'Authorization code concurrent exchange detected');
  }
  // Won the race — issue tokens + bind grantId for replay-revoke。
  const tokens = await issueTokenPair(context.env.DB, clientId, codeRow.user_id, codeRow.scopes);
  await context.env.DB
    .prepare('UPDATE oauth_models SET payload = json_set(payload, ?, ?) WHERE name = ? AND id = ?')
    .bind('$.grantId', tokens.grantId, 'AuthorizationCode', code)
    .run();
  let idToken: string | null = null;
  try {
    idToken = await issueIdToken(context.env, context.request, clientId, codeRow.user_id, codeRow.scopes);
  } catch {
    // 'openid' scope but no signing key configured → fall through
  }
  await recordAuthEvent(context.env.DB, context.request, {
    eventType: 'token_issue',
    outcome: 'success',
    userId: codeRow.user_id,
    clientId,
    metadata: { grant_type: 'authorization_code', scopes: codeRow.scopes },
  }, context.env);
  return tokenResponse(tokens, codeRow.scopes, idToken);
};
