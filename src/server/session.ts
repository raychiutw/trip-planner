/**
 * Session token module — V2-P1 (per docs/v2-oauth-server-plan.md V2-P6 spec)
 *
 * Opaque session cookie + SHA-256 HMAC（非 JWT — 避免 JWT 慣性 sec issues：
 * alg=none, key confusion, expiry-bypass-via-payload-edit 等）。Token 結構：
 *
 *   <base64url payload>.<base64url hmac>
 *
 * Payload JSON 含：
 *   - uid: user.id
 *   - iat: issued at (unix sec)
 *   - exp: expires at (unix sec)
 *   - csrf: CSRF token (32 bytes random，POST/PUT/DELETE 都驗)
 *
 * 驗證：HMAC(secret, payload) === provided_hmac → 接受；過期 reject。
 *
 * 為何用 Web Crypto 而非 JWT lib：
 *   - CF Workers Web Crypto 是 native，不需 nodejs_compat
 *   - 控制權：自定 payload schema 不必 jose / jsonwebtoken 依賴
 *   - Spec align：V2-P6 explicit「opaque session cookie + SHA-256 hash（非 JWT）」
 *
 * 不負責（其他 module）：
 *   - User authentication（OAuth flow / password verify → 才 issue session）
 *   - Cookie storage（這個 module 只管 sign/verify token string；
 *     setSessionCookie / getSessionCookie helper 在 functions/api/_cookies.ts）
 */

const SESSION_VERSION = 1;
const ALG = 'SHA-256';

export interface SessionPayload {
  uid: string;
  iat: number;
  exp: number;
  csrf: string;
  /** Schema version 預留 — V2-P1 = 1 */
  v: number;
  [key: string]: unknown;
}

/** base64url (no padding, URL-safe) — sign 用，跟 JWT 同 encoding */
function base64urlEncode(bytes: Uint8Array | string): string {
  const buf = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let str = '';
  // noUncheckedIndexedAccess: buf[i] 是 number | undefined；range 安全用 ! assertion
  for (let i = 0; i < buf.length; i++) str += String.fromCharCode(buf[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: ALG },
    false,
    ['sign', 'verify'],
  );
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64urlEncode(new Uint8Array(sig));
}

/** Constant-time compare — 避免 timing attack 推 HMAC byte-by-byte */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Generate cryptographically random CSRF token (32 bytes → 43 char base64url) */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

/**
 * Sign session token — return `<payload>.<hmac>` string。
 *
 * @param uid user.id
 * @param secret session signing secret (env)
 * @param ttlSeconds default 30 days (long-lived web session)
 */
export async function signSessionToken(
  uid: string,
  secret: string,
  ttlSeconds = 30 * 24 * 60 * 60,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    uid,
    iat: now,
    exp: now + ttlSeconds,
    csrf: generateCsrfToken(),
  };
  const payloadStr = base64urlEncode(JSON.stringify(payload));
  const sig = await hmacSign(secret, payloadStr);
  return `${payloadStr}.${sig}`;
}

/**
 * Verify session token — return parsed payload if valid, null otherwise。
 *
 * Reject conditions:
 *   - format invalid (not exactly 1 dot)
 *   - HMAC mismatch (tampered or wrong secret)
 *   - exp < now (expired)
 *   - v not supported (future schema migration)
 */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, providedSig] = parts;
  // noUncheckedIndexedAccess 推為 string | undefined — runtime 已 length===2 但 TS 不知
  if (!payloadStr || !providedSig) return null;

  const expectedSig = await hmacSign(secret, payloadStr);
  if (!constantTimeEquals(expectedSig, providedSig)) return null;

  let payload: SessionPayload;
  try {
    const json = new TextDecoder().decode(base64urlDecode(payloadStr));
    payload = JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }

  if (payload.v !== SESSION_VERSION) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.uid !== 'string' || !payload.uid) return null;

  return payload;
}
