/**
 * POST /api/oauth/server-token
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
 * V2-P4 階段 issue **opaque tokens**（random bytes stored in D1，not JWT）。
 * V2-P5 加 RS256 JWT id_token signing。
 *
 * Response (JSON):
 *   { access_token, refresh_token, token_type: 'Bearer', expires_in, scope }
 */
import { D1Adapter, type AdapterPayload } from '../../../src/server/oauth-d1-adapter';
import { verifyPassword } from '../../../src/server/password';
import { issueIdToken } from './_id_token';
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
  used: boolean;
}

interface RefreshTokenPayload extends AdapterPayload {
  client_id: string;
  user_id: string;
  scopes: string[];
  grantId: string;
}

interface ClientAppRow {
  client_id: string;
  client_type: 'public' | 'confidential';
  client_secret_hash: string | null;
  status: string;
}

function jsonError(error: string, error_description: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error, error_description }),
    { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  );
}

function generateOpaqueToken(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Compute SHA-256 hash of code_verifier and base64url encode (per RFC 7636 §4.6). */
async function pkceTransform(verifier: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function parseBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const out: Record<string, string> = {};
    for (const [k, v] of params) out[k] = v;
    return out;
  }
  if (ct.includes('application/json')) {
    return (await request.json()) as Record<string, string>;
  }
  return {};
}

/** Parse HTTP Basic auth header for client credentials (RFC 6749 §2.3.1). */
function parseBasicAuth(request: Request): { id: string; secret: string } | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Basic ')) return null;
  try {
    const decoded = atob(auth.slice(6));
    const idx = decoded.indexOf(':');
    if (idx < 0) return null;
    return { id: decoded.slice(0, idx), secret: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

/** Issue access+refresh tokens 共用 helper — shared by 2 grant types. */
async function issueTokenPair(
  db: Env['DB'],
  clientId: string,
  userId: string,
  scopes: string[],
): Promise<{ access_token: string; refresh_token: string; grantId: string }> {
  const grantId = crypto.randomUUID();
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();

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
  const body = await parseBody(context.request);
  const grant_type = body.grant_type;

  if (grant_type !== 'authorization_code' && grant_type !== 'refresh_token') {
    return jsonError('unsupported_grant_type', 'Supported: authorization_code, refresh_token');
  }

  // Client auth: HTTP Basic OR body fields (shared by both grant types)
  const basic = parseBasicAuth(context.request);
  const clientId = basic?.id ?? body.client_id;
  const clientSecret = basic?.secret ?? body.client_secret;

  if (!clientId) {
    return jsonError('invalid_client', 'Missing client_id');
  }

  const client = await context.env.DB
    .prepare(
      `SELECT client_id, client_type, client_secret_hash, status
       FROM client_apps WHERE client_id = ?`,
    )
    .bind(clientId)
    .first<ClientAppRow>();

  if (!client || client.status !== 'active') {
    return jsonError('invalid_client', 'Unknown or inactive client_id', 401);
  }

  // Confidential client: verify client_secret (both grant types)
  if (client.client_type === 'confidential') {
    if (!clientSecret || !client.client_secret_hash) {
      return jsonError('invalid_client', 'client_secret required for confidential client', 401);
    }
    const ok = await verifyPassword(clientSecret, client.client_secret_hash);
    if (!ok) return jsonError('invalid_client', 'Invalid client_secret', 401);
  }

  // Branch on grant_type
  if (grant_type === 'refresh_token') {
    const refreshTokenInput = body.refresh_token;
    if (!refreshTokenInput) {
      return jsonError('invalid_request', 'Missing refresh_token');
    }

    const refreshAdapter = new D1Adapter(context.env.DB, 'RefreshToken');
    const refreshRow = (await refreshAdapter.find(refreshTokenInput)) as RefreshTokenPayload | undefined;

    if (!refreshRow) {
      return jsonError('invalid_grant', 'refresh_token expired or invalid');
    }
    if (refreshRow.client_id !== clientId) {
      return jsonError('invalid_grant', 'refresh_token does not belong to this client');
    }

    // Optional scope downgrade: caller can request narrower scope
    const requestedScopes = (body.scope ?? '').split(/\s+/).filter(Boolean);
    let finalScopes = refreshRow.scopes;
    if (requestedScopes.length > 0) {
      const invalid = requestedScopes.filter((s) => !refreshRow.scopes.includes(s));
      if (invalid.length > 0) {
        return jsonError('invalid_scope', `Cannot widen scope: ${invalid.join(', ')}`);
      }
      finalScopes = requestedScopes;
    }

    // Rotation: destroy old refresh + issue new pair (V2-P6 spec)
    await refreshAdapter.destroy(refreshTokenInput);
    const tokens = await issueTokenPair(context.env.DB, clientId, refreshRow.user_id, finalScopes);
    let idToken: string | null = null;
    try {
      idToken = await issueIdToken(context.env, context.request, clientId, refreshRow.user_id, finalScopes);
    } catch {
      // 'openid' scope but no signing key configured → fall through; client gets tokens without id_token
    }
    return tokenResponse(tokens, finalScopes, idToken);
  }

  // grant_type === 'authorization_code'
  const code = body.code;
  if (!code) return jsonError('invalid_request', 'Missing code');

  const codeAdapter = new D1Adapter(context.env.DB, 'AuthorizationCode');
  const codeRow = (await codeAdapter.find(code)) as AuthorizationCodePayload | undefined;

  if (!codeRow) {
    return jsonError('invalid_grant', 'Authorization code expired or invalid');
  }
  if (codeRow.used) {
    // Replay attack — RFC 6749 §10.5: revoke all tokens issued from this grant
    return jsonError('invalid_grant', 'Authorization code already used (potential replay attack)');
  }
  if (codeRow.client_id !== clientId) {
    return jsonError('invalid_grant', 'code does not belong to this client');
  }
  if (codeRow.redirect_uri !== body.redirect_uri) {
    return jsonError('invalid_grant', 'redirect_uri mismatch');
  }

  // PKCE verify (if code_challenge was present at authorize)
  if (codeRow.code_challenge) {
    if (!body.code_verifier) {
      return jsonError('invalid_grant', 'code_verifier required (PKCE)');
    }
    const expectedChallenge = await pkceTransform(body.code_verifier);
    if (expectedChallenge !== codeRow.code_challenge) {
      return jsonError('invalid_grant', 'code_verifier does not match code_challenge');
    }
  }

  // Mark code as used (one-time)
  await codeAdapter.consume(code);

  // Issue tokens via shared helper
  const tokens = await issueTokenPair(context.env.DB, clientId, codeRow.user_id, codeRow.scopes);
  let idToken: string | null = null;
  try {
    idToken = await issueIdToken(context.env, context.request, clientId, codeRow.user_id, codeRow.scopes);
  } catch {
    // 'openid' scope but no signing key configured → fall through; client gets tokens without id_token
  }
  return tokenResponse(tokens, codeRow.scopes, idToken);
};
