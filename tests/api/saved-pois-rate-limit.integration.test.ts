/**
 * Integration test — POST /api/saved-pois rate limit (v2.21.0 MF1)
 *
 * 10 successful POSTs within 60s window allowed; 11th returns 429 + Retry-After.
 * Admin bypasses rate limit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedUser, callHandler } from './helpers';
import { onRequestPost } from '../../functions/api/saved-pois';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, 'rl-user@test.com');
  await seedUser(db, 'rl-admin@test.com');
  // Pre-seed 11 POIs so we can submit different poiIds for each request
  for (let i = 1; i <= 12; i++) {
    await db.prepare(
      `INSERT OR IGNORE INTO pois (id, name, address, type, lat, lng) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(1000 + i, `RL POI ${i}`, `addr ${i}`, 'attraction', 35.0, 139.0).run();
  }
});

afterAll(disposeMiniflare);

async function postSaved(email: string, poiId: number, isAdmin = false): Promise<Response> {
  const ctx = mockContext({
    request: new Request('https://test.com/api/saved-pois', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poiId }),
    }),
    env,
    auth: mockAuth({ email, isAdmin }),
  });
  return callHandler(onRequestPost, ctx);
}

describe('POST /api/saved-pois rate limit (MF1)', () => {
  it('allows 10 POSTs within window, denies 11th with 429 + Retry-After', async () => {
    // Reset bucket pre-test
    await db.prepare("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'saved-pois-post:%'").run();

    const results: number[] = [];
    for (let i = 1; i <= 11; i++) {
      const resp = await postSaved('rl-user@test.com', 1000 + i);
      results.push(resp.status);
      // Last response is the 11th — assert headers
      if (i === 11) {
        expect(resp.status).toBe(429);
        expect(resp.headers.get('Retry-After')).toBeTruthy();
        const body = await resp.json() as { error: string };
        expect(body.error).toBe('RATE_LIMITED');
      }
    }
    // First 10 should be 201 (created)
    expect(results.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(results[10]).toBe(429);
  });

  it('admin bypasses rate limit', async () => {
    await db.prepare("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'saved-pois-post:%'").run();
    // Admin POSTs 11+ in same window — all should succeed (no rate limit applied)
    for (let i = 1; i <= 11; i++) {
      const resp = await postSaved('rl-admin@test.com', 1000 + i, true);
      // 201 (created) or 409 (already saved by previous test) — never 429
      expect([201, 409]).toContain(resp.status);
    }
  });
});
