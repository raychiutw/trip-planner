/**
 * Rate limit middleware — V2-P6 brute force defence
 *
 * 用 D1 rate_limit_buckets table（migration 0035）做 sliding window + lockout。
 *
 * Usage:
 *   const result = await checkRateLimit(env, `login:${ip}`, {
 *     maxAttempts: 5, windowMs: 15 * 60 * 1000, lockoutMs: 30 * 60 * 1000,
 *   });
 *   if (!result.ok) {
 *     return new Response(null, {
 *       status: 429,
 *       headers: { 'Retry-After': String(result.retryAfter) },
 *     });
 *   }
 *
 * 失敗時 caller 自己 increment（成功 login 不該 count；失敗 login 才 count）。
 * 用法 pattern:
 *   1. checkRateLimit() before processing
 *   2. 若 process 成功 → resetRateLimit() 清 counter
 *   3. 若 process 失敗 → bumpRateLimit() count++
 */
import type { D1Database } from '@cloudflare/workers-types';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

interface RateLimitRow {
  bucket_key: string;
  count: number;
  window_start: number;
  locked_until: number | null;
}

export interface RateLimitResult {
  /** True if not currently locked + count within limit */
  ok: boolean;
  /** Seconds until next attempt allowed (only when ok=false) */
  retryAfter?: number;
  /** Current count in window */
  count?: number;
}

/**
 * Check rate limit for given bucket key。**Doesn't increment** — caller decides
 * when to bump (typically on failed attempt only)。
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const row = await db
    .prepare('SELECT bucket_key, count, window_start, locked_until FROM rate_limit_buckets WHERE bucket_key = ?')
    .bind(key)
    .first<RateLimitRow>();

  if (!row) return { ok: true, count: 0 };

  // Locked?
  if (row.locked_until && row.locked_until > now) {
    return { ok: false, retryAfter: Math.ceil((row.locked_until - now) / 1000) };
  }

  // Window expired? (count 視為 0 — bump 時會 reset window)
  if (row.window_start + config.windowMs < now) {
    return { ok: true, count: 0 };
  }

  return { ok: true, count: row.count };
}

/**
 * Increment rate limit count + maybe lock if exceeded。Call after a failed attempt。
 */
export async function bumpRateLimit(
  db: D1Database,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const row = await db
    .prepare('SELECT bucket_key, count, window_start, locked_until FROM rate_limit_buckets WHERE bucket_key = ?')
    .bind(key)
    .first<RateLimitRow>();

  let newCount: number;
  let windowStart: number;

  if (!row || row.window_start + config.windowMs < now) {
    // New row or window expired — reset
    newCount = 1;
    windowStart = now;
  } else {
    newCount = row.count + 1;
    windowStart = row.window_start;
  }

  // Determine lock
  let lockedUntil: number | null = null;
  if (newCount > config.maxAttempts) {
    lockedUntil = now + config.lockoutMs;
  }

  // Upsert
  await db
    .prepare(
      `INSERT OR REPLACE INTO rate_limit_buckets (bucket_key, count, window_start, locked_until)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(key, newCount, windowStart, lockedUntil)
    .run();

  if (lockedUntil) {
    return { ok: false, retryAfter: Math.ceil((lockedUntil - now) / 1000), count: newCount };
  }
  return { ok: true, count: newCount };
}

/**
 * Reset counter on successful attempt — prevent legitimate user being locked
 * out from accumulated previous failures。
 */
export async function resetRateLimit(db: D1Database, key: string): Promise<void> {
  await db
    .prepare('DELETE FROM rate_limit_buckets WHERE bucket_key = ?')
    .bind(key)
    .run();
}

/**
 * Extract client IP from CF-Connecting-IP header (Cloudflare adds this on edge)。
 * Fallback to 'unknown' so all attempts in dev share a bucket。
 */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/** Common config presets */
export const RATE_LIMITS = {
  // Anti brute-force login: 5 attempts / 15min window, 30min lockout
  LOGIN: { maxAttempts: 5, windowMs: 15 * 60 * 1000, lockoutMs: 30 * 60 * 1000 },
  // Signup spam protection: 10 attempts / 1h window, 1h lockout.
  // (Was 3/h per autoplan; bumped — too tight for dev self-testing + shared NAT IP)
  SIGNUP: { maxAttempts: 10, windowMs: 60 * 60 * 1000, lockoutMs: 60 * 60 * 1000 },
  // Password reset abuse: 3 attempts / 1h window, 1h lockout
  FORGOT_PASSWORD: { maxAttempts: 3, windowMs: 60 * 60 * 1000, lockoutMs: 60 * 60 * 1000 },
  // OAuth token endpoint per-client: 100 attempts / minute, 5min lockout
  OAUTH_TOKEN: { maxAttempts: 100, windowMs: 60 * 1000, lockoutMs: 5 * 60 * 1000 },
  // Saved POI write per-user: 10 attempts / minute, no lockout (just deny burst)
  // 防 POI enumeration oracle attack — too-fast POSTs probe non-existent poiId 404s.
  SAVED_POIS_WRITE: { maxAttempts: 10, windowMs: 60 * 1000, lockoutMs: 0 },
} as const;
