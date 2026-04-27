/**
 * RS256 JWT signing / verification — V2-P5 OIDC id_token support
 *
 * 用 Web Crypto API（Cloudflare Workers 內建，無 wasm dependency）。
 *
 * Key 來源：env `OAUTH_SIGNING_PRIVATE_KEY`（PKCS8 PEM 或 base64）
 *   - V2-P5 階段：單 key（無 rotation）
 *   - V2-P6 加 rotation：env 加入 `*_NEXT` (active for signing) +
 *     `*_PREV` (still in JWKS for verification grace period)
 *
 * Public key 從 private key 衍生用於 JWKS 發布（避免維護兩個 env）。
 *
 * ## ID Token claims (per OIDC §2)
 *   - iss: issuer URL (e.g. https://trip-planner-dby.pages.dev)
 *   - sub: user id
 *   - aud: client_id
 *   - exp / iat / nbf
 *   - email / name / picture (per scope)
 */

const ALG: RsaHashedImportParams = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: 'SHA-256',
};

export interface JwtClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number; // unix seconds
  iat: number;
  nbf?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [k: string]: unknown;
}

interface JwtHeader {
  alg: 'RS256';
  typ: 'JWT';
  kid?: string;
}

/** base64url (no padding) — RFC 7515 §2 */
function base64urlFromBytes(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromString(input: string): string {
  return base64urlFromBytes(new TextEncoder().encode(input));
}

function base64urlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(padLen);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Strip PEM header/footer + whitespace → raw base64 → decode to bytes */
function pemToBytes(pem: string): Uint8Array {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Import PKCS8 private key string into CryptoKey for RS256 signing。
 * Accepts both PEM (with headers) and raw base64 (no headers)。
 */
export async function importPrivateKey(pkcs8: string): Promise<CryptoKey> {
  const trimmed = pkcs8.trim();
  const isPem = trimmed.startsWith('-----BEGIN');
  const bytes = isPem ? pemToBytes(trimmed) : base64urlToBytes(
    trimmed.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  );
  return crypto.subtle.importKey(
    'pkcs8',
    bytes as unknown as ArrayBuffer,
    ALG,
    true, // extractable: true 因為 JWKS 要 derive public key
    ['sign'],
  );
}

/**
 * Derive public CryptoKey from a private key by exporting + re-importing as JWK。
 * Web Crypto 沒有直接 derivePublic API，繞 JWK 是慣用法。
 */
async function derivePublicKey(privateKey: CryptoKey): Promise<CryptoKey> {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  // Strip private components keep only public (n, e)
  const publicJwk: JsonWebKey = {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    alg: 'RS256',
    use: 'sig',
  };
  return crypto.subtle.importKey('jwk', publicJwk, ALG, true, ['verify']);
}

/** Export public JWK suitable for /.well-known/jwks.json */
export async function exportPublicJwk(privateKey: CryptoKey, kid: string): Promise<{
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}> {
  const publicKey = await derivePublicKey(privateKey);
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return {
    kty: jwk.kty ?? 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid,
    n: jwk.n ?? '',
    e: jwk.e ?? '',
  };
}

/**
 * Sign claims as RS256 JWT。kid identifies the signing key in JWKS。
 */
export async function signJwt(
  claims: JwtClaims,
  privateKey: CryptoKey,
  kid: string,
): Promise<string> {
  const header: JwtHeader = { alg: 'RS256', typ: 'JWT', kid };
  const encodedHeader = base64urlFromString(JSON.stringify(header));
  const encodedPayload = base64urlFromString(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    ALG.name,
    privateKey,
    new TextEncoder().encode(signingInput) as unknown as ArrayBuffer,
  );
  const encodedSig = base64urlFromBytes(new Uint8Array(signature));
  return `${signingInput}.${encodedSig}`;
}

/**
 * Options for verifyJwt — bearer-token consumers MUST pass expectedIss + expectedAud
 * (otherwise verifyJwt only proves "this token was signed by some key we have", not
 * that it was issued by the expected party FOR us).
 *
 * @field expectedIss — exact match (string) or any-of (string[]); throws if mismatch.
 * @field expectedAud — exact match against claims.aud; supports `aud` as string OR string[].
 * @field clockSkewSec — allow this many seconds of clock skew (default 60).
 * @field now — override "now" (unix seconds) for testing.
 */
export interface VerifyJwtOptions {
  expectedIss?: string | string[];
  expectedAud?: string;
  clockSkewSec?: number;
  now?: number;
}

/**
 * Verify JWT signature + claims (exp/nbf/iss/aud). Throws on invalid。
 *
 * Signature-only verification is NOT sufficient for bearer-token authentication —
 * pass `expectedIss` and `expectedAud` to defend against token-substitution.
 */
export async function verifyJwt(
  token: string,
  publicKey: CryptoKey,
  options: VerifyJwtOptions = {},
): Promise<JwtClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT must have 3 parts');
  const [encodedHeader, encodedPayload, encodedSig] = parts as [string, string, string];
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const ok = await crypto.subtle.verify(
    ALG.name,
    publicKey,
    base64urlToBytes(encodedSig) as unknown as ArrayBuffer,
    new TextEncoder().encode(signingInput) as unknown as ArrayBuffer,
  );
  if (!ok) throw new Error('JWT signature invalid');
  const claimsJson = new TextDecoder().decode(base64urlToBytes(encodedPayload));
  const claims = JSON.parse(claimsJson) as JwtClaims;

  const skew = options.clockSkewSec ?? 60;
  const nowSec = options.now ?? Math.floor(Date.now() / 1000);

  if (typeof claims.exp === 'number' && nowSec - skew >= claims.exp) {
    throw new Error('JWT expired');
  }
  if (typeof claims.nbf === 'number' && nowSec + skew < claims.nbf) {
    throw new Error('JWT not yet valid (nbf)');
  }

  if (options.expectedIss !== undefined) {
    const expectedIssList = Array.isArray(options.expectedIss) ? options.expectedIss : [options.expectedIss];
    if (!expectedIssList.includes(claims.iss)) {
      throw new Error(`JWT iss mismatch: got "${claims.iss}"`);
    }
  }

  if (options.expectedAud !== undefined) {
    const aud = claims.aud;
    const audList = Array.isArray(aud) ? aud : [aud];
    if (!audList.includes(options.expectedAud)) {
      throw new Error(`JWT aud mismatch: expected "${options.expectedAud}"`);
    }
  }

  return claims;
}

/**
 * Decode JWT header without signature verification — used to extract `kid` so the
 * caller can fetch the matching key from JWKS before calling verifyJwt.
 */
export function decodeJwtHeader(token: string): JwtHeader & { kid?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT must have 3 parts');
  const headerJson = new TextDecoder().decode(base64urlToBytes(parts[0]!));
  return JSON.parse(headerJson) as JwtHeader;
}

/** Import a JWK (e.g. from Google JWKS endpoint) as a verify-only public CryptoKey. */
export async function importPublicJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ALG, true, ['verify']);
}

/** Compute kid from public key JWK n component (deterministic, stable across deploys) */
export async function computeKid(privateKey: CryptoKey): Promise<string> {
  const publicKey = await derivePublicKey(privateKey);
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  // SHA-256 of n + e is RFC 7638 Thumbprint compatible (close enough for kid)
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`{"e":"${jwk.e}","kty":"RSA","n":"${jwk.n}"}`) as unknown as ArrayBuffer,
  );
  return base64urlFromBytes(new Uint8Array(buf)).slice(0, 16);
}

export { derivePublicKey };
