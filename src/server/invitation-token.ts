/**
 * Invitation token helpers — V2 共編邀請 (跟 _session HMAC pattern 一致)
 *
 * Design：raw token 32 bytes base64url 隨機字串 → HMAC-SHA256(SESSION_SECRET, raw) →
 * 存 token_hash 進 trip_invitations.token_hash (PK)。raw token 只活在 email URL +
 * /invite query string。DB dump 不能直接反查 token，HMAC 才能比對。
 *
 * 為何不重用 _session.ts hmacSign：那個 module 用於 session token (long-lived 30d)，
 * semantic 不同。獨立 module 讓 invitation lifecycle 跟 session 解耦，未來換 algo
 * 不互相影響。
 */

import { generateOpaqueToken } from '../../functions/api/_utils';

const ALG = 'SHA-256';

function base64urlEncodeBytes(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: ALG },
    false,
    ['sign'],
  );
}

/** Compute HMAC-SHA256(secret, rawToken) → base64url string for DB storage. */
export async function hashInvitationToken(rawToken: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawToken));
  return base64urlEncodeBytes(new Uint8Array(sig));
}

/** Generate raw token + its HMAC hash in one call。raw 寄 email、hash 存 DB。 */
export async function generateInvitationToken(
  secret: string,
): Promise<{ rawToken: string; tokenHash: string }> {
  const rawToken = generateOpaqueToken();
  const tokenHash = await hashInvitationToken(rawToken, secret);
  return { rawToken, tokenHash };
}

/** ISO timestamp 7 days from now (default invitation TTL) */
export function invitationExpiresAt(daysFromNow = 7): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}
