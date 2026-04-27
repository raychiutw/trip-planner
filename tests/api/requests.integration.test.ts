/**
 * Integration test — GET/POST /api/requests + PATCH /api/requests/:id
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip , callHandler } from './helpers';
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

  it('缺 mode → 201（自動 default trip-plan，tp-request skill 自動判別意圖）', async () => {
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
    expect(data.mode).toBe('trip-plan');
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
  it('admin 回覆請求 → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${requestId}`, 'PATCH', {
        reply: '已新增餐廳',
        status: 'completed',
      }),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true, isServiceToken: true }),
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
      'INSERT INTO trip_requests (trip_id, mode, message, submitted_by) VALUES (?, ?, ?, ?)'
    ).bind('trip-req', 'trip-edit', 'test', 'user@test.com').run();
    const row = await db.prepare('SELECT id FROM trip_requests ORDER BY id DESC LIMIT 1').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${row!.id}`, 'PATCH', {
        reply: '請用 /api/trips 端點操作',
        status: 'completed',
      }),
      env,
      auth: mockAuth({ email: 'admin@test.com', isAdmin: true, isServiceToken: true }),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.reply).toBe('已處理您的請求。如有問題請直接聯繫行程主人。');
  });

  it('非 admin → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/requests/${requestId}`, 'PATCH', { status: 'completed' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: String(requestId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(403);
  });
});
