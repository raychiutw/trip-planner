/**
 * functions/api/_rate_limit.ts unit test — V2-P6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkRateLimit,
  bumpRateLimit,
  resetRateLimit,
  clientIp,
  RATE_LIMITS,
} from '../../functions/api/_rate_limit';
import type { D1Database } from '@cloudflare/workers-types';

interface MockStmt {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function makeMockDb(initialRow: unknown = null) {
  let storedRow: unknown = initialRow;
  const stmt: MockStmt = {
    bind: vi.fn().mockImplementation(function(this: MockStmt, ...args: unknown[]) {
      // Store latest bind args for inspection / state mutation
      (this as MockStmt & { lastBindArgs?: unknown[] }).lastBindArgs = args;
      return this;
    }),
    first: vi.fn().mockImplementation(async () => storedRow),
    run: vi.fn().mockImplementation(async function() {
      const args = (stmt as MockStmt & { lastBindArgs?: unknown[] }).lastBindArgs;
      if (args && args.length === 4) {
        storedRow = {
          bucket_key: args[0],
          count: args[1],
          window_start: args[2],
          locked_until: args[3],
        };
      } else if (args && args.length === 1) {
        // DELETE
        storedRow = null;
      }
      return { meta: { changes: 1 } };
    }),
  };
  const db = {
    prepare: vi.fn().mockReturnValue(stmt),
  } as unknown as D1Database;
  return { db, stmt };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

describe('checkRateLimit', () => {
  it('returns ok=true when no row exists (new bucket)', async () => {
    const { db } = makeMockDb(null);
    const result = await checkRateLimit(db, 'login:1.2.3.4', RATE_LIMITS.LOGIN);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
  });

  it('returns ok=false + retryAfter when locked', async () => {
    const futureLock = Date.now() + 15 * 60 * 1000; // 15min future
    const { db } = makeMockDb({
      bucket_key: 'login:1.2.3.4',
      count: 5,
      window_start: Date.now() - 1000,
      locked_until: futureLock,
    });
    const result = await checkRateLimit(db, 'login:1.2.3.4', RATE_LIMITS.LOGIN);
    expect(result.ok).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(800);
    expect(result.retryAfter).toBeLessThanOrEqual(900);
  });

  it('returns ok=true when window expired (count resets)', async () => {
    const { db } = makeMockDb({
      bucket_key: 'login:1.2.3.4',
      count: 4,
      window_start: Date.now() - (RATE_LIMITS.LOGIN.windowMs + 1000),
      locked_until: null,
    });
    const result = await checkRateLimit(db, 'login:1.2.3.4', RATE_LIMITS.LOGIN);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
  });

  it('returns ok=true with current count when within window + not locked', async () => {
    const { db } = makeMockDb({
      bucket_key: 'login:1.2.3.4',
      count: 3,
      window_start: Date.now() - 1000,
      locked_until: null,
    });
    const result = await checkRateLimit(db, 'login:1.2.3.4', RATE_LIMITS.LOGIN);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(3);
  });
});

describe('bumpRateLimit', () => {
  it('first attempt → count=1, no lock', async () => {
    const { db } = makeMockDb(null);
    const result = await bumpRateLimit(db, 'login:1.2.3.4', RATE_LIMITS.LOGIN);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
  });

  it('5 attempts within window → count=5, no lock yet (≤ maxAttempts)', async () => {
    const { db } = makeMockDb({
      bucket_key: 'login:1.2.3.4',
      count: 4,
      window_start: Date.now() - 1000,
      locked_until: null,
    });
    const result = await bumpRateLimit(db, 'login:1.2.3.4', RATE_LIMITS.LOGIN);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(5);
  });

  it('6th attempt → count=6, locked', async () => {
    const { db } = makeMockDb({
      bucket_key: 'login:1.2.3.4',
      count: 5,
      window_start: Date.now() - 1000,
      locked_until: null,
    });
    const result = await bumpRateLimit(db, 'login:1.2.3.4', RATE_LIMITS.LOGIN);
    expect(result.ok).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.count).toBe(6);
  });

  it('attempt after window expiry → reset count + window', async () => {
    const { db } = makeMockDb({
      bucket_key: 'login:1.2.3.4',
      count: 5, // would be locked
      window_start: Date.now() - (RATE_LIMITS.LOGIN.windowMs + 1000),
      locked_until: null,
    });
    const result = await bumpRateLimit(db, 'login:1.2.3.4', RATE_LIMITS.LOGIN);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1); // reset
  });
});

describe('resetRateLimit', () => {
  it('DELETE the bucket row', async () => {
    const { db, stmt } = makeMockDb({ bucket_key: 'k', count: 3, window_start: 0, locked_until: null });
    await resetRateLimit(db, 'login:1.2.3.4');
    expect(stmt.bind).toHaveBeenCalledWith('login:1.2.3.4');
  });
});

describe('clientIp', () => {
  it('reads CF-Connecting-IP header', () => {
    const req = new Request('https://x.com', { headers: { 'CF-Connecting-IP': '203.0.113.5' } });
    expect(clientIp(req)).toBe('203.0.113.5');
  });

  it('returns "unknown" if header missing', () => {
    const req = new Request('https://x.com');
    expect(clientIp(req)).toBe('unknown');
  });
});

describe('RATE_LIMITS presets', () => {
  it('LOGIN: 5 attempts / 15min / 30min lockout', () => {
    expect(RATE_LIMITS.LOGIN.maxAttempts).toBe(5);
    expect(RATE_LIMITS.LOGIN.windowMs).toBe(15 * 60 * 1000);
    expect(RATE_LIMITS.LOGIN.lockoutMs).toBe(30 * 60 * 1000);
  });

  it('SIGNUP: 10 attempts / 1h (bumped from autoplan original 3 — too tight for dev + NAT)', () => {
    expect(RATE_LIMITS.SIGNUP.maxAttempts).toBe(10);
  });

  it('OAUTH_TOKEN: high frequency (100 / min) for active client', () => {
    expect(RATE_LIMITS.OAUTH_TOKEN.maxAttempts).toBe(100);
    expect(RATE_LIMITS.OAUTH_TOKEN.windowMs).toBe(60 * 1000);
  });
});
