/** One owner for grant validation, consumption and complete token issuance.
 * HTTP parsing/serialization and optional OIDC signing stay at the protocol entry.
 */
import { D1Adapter, type AdapterPayload } from '../../../src/server/oauth-d1-adapter';
import { generateOpaqueToken } from '../_utils';
import { recordAuthEvent } from '../_auth_audit';
import type { Env } from '../_types';

export const ACCESS_TOKEN_TTL_SEC = 60 * 60;
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;

export type TokenLifecycleResult =
  | { ok: true; tokens: { access_token: string; refresh_token: string }; userId: string; scopes: string[] }
  | { ok: false; error: 'invalid_request' | 'invalid_grant' | 'invalid_scope'; description: string };

function failure(error: 'invalid_request' | 'invalid_grant' | 'invalid_scope', description: string): TokenLifecycleResult {
  return { ok: false, error, description };
}

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
export async function issueTokenPair(
  db: Env['DB'],
  clientId: string,
  userId: string,
  scopes: string[],
  source: { model: 'AuthorizationCode' | 'RefreshToken'; id: string; grantId?: string },
): Promise<{ access_token: string; refresh_token: string; grantId: string } | null> {
  const grantId = source.grantId ?? crypto.randomUUID();
  // 48 bytes (~64 char base64url) — RFC 6749 doesn't fix length but 32 bytes
  // ~256 bits of entropy is the de-facto minimum; bump to 48 for headroom.
  const accessToken = generateOpaqueToken(48);
  const refreshToken = generateOpaqueToken(48);

  const stored = await new D1Adapter(db, source.model).storeIssuedPair(
    source.id,
    { client_id: clientId, user_id: userId, scopes, grantId },
    { id: accessToken, expiresIn: ACCESS_TOKEN_TTL_SEC },
    { id: refreshToken, expiresIn: REFRESH_TOKEN_TTL_SEC },
  );
  if (!stored) return null;

  return { access_token: accessToken, refresh_token: refreshToken, grantId };
}

export async function exchangeAuthorizationCode(
  env: Env, request: Request, clientId: string,
  body: { code?: string; redirect_uri?: string; code_verifier?: string; scope?: string },
): Promise<TokenLifecycleResult> {
  const code = body.code;
  if (!code) return failure('invalid_request', 'Missing code');

  const codeAdapter = new D1Adapter(env.DB, 'AuthorizationCode');
  const codeRow = (await codeAdapter.find(code)) as AuthorizationCodePayload | undefined;

  if (!codeRow) {
    return failure('invalid_grant', 'Authorization code expired or invalid');
  }
  // v2.33.97 security: client_id 不對 → reject 不 cascade。否則 leaked auth code
  // 被任意 registered client B 提交即觸發 victim grantId family revoke (DoS)。
  if (codeRow.client_id !== clientId) {
    return failure('invalid_grant', 'code does not belong to this client');
  }
  if (codeRow.redirect_uri !== body.redirect_uri) {
    return failure('invalid_grant', 'redirect_uri mismatch');
  }

  // PKCE verify (if code_challenge was present at authorize)
  if (codeRow.code_challenge) {
    if (!body.code_verifier) {
      return failure('invalid_grant', 'code_verifier required (PKCE)');
    }
    const expectedChallenge = await pkceTransform(body.code_verifier);
    if (expectedChallenge !== codeRow.code_challenge) {
      return failure('invalid_grant', 'code_verifier does not match code_challenge');
    }
  }

  const requestedScopes = (body.scope ?? '').split(/\s+/).filter(Boolean);
  if (requestedScopes.some((scope) => !codeRow.scopes.includes(scope))) {
    return failure('invalid_scope', 'Cannot widen scope');
  }
  const finalScopes = requestedScopes.length ? requestedScopes : codeRow.scopes;

  if (codeRow.consumed) {
    // Replay attack — RFC 6749 §10.5: cascade-revoke all tokens issued from this grant
    if (codeRow.grantId) {
      await new D1Adapter(env.DB, 'AccessToken').revokeByGrantId(codeRow.grantId);
    }
    await recordAuthEvent(env.DB, request, {
      eventType: 'token_issue',
      outcome: 'failure',
      userId: codeRow.user_id,
      clientId,
      failureReason: 'auth_code_replay',
      metadata: { grantId: codeRow.grantId ?? null, scopes: codeRow.scopes },
    }, env);
    return failure('invalid_grant', 'Authorization code already used (replay detected — tokens revoked)');
  }

  // v2.33.58 round 12 C4: atomic CAS consume BEFORE issueTokenPair。
  // 之前 unconditional UPDATE，平行 2 個 POST /token 都過 consumed 檢查、都 issue、
  // 都 consume，產生 2 個獨立 grantId。改 conditional UPDATE 後輸的 caller 收到 false
  // 就 abort，避免 double-spend。
  const won = await codeAdapter.consume(code);
  if (!won) {
    // Race lost — 另一個 caller 平行 exchange 同 code，treat 同 replay
    await recordAuthEvent(env.DB, request, {
      eventType: 'token_issue',
      outcome: 'failure',
      userId: codeRow.user_id,
      clientId,
      failureReason: 'auth_code_concurrent_exchange',
      metadata: { scopes: codeRow.scopes },
    }, env);
    return failure('invalid_grant', 'Authorization code concurrent exchange detected');
  }
  // Won the race — issue tokens + bind grantId for replay-revoke。
  const tokens = await issueTokenPair(env.DB, clientId, codeRow.user_id, finalScopes,
    { model: 'AuthorizationCode', id: code });
  if (!tokens) return failure('invalid_grant', 'Authorization code no longer available');
  await recordAuthEvent(env.DB, request, {
    eventType: 'token_issue', outcome: 'success', userId: codeRow.user_id, clientId,
    metadata: { grant_type: 'authorization_code', scopes: finalScopes },
  }, env);
  return { ok: true, tokens, userId: codeRow.user_id, scopes: finalScopes };
}
