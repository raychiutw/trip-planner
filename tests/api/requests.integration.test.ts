/**
 * Integration test — GET/POST /api/requests + PATCH /api/requests/:id
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockServiceAuth, mockContext, jsonRequest, seedTrip , callHandler } from './helpers';
import { onRequestGet, onRequestPost } from '../../functions/api/requests';
import { onRequestPatch } from '../../functions/api/requests/[id]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let requestId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-req' });
});

afterAll(disposeMiniflare);

describe('POST /api/requests', () => {
  it('建立請求 → 201', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', {
        tripId: 'trip-req',
        mode: 'trip-edit',
        message: '請幫我加一間餐廳',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as Record<string, unknown>;
    requestId = data.id as number;
    expect(data.status).toBe('open');
  });

  it('mode rip-out phase 2: response shape 不含 mode (migration 0049 DROP COLUMN)', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', {
        tripId: 'trip-req', message: '幫我推薦景點',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as Record<string, unknown>;
    expect(data).not.toHaveProperty('mode');
  });

  it('缺 message → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', {
        tripId: 'trip-req',
      }),
      env,
      auth: mockAuth(),
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/requests', 'POST', {
        tripId: 'trip-req', mode: 'trip-edit', message: 'hi',
      }),
      env,
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(401);
  });
});

describe('GET /api/requests', () => {
  it('列出請求', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/requests?tripId=trip-req'),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/requests?tripId=trip-req'),
      env,
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(401);
  });
});

describe('PATCH /api/requests/:id', () => {
  it('service token（companion scope）回覆請求 → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${requestId}`, 'PATCH', {
        reply: '已新增餐廳',
        status: 'completed',
      }),
      env,
      auth: mockServiceAuth(),
      params: { id: String(requestId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('completed');
  });

  it('sanitizeReply 過濾敏感內容', async () => {
    // 先建一個新請求
    await db.prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?)'
    ).bind('trip-req', 'test', 'user@test.com').run();
    const row = await db.prepare('SELECT id FROM trip_requests ORDER BY id DESC LIMIT 1').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${row!.id}`, 'PATCH', {
        reply: '請用 /api/trips 端點操作',
        status: 'completed',
      }),
      env,
      auth: mockServiceAuth(),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.reply).toBe('已處理您的請求。如有問題請直接聯繫行程主人。');
  });

  // v2.55.56: PATCH gate 放寬成 companion service token OR 對該 trip 有寫權的 user
  // （restrict_trip-scoped tp-request agent 回覆自己 trip 的請求；status/reply 也吃 trip scope）。
  it('trip owner（有寫權 user，無 companion scope）回覆自己 trip 的請求 → 200', async () => {
    // seedTrip 給 user@test.com owner role → hasWritePermission(trip-req) 為真
    await db.prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?)'
    ).bind('trip-req', 'owner 回覆測試', 'user@test.com').run();
    const row = await db.prepare(
      'SELECT id FROM trip_requests WHERE message = ? ORDER BY id DESC LIMIT 1'
    ).bind('owner 回覆測試').first<{ id: number }>();
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${row!.id}`, 'PATCH', { reply: '好的，已處理' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: String(row!.id) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
  });

  it('無寫權 user（非 companion、非該 trip 成員）→ 403', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${requestId}`, 'PATCH', { status: 'completed' }),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: String(requestId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });

  // v2.33.104 T-5：status 推進 monotonicity — 不可從 completed 回退到 open/processing
  describe('status monotonicity (T-5)', () => {
    let monoReqId: number;

    beforeAll(async () => {
      await db.prepare(
        'INSERT INTO trip_requests (trip_id, message, submitted_by) VALUES (?, ?, ?)'
      ).bind('trip-req', '監測 monotonicity', 'user@test.com').run();
      const row = await db.prepare(
        'SELECT id FROM trip_requests WHERE message = ? ORDER BY id DESC LIMIT 1'
      ).bind('監測 monotonicity').first<{ id: number }>();
      monoReqId = row!.id;
    });

    it('open → completed 允許', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'completed' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    });

    it('completed → open 拒絕 400', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'open' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      const resp = await callHandler(onRequestPatch, ctx);
      expect(resp.status).toBe(400);
      const data = await resp.json() as { error?: { message?: string } };
      expect(JSON.stringify(data)).toContain('不可從');
    });

    it('completed → processing 拒絕 400', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'processing' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
    });

    it('completed → failed 允許（failed 任何狀態都可標記）', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'failed' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      expect((await callHandler(onRequestPatch, ctx)).status).toBe(200);
    });

    it('未知 status value 拒絕 400', async () => {
      const ctx = mockContext({
        request: jsonRequest(`https://test.com/api/requests/${monoReqId}`, 'PATCH', { status: 'invalid' }),
        env,
        auth: mockServiceAuth(),
        params: { id: String(monoReqId) },
      });
      expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
    });
  });
});
