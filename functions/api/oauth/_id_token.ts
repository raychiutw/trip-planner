/**
 * id_token issuance — V2-P5 OIDC compliance
 *
 * Issued by /server-token when scope includes 'openid'。Claims per OIDC §2 +
 * scope-conditional (email / profile)。
 *
 * Sign 用 env OAUTH_SIGNING_PRIVATE_KEY (PKCS8). 若未設→throw（caller 應該
 * detect 在 /server-token 早期 → 500 server_error）。
 */
import { signJwt, importPrivateKey, computeKid } from '../../../src/server/jwt';
import type { Env } from '../_types';

const ID_TOKEN_TTL_SEC = 60 * 60; // 1h

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  email_verified_at: string | null;
}

/**
 * Issue id_token JWT for given user + client + scopes。
 * Returns null if scopes 不含 'openid'（caller 不應 include id_token in response）。
 */
export async function issueIdToken(
  env: Env,
  request: Request,
  clientId: string,
  userId: string,
  scopes: string[],
): Promise<string | null> {
  if (!scopes.includes('openid')) return null;

  if (!env.OAUTH_SIGNING_PRIVATE_KEY) {
    throw new Error('OAUTH_SIGNING_PRIVATE_KEY env not set — cannot issue id_token');
  }

  // Look up user fields needed for claims
  const user = await env.DB
    .prepare('SELECT id, email, display_name, email_verified_at FROM users WHERE id = ?')
    .bind(userId)
    .first<UserRow>();
  if (!user) {
    throw new Error(`User ${userId} not found — cannot issue id_token`);
  }

  const issuer = new URL(request.url).origin;
  const now = Math.floor(Date.now() / 1000);

  const claims: Record<string, unknown> = {
    iss: issuer,
    sub: userId,
    aud: clientId,
    iat: now,
    exp: now + ID_TOKEN_TTL_SEC,
  };

  // Conditional claims per scope
  if (scopes.includes('email') || scopes.includes('profile')) {
    claims.email = user.email;
    claims.email_verified = user.email_verified_at != null;
  }
  if (scopes.includes('profile')) {
    claims.name = user.display_name ?? user.email.split('@')[0];
  }

  const privateKey = await importPrivateKey(env.OAUTH_SIGNING_PRIVATE_KEY);
  const kid = await computeKid(privateKey);
  return signJwt(claims as never, privateKey, kid);
}
