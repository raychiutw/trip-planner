/**
 * Integration test — POST /api/places/autocomplete
 *
 * v2.33.104 T-8: 涵蓋 validation + 429 rate-limit + GOOGLE_MAPS_API_KEY 缺失。
 *
 * autocompletePlaces 真正打 Google API 需要 vi.mock —— 這個檔只測 endpoint
 * 自身決策（auth / validation / rate-limit / kill switch），不測 Google client。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, callHandler } from './helpers';

vi.mock('../../src/server/maps/google-client', () => ({
  autocompletePlaces: vi.fn().mockResolvedValue([
    { placeId: 'ChIJ_test', primaryText: 'Test Place', secondaryText: 'City' },
  ]),
}));

const { onRequestPost } = await import('../../functions/api/places/autocomplete');

let db: D1Database;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(disposeMiniflare);

beforeEach(async () => {
  // 重置 rate-limit bucket 避免 test 互相影響
  await db.prepare("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE 'places-autocomplete:%'").run();
});

describe('POST /api/places/autocomplete (T-8)', () => {
  it('未認證 → 401', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/places/autocomplete', 'POST', {
        q: 'taipei', sessionToken: 'sess-1',
      }),
      env,
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(401);
  });

  it('q < 2 字元 → 400', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/places/autocomplete', 'POST', {
        q: 'a', sessionToken: 'sess-1',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com', userId: 'user-1' }),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('q > 200 字元 → 400', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/places/autocomplete', 'POST', {
        q: 'a'.repeat(201), sessionToken: 'sess-1',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com', userId: 'user-1' }),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('missing sessionToken → 400', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/places/autocomplete', 'POST', {
        q: 'taipei',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com', userId: 'user-1' }),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('sessionToken > 128 字元 → 400', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/places/autocomplete', 'POST', {
        q: 'taipei', sessionToken: 'x'.repeat(129),
      }),
      env,
      auth: mockAuth({ email: 'user@test.com', userId: 'user-1' }),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('regionCode > 8 字元 → 400', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/places/autocomplete', 'POST', {
        q: 'taipei', sessionToken: 'sess-1', regionCode: 'TWWWWWWWW',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com', userId: 'user-1' }),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('GOOGLE_MAPS_API_KEY 缺失 → 502', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = '';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/places/autocomplete', 'POST', {
        q: 'taipei', sessionToken: 'sess-1',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com', userId: 'user-1' }),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(502);
  });

  it('happy path → 200 + predictions', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/places/autocomplete', 'POST', {
        q: 'taipei', sessionToken: 'sess-1',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com', userId: 'user-1' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as { predictions: Array<Record<string, unknown>> };
    expect(data.predictions).toHaveLength(1);
    expect(data.predictions[0].placeId).toBe('ChIJ_test');
  });

  it('rate-limit 達 1000 → 429 + Retry-After header', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    // 直接污染 D1 bucket 到 lockout 狀態
    await db.prepare(
      `INSERT INTO rate_limit_buckets (bucket_key, count, window_start, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(bucket_key) DO UPDATE SET count = excluded.count, locked_until = excluded.locked_until`,
    ).bind(
      'places-autocomplete:user-user-rate',
      1001,
      Date.now(),
      Date.now() + 3600 * 1000,
    ).run();

    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/places/autocomplete', 'POST', {
        q: 'taipei', sessionToken: 'sess-1',
      }),
      env,
      auth: mockAuth({ email: 'user-rate@test.com', userId: 'user-rate' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(429);
    expect(resp.headers.get('Retry-After')).toBeTruthy();
    const data = await resp.json() as { error?: { code?: string } };
    expect(data.error?.code).toBe('RATE_LIMITED');
  });
});
