/**
 * cleanup-backlog.test.ts — v2.33.52 backlog finding sweep
 *
 * Source-grep guard for backlog 收尾:
 *  1. oauth/reset-password 加 per-IP rate limit (round 5d defer)
 *  2. oauth/send-verification 加 per-IP + per-email rate limit (round 5d defer)
 *  3. TripMapRail scroll-spy MutationObserver pattern (round 6c defer)
 *  4. launchd plist KeepAlive ThrottleInterval (round 8d defer)
 *  5. daily-report.js SSRF host allowlist (round 8d defer)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RESET_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/oauth/reset-password.ts'),
  'utf-8',
);
const VERIFY_SRC = readFileSync(
  path.resolve(__dirname, '../../functions/api/oauth/send-verification.ts'),
  'utf-8',
);
const TRIPMAPRAIL_SRC = readFileSync(
  path.resolve(__dirname, '../../src/components/trip/TripMapRail.tsx'),
  'utf-8',
);

describe('v2.33.52 cleanup — oauth/reset-password rate limit', () => {
  it('checkRateLimit + bumpRateLimit wired', () => {
    expect(RESET_SRC).toContain('checkRateLimit');
    expect(RESET_SRC).toContain('bumpRateLimit');
    expect(RESET_SRC).toContain("`reset-password:${clientIp");
  });

  it('429 response with RESET_RATE_LIMITED code', () => {
    expect(RESET_SRC).toContain("'RESET_RATE_LIMITED'");
    // v2.33.107 refactor: 429 + Retry-After 走 buildRateLimitResponse helper
    // (不再 inline `{status: 429, headers: {Retry-After: ...}}`).
    expect(RESET_SRC).toContain('buildRateLimitResponse');
  });
});

describe('v2.33.52 cleanup — oauth/send-verification rate limit', () => {
  it('per-IP + per-email rate limit wired', () => {
    expect(VERIFY_SRC).toContain('checkRateLimit');
    expect(VERIFY_SRC).toContain('bumpRateLimit');
    expect(VERIFY_SRC).toContain("`send-verification:${clientIp");
    expect(VERIFY_SRC).toContain('`send-verification:${email}');
  });

  it('VERIFY_RATE_LIMITED 429 response', () => {
    expect(VERIFY_SRC).toContain("'VERIFY_RATE_LIMITED'");
  });
});

describe('v2.33.52 cleanup — TripMapRail scroll-spy MutationObserver', () => {
  it('MutationObserver fallback when initial query 0 targets', () => {
    expect(TRIPMAPRAIL_SRC).toContain('new MutationObserver');
    expect(TRIPMAPRAIL_SRC).toContain('childList: true, subtree: true');
    expect(TRIPMAPRAIL_SRC).toContain('function attachIfPresent');
  });

  it('disconnect 兩個 observer on cleanup', () => {
    expect(TRIPMAPRAIL_SRC).toContain('intersectionObserver.disconnect()');
    expect(TRIPMAPRAIL_SRC).toContain('mutationObserver?.disconnect()');
  });
});
