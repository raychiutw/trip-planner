/**
 * Integration test — POST /api/trips + GET /api/trips
 * 用 Miniflare D1 直接呼叫 handler
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, callHandler } from './helpers';
import { onRequestPost, onRequestGet } from '../../functions/api/trips';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
});

afterAll(disposeMiniflare);

describe('POST /api/trips', () => {
  it('建立行程 → 201 + 正確天數', async () => {
    const body = {
      id: 'okinawa-2026',
      name: 'okinawa-2026',
      owner: 'test@test.com',
      startDate: '2026-04-01',
      endDate: '2026-04-03',
      title: '沖繩三日遊',
      // Migration 0045 dropped self_drive — replaced by default_travel_mode (Q1).
      default_travel_mode: 'driving',
      countries: 'JP',
    };
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', body),
      env,
      auth: mockAuth({ email: 'test@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as { ok: boolean; tripId: string; daysCreated: number };
    expect(data.ok).toBe(true);
    expect(data.tripId).toBe('okinawa-2026');
    expect(data.daysCreated).toBe(3);

    // 驗證 DB 狀態
    const trip = await db.prepare('SELECT * FROM trips WHERE id = ?').bind('okinawa-2026').first();
    expect(trip).not.toBeNull();
    expect((trip as Record<string, unknown>).default_travel_mode).toBe('driving');

    const days = await db.prepare('SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_num').bind('okinawa-2026').all();
    expect(days.results).toHaveLength(3);

    const perm = await db.prepare('SELECT * FROM trip_permissions WHERE trip_id = ?').bind('okinawa-2026').first();
    expect(perm).not.toBeNull();
    expect((perm as Record<string, unknown>).email).toBe('test@test.com');
  });

  it('缺欄位 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', { id: 'x' }),
      env,
      auth: mockAuth(),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('tripId 格式錯誤（大寫）→ 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'BAD_ID', name: 'x', owner: 'x', startDate: '2026-01-01', endDate: '2026-01-01',
      }),
      env,
      auth: mockAuth(),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('endDate < startDate → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'x', name: 'x', owner: 'x', startDate: '2026-04-05', endDate: '2026-04-01',
      }),
      env,
      auth: mockAuth(),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('超過 30 天 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'long', name: 'long', owner: 'x', startDate: '2026-01-01', endDate: '2026-03-01',
      }),
      env,
      auth: mockAuth(),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('重複 tripId → 409', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'okinawa-2026', name: 'dup', owner: 'x', startDate: '2026-04-01', endDate: '2026-04-01',
      }),
      env,
      auth: mockAuth(),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(409);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'new', name: 'new', owner: 'x', startDate: '2026-04-01', endDate: '2026-04-01',
      }),
      env,
      // 不設定 auth
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(401);
  });

  // 2026-05-02 follow-up: enum validation defense-in-depth
  it('POST default_travel_mode 非 enum 值 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'bad-mode-trip', name: 'x', startDate: '2026-04-01', endDate: '2026-04-01',
        default_travel_mode: 'teleport',
      }),
      env,
      auth: mockAuth({ email: 'test@test.com' }),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('POST lang 非 enum 值 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'bad-lang-trip', name: 'x', startDate: '2026-04-01', endDate: '2026-04-01',
        lang: 'esperanto',
      }),
      env,
      auth: mockAuth({ email: 'test@test.com' }),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  // /review-fix: hostile destinations[] payload
  it('destinations 數量超過上限 (>30) → 400', async () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => ({ name: `d${i}` }));
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'too-many-dests', name: 'x', startDate: '2026-04-01', endDate: '2026-04-01',
        destinations: tooMany,
      }),
      env,
      auth: mockAuth({ email: 'test@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
    // Trip should not have been created
    const trip = await db.prepare('SELECT * FROM trips WHERE id = ?').bind('too-many-dests').first();
    expect(trip).toBeNull();
  });
});

describe('GET /api/trips', () => {
  it('列出已發布行程（不含未發布）', async () => {
    await seedTrip(db, { id: 'published-trip', published: 1 });

    const ctx = mockContext({
      request: new Request('https://test.com/api/trips'),
      env,
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.every(t => t.published === 1)).toBe(true);
  });

  it('admin + all=1 → 含未發布行程', async () => {
    await seedTrip(db, { id: 'draft-trip', owner: 'admin@test.com', published: 0 });

    const ctx = mockContext({
      request: new Request('https://test.com/api/trips?all=1'),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.some(t => t.published === 0)).toBe(true);
  });
});
