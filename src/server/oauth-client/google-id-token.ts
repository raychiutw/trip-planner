/**
 * Google id_token verification — V2-P5 critical security fix
 *
 * Per OpenID Connect Core §3.1.3.7, a relying party MUST verify the id_token
 * signature against the issuer's published JWKS, plus iss / aud / exp claims.
 * The earlier "trust HTTPS endpoint" shortcut leaves an account-takeover hole
 * if the token is delivered via a misconfigured proxy or auth-flow bug.
 *
 * Reference: https://developers.google.com/identity/openid-connect/openid-connect#validatinganidtoken
 */

import { verifyJwt, decodeJwtHeader, importPublicJwk, type JwtClaims } from '../jwt';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
// Both forms appear in Google id_tokens. Spec-compliant verifiers accept either.
const ALLOWED_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

interface GoogleJwks {
  keys: Array<JsonWebKey & { kid?: string }>;
}

/** In-isolate JWKS cache. Google rotates keys ~daily; 1h TTL is conservative. */
let jwksCache: { fetchedAt: number; jwks: GoogleJwks } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function fetchGoogleJwks(): Promise<GoogleJwks> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.jwks;
  }
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google JWKS: ${res.status}`);
  }
  const jwks = (await res.json()) as GoogleJwks;
  jwksCache = { fetchedAt: Date.now(), jwks };
  return jwks;
}

/**
 * Verify a Google-issued OIDC id_token. Throws on any failure (signature, kid
 * not in JWKS, iss/aud mismatch, expired). Returns the validated claims.
 *
 * @param idToken     The id_token string from /token response.
 * @param expectedAud Our GOOGLE_CLIENT_ID — Google ALWAYS sets aud to the
 *                    requesting client_id, so this MUST match or the token
 *                    was minted for someone else.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedAud: string,
): Promise<JwtClaims> {
  const header = decodeJwtHeader(idToken);
  if (!header.kid) {
    throw new Error('Google id_token missing kid header');
  }
  const jwks = await fetchGoogleJwks();
  const matchingKey = jwks.keys.find((k) => k.kid === header.kid);
  if (!matchingKey) {
    // Possible if Google just rotated keys; force-refresh once and retry.
    jwksCache = null;
    const refreshed = await fetchGoogleJwks();
    const retry = refreshed.keys.find((k) => k.kid === header.kid);
    if (!retry) throw new Error(`Google id_token kid "${header.kid}" not in JWKS`);
    return verifyJwt(idToken, await importPublicJwk(retry), {
      expectedIss: ALLOWED_ISSUERS,
      expectedAud,
    });
  }
  const publicKey = await importPublicJwk(matchingKey);
  return verifyJwt(idToken, publicKey, {
    expectedIss: ALLOWED_ISSUERS,
    expectedAud,
  });
}
