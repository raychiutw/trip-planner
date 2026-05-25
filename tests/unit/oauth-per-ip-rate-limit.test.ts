// @vitest-environment node
/**
 * v2.33.103 SEC-7 — OAuth token + revoke endpoints per-IP rate-limit。
 *
 * Confidential client_secret 驗證走 PBKDF2 (100k iter ~50ms CPU)。Attacker
 * 反覆送 wrong secret，per-client_id bucket 擋在 100/min 但前 100 個 request
 * 已經燒 ~5s CPU；若 attacker 同時跑數百 concurrent → CF Worker CPU 配額爆。
 *
 * Fix：先 per-IP rate-limit（50/min/IP），再 client lookup + PBKDF2。Bucket
 * key prefix：oauth-token:ip:<IP> / oauth-revoke:ip:<IP>。
 *
 * Pure source-grep（避開 D1 integration overhead）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOKEN_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/oauth/token.ts'),
  'utf8',
);
const REVOKE_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/oauth/revoke.ts'),
  'utf8',
);
const RATELIMIT_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/_rate_limit.ts'),
  'utf8',
);

describe('v2.33.103 SEC-7 per-IP rate-limit', () => {
  it('RATE_LIMITS 含 OAUTH_TOKEN_PER_IP preset', () => {
    expect(RATELIMIT_SRC).toMatch(/OAUTH_TOKEN_PER_IP:\s*\{/);
    expect(RATELIMIT_SRC).toMatch(/maxAttempts:\s*50/);
  });

  it('oauth/token.ts import clientIp', () => {
    expect(TOKEN_SRC).toMatch(/import\s*{[\s\S]*?clientIp[\s\S]*?}\s*from\s*['"]\.\.\/_rate_limit['"]/);
  });

  it('oauth/token.ts 用 oauth-token:ip:<IP> bucket key', () => {
    expect(TOKEN_SRC).toMatch(/oauth-token:ip:\$\{clientIp\(context\.request\)\}/);
  });

  it('oauth/token.ts per-IP check 在 client_apps SELECT 之前', () => {
    const ipCheckIdx = TOKEN_SRC.indexOf("oauth-token:ip:${clientIp");
    const clientSelectIdx = TOKEN_SRC.indexOf('FROM client_apps WHERE client_id');
    expect(ipCheckIdx).toBeGreaterThan(0);
    expect(clientSelectIdx).toBeGreaterThan(0);
    expect(ipCheckIdx).toBeLessThan(clientSelectIdx);
  });

  it('oauth/token.ts per-IP check 失敗回 429', () => {
    // v2.33.107 refactor: inline `status: 429` 改 buildRateLimitResponse helper
    // (一致 RATE_LIMIT pattern + Retry-After header)。pattern 配對 helper call。
    const block = TOKEN_SRC.match(
      /ipCheck\s*=\s*await checkRateLimit\([\s\S]*?if\s*\(!ipCheck\.ok\)\s*{[\s\S]*?buildRateLimitResponse/,
    );
    expect(block).not.toBeNull();
  });

  it('oauth/revoke.ts import clientIp + checkRateLimit', () => {
    expect(REVOKE_SRC).toMatch(/import\s*{[\s\S]*?clientIp[\s\S]*?}\s*from\s*['"]\.\.\/_rate_limit['"]/);
  });

  it('oauth/revoke.ts 用 oauth-revoke:ip:<IP> bucket key（與 token 分開）', () => {
    expect(REVOKE_SRC).toMatch(/oauth-revoke:ip:\$\{clientIp\(context\.request\)\}/);
  });

  it('oauth/revoke.ts per-IP check 在 PBKDF2 verifyPassword 之前', () => {
    const ipCheckIdx = REVOKE_SRC.indexOf('oauth-revoke:ip:${clientIp');
    const pbkdf2Idx = REVOKE_SRC.indexOf('verifyPassword(clientSecret');
    expect(ipCheckIdx).toBeGreaterThan(0);
    expect(pbkdf2Idx).toBeGreaterThan(0);
    expect(ipCheckIdx).toBeLessThan(pbkdf2Idx);
  });
});
