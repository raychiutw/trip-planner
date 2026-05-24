/**
 * round-12-server-security.test.ts — architectural guard for v2.33.58 fix
 *
 * Source-grep 鎖以下 fix 不被回退:
 *   C2: google-id-token enforce email_verified === true + azp check
 *   C3: email-templates Subject sanitizeHeaderField (CRLF strip)
 *   C4: D1Adapter.consume() conditional UPDATE + boolean return
 *   H1: validate-redirect-uris reject hash/userinfo/search
 *   H3: PBKDF2 ITERATIONS = 600000 (對齊 OWASP 2023)
 *   H5: session.ts comment 標示 CSRF 未實 wire
 *   I1: hashPassword 用 MIN_PASSWORD_LEN 常數
 *   I5: maps/google-client requireApiKey pre-check
 *   v2.33.58 round 12: revokeByGrantId scope name IN allowlist
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');

const JWT_SRC = read('src/server/jwt.ts');
const GOOGLE_ID_SRC = read('src/server/oauth-client/google-id-token.ts');
const EMAIL_TPL_SRC = read('src/server/email-templates.ts');
const ADAPTER_SRC = read('src/server/oauth-d1-adapter.ts');
const REDIRECT_SRC = read('src/server/oauth-server/validate-redirect-uris.ts');
const PASSWORD_SRC = read('src/server/password.ts');
const SESSION_SRC = read('src/server/session.ts');
const MAPS_SRC = read('src/server/maps/google-client.ts');
const TOKEN_API_SRC = read('functions/api/oauth/token.ts');

describe('v2.33.58 C1 — JWT alg pin', () => {
  it('verifyJwt 加 alg allowlist check', () => {
    expect(JWT_SRC).toContain('expectedAlg ?? ');
    expect(JWT_SRC).toMatch(/alg not permitted/);
  });

  it('exp 不再加 clockSkew (I2)', () => {
    // Verify the exp check uses nowSec >= claims.exp (strict), not nowSec - skew >= claims.exp
    expect(JWT_SRC).toMatch(/nowSec >= claims\.exp/);
    expect(JWT_SRC).not.toMatch(/nowSec - skew >= claims\.exp/);
  });
});

describe('v2.33.58 C2/H4 — Google ID token enforce email_verified + azp', () => {
  it('verifier 內 enforce email_verified === true', () => {
    // variable is camelCase emailVerified, claim is snake_case email_verified
    expect(GOOGLE_ID_SRC).toMatch(/emailVerified !== true/);
    expect(GOOGLE_ID_SRC).toMatch(/throw.*email_verified/);
  });

  it('azp check (OIDC §3.1.3.7 step 8)', () => {
    expect(GOOGLE_ID_SRC).toMatch(/azp.*!==.*expectedAud/);
    expect(GOOGLE_ID_SRC).toMatch(/azp mismatch/);
  });
});

describe('v2.33.58 C3 — email-templates CRLF strip', () => {
  it('sanitizeHeaderField helper exists', () => {
    expect(EMAIL_TPL_SRC).toContain('function sanitizeHeaderField');
    expect(EMAIL_TPL_SRC).toMatch(/replace\(\/\[\\r\\n\\0\]/);
  });

  it('tripInvitation Subject 用 sanitizeHeaderField', () => {
    expect(EMAIL_TPL_SRC).toMatch(/safeTripTitle = sanitizeHeaderField/);
    expect(EMAIL_TPL_SRC).toMatch(/inviterLabel = sanitizeHeaderField/);
  });
});

describe('v2.33.58 C4 — D1Adapter.consume() atomic CAS', () => {
  it('consume() returns boolean (race winner)', () => {
    expect(ADAPTER_SRC).toMatch(/async consume\(id: string\): Promise<boolean>/);
    expect(ADAPTER_SRC).toMatch(/return \(result\.meta\?\.changes \?\? 0\) === 1/);
  });

  it('UPDATE 加 consumed IS NULL guard', () => {
    expect(ADAPTER_SRC).toMatch(/json_extract\(payload, '\$\.consumed'\) IS NULL/);
  });

  it('token.ts authorization_code path 先 consume 後 issue', () => {
    expect(TOKEN_API_SRC).toMatch(/won = await codeAdapter\.consume\(code\)/);
    expect(TOKEN_API_SRC).toMatch(/auth_code_concurrent_exchange/);
  });

  it('token.ts refresh_token rotation 先 consume 後 issue + revoke if race lost', () => {
    expect(TOKEN_API_SRC).toMatch(/won = await refreshAdapter\.consume/);
    expect(TOKEN_API_SRC).toMatch(/refresh_token_concurrent_rotation/);
  });
});

describe('v2.33.58 — D1Adapter.revokeByGrantId scope', () => {
  it('DELETE 加 name IN (\'AccessToken\', \'RefreshToken\') scope', () => {
    expect(ADAPTER_SRC).toContain(`name IN ('AccessToken', 'RefreshToken')`);
  });
});

describe('v2.33.58 H1 — validate-redirect-uris tighten', () => {
  it('reject #fragment', () => {
    expect(REDIRECT_SRC).toMatch(/parsed\.hash !== ''/);
  });

  it('reject userinfo (user/password)', () => {
    expect(REDIRECT_SRC).toMatch(/parsed\.username !== ''/);
    expect(REDIRECT_SRC).toMatch(/parsed\.password !== ''/);
  });

  it('reject ?query (OAuth 2.1 baseline)', () => {
    expect(REDIRECT_SRC).toMatch(/parsed\.search !== ''/);
  });
});

describe('v2.33.58 H3 — PBKDF2 600k iterations (OWASP 2023)', () => {
  it('ITERATIONS = 600_000', () => {
    expect(PASSWORD_SRC).toMatch(/const ITERATIONS = 600_000/);
  });
});

describe('v2.33.58 I1 — hashPassword 用 MIN_PASSWORD_LEN', () => {
  it('hashPassword 不再寫死 8', () => {
    expect(PASSWORD_SRC).toMatch(/plain\.length < MIN_PASSWORD_LEN/);
    expect(PASSWORD_SRC).not.toMatch(/plain\.length < 8/);
  });
});

describe('v2.33.58 I5 — google-client requireApiKey', () => {
  it('requireApiKey helper + MAPS_CONFIG enum', () => {
    expect(MAPS_SRC).toContain('function requireApiKey');
    expect(MAPS_SRC).toContain("'MAPS_CONFIG'");
  });

  it('4 個 exported fn 都 call requireApiKey', () => {
    // matches inside searchPlaces / autocompletePlaces / getPlaceDetails / computeRoute
    const calls = (MAPS_SRC.match(/requireApiKey\(apiKey\);/g) ?? []).length;
    expect(calls).toBeGreaterThanOrEqual(4);
  });
});

describe('v2.33.58 H5 — session.ts CSRF comment 修正', () => {
  it('comment 標示 csrf 未實際 wire double-submit', () => {
    expect(SESSION_SRC).toMatch(/未實際做 double-submit/);
    expect(SESSION_SRC).toMatch(/SameSite=Lax/);
  });

  it('comment 標示 csrf field 是 unused / future-proof', () => {
    expect(SESSION_SRC).toMatch(/勿假設.*防護已啟用|未實際做 double-submit/);
  });
});
