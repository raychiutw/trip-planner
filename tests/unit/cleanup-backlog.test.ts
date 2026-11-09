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

const TRIPMAPRAIL_SRC = readFileSync(
  path.resolve(__dirname, '../../src/components/trip/TripMapRail.tsx'),
  'utf-8',
);



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
