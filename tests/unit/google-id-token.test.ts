/**
 * google-id-token.test.ts — verifyGoogleIdToken behaviour
 * v2.33.58 round 12b: CRITICAL ZERO_COVERAGE fill — 之前
 * tests/api/oauth-callback-google.test.ts vi.mock 整個 module，真
 * verifier 從未跑過。本檔覆蓋 JWKS fetch / kid lookup / rotation retry /
 * email_verified enforce / azp check / iss whitelist。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { signJwt, computeKid, exportPublicJwk } from '../../src/server/jwt';

/* ===== Test fixtures: generate a fake Google JWKS + signed token ===== */

let keypair: { privateKey: CryptoKey; publicKey: CryptoKey };
let kid: string;
let publicJwk: JsonWebKey & { kid?: string };

async function setupKey(): Promise<void> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  keypair = pair;
  publicJwk = await exportPublicJwk(pair.publicKey);
  kid = await computeKid(pair.privateKey);
  publicJwk.kid = kid;
}

async function makeToken(claims: Record<string, unknown>): Promise<string> {
  const merged = {
    iss: 'https://accounts.google.com',
    aud: 'expected-aud',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    email: 'user@example.com',
    email_verified: true,
    ...claims,
  };
  return signJwt(merged, keypair.privateKey, kid);
}

function mockJwks(keys: Array<JsonWebKey & { kid?: string }>): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ keys }),
  } as Response) as typeof fetch;
}

describe('verifyGoogleIdToken', () => {
  beforeEach(async () => {
    await setupKey();
    // Reset module-level JWKS cache between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path: valid token with email_verified=true returns claims', async () => {
    mockJwks([publicJwk]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    const token = await makeToken({});
    const claims = await verifyGoogleIdToken(token, 'expected-aud');
    expect(claims.email).toBe('user@example.com');
    expect((claims as { email_verified?: boolean }).email_verified).toBe(true);
  });

  it('throws when header missing kid', async () => {
    mockJwks([publicJwk]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    // Sign a token with explicit empty kid by manually constructing
    const payload = btoa(JSON.stringify({ iss: 'i', aud: 'a', exp: Math.floor(Date.now() / 1000) + 60 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const header = btoa('{"alg":"RS256","typ":"JWT"}').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const fakeSig = 'fakesig';
    const token = `${header}.${payload}.${fakeSig}`;
    await expect(verifyGoogleIdToken(token, 'a')).rejects.toThrow(/missing kid/);
  });

  it('throws when kid not in JWKS (after retry)', async () => {
    mockJwks([{ ...publicJwk, kid: 'different-kid' }]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    const token = await makeToken({});
    await expect(verifyGoogleIdToken(token, 'expected-aud')).rejects.toThrow(/kid .* not in JWKS/);
  });

  it('CRITICAL v2.33.58 C2: rejects token with email_verified=false', async () => {
    mockJwks([publicJwk]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    const token = await makeToken({ email_verified: false });
    await expect(verifyGoogleIdToken(token, 'expected-aud')).rejects.toThrow(/email_verified/);
  });

  it('CRITICAL v2.33.58 C2: rejects token without email_verified field', async () => {
    mockJwks([publicJwk]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    const token = await makeToken({ email_verified: undefined });
    await expect(verifyGoogleIdToken(token, 'expected-aud')).rejects.toThrow(/email_verified/);
  });

  it('v2.33.58: rejects token with azp != expected aud (OIDC §3.1.3.7 step 8)', async () => {
    mockJwks([publicJwk]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    const token = await makeToken({ azp: 'attacker-client-id' });
    await expect(verifyGoogleIdToken(token, 'expected-aud')).rejects.toThrow(/azp mismatch/);
  });

  it('accepts azp matching expected aud', async () => {
    mockJwks([publicJwk]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    const token = await makeToken({ azp: 'expected-aud' });
    const claims = await verifyGoogleIdToken(token, 'expected-aud');
    expect((claims as { azp?: string }).azp).toBe('expected-aud');
  });

  it('accepts iss "accounts.google.com" (no scheme)', async () => {
    mockJwks([publicJwk]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    const token = await makeToken({ iss: 'accounts.google.com' });
    const claims = await verifyGoogleIdToken(token, 'expected-aud');
    expect(claims.iss).toBe('accounts.google.com');
  });

  it('rejects iss not in ALLOWED_ISSUERS', async () => {
    mockJwks([publicJwk]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    const token = await makeToken({ iss: 'https://attacker.com' });
    await expect(verifyGoogleIdToken(token, 'expected-aud')).rejects.toThrow(/iss mismatch/);
  });

  it('rejects aud not matching expected', async () => {
    mockJwks([publicJwk]);
    const { verifyGoogleIdToken } = await import('../../src/server/oauth-client/google-id-token');
    const token = await makeToken({});
    await expect(verifyGoogleIdToken(token, 'different-aud')).rejects.toThrow(/aud mismatch/);
  });
});
