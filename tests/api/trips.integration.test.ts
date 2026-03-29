/**
 * Integration test — POST /api/trips + GET /api/trips
 * 用 Miniflare D1 直接呼叫 handler
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip } from './helpers';
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
      self_drive: 1,
      countries: 'JP',
    };
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', body),
      env,
      auth: mockAuth({ email: 'test@test.com' }),
    });
    const resp = await onRequestPost(ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as { ok: boolean; tripId: string; daysCreated: number };
    expect(data.ok).toBe(true);
    expect(data.tripId).toBe('okinawa-2026');
    expect(data.daysCreated).toBe(3);

    // 驗證 DB 狀態
    const trip = await db.prepare('SELECT * FROM trips WHERE id = ?').bind('okinawa-2026').first();
    expect(trip).not.toBeNull();
    expect((trip as Record<string, unknown>).self_drive).toBe(1);

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
    const resp = await onRequestPost(ctx);
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
    expect((await onRequestPost(ctx)).status).toBe(400);
  });

  it('endDate < startDate → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'x', name: 'x', owner: 'x', startDate: '2026-04-05', endDate: '2026-04-01',
      }),
      env,
      auth: mockAuth(),
    });
    expect((await onRequestPost(ctx)).status).toBe(400);
  });

  it('超過 30 天 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'long', name: 'long', owner: 'x', startDate: '2026-01-01', endDate: '2026-03-01',
      }),
      env,
      auth: mockAuth(),
    });
    expect((await onRequestPost(ctx)).status).toBe(400);
  });

  it('重複 tripId → 409', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'okinawa-2026', name: 'dup', owner: 'x', startDate: '2026-04-01', endDate: '2026-04-01',
      }),
      env,
      auth: mockAuth(),
    });
    expect((await onRequestPost(ctx)).status).toBe(409);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips', 'POST', {
        id: 'new', name: 'new', owner: 'x', startDate: '2026-04-01', endDate: '2026-04-01',
      }),
      env,
      // 不設定 auth
    });
    expect((await onRequestPost(ctx)).status).toBe(401);
  });
});

describe('GET /api/trips', () => {
  it('列出已發布行程（不含未發布）', async () => {
    await seedTrip(db, { id: 'published-trip', published: 1 });

    const ctx = mockContext({
      request: new Request('https://test.com/api/trips'),
      env,
    });
    const resp = await onRequestGet(ctx);
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
    const resp = await onRequestGet(ctx);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.some(t => t.published === 0)).toBe(true);
  });
});
