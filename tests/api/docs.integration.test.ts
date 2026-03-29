/**
 * Integration test — GET/PUT /api/trips/:id/docs/:type
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip , callHandler } from './helpers';
import { onRequestGet, onRequestPut } from '../../functions/api/trips/[id]/docs/[type]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-docs' });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/docs/:type', () => {
  it('不存在 → 404', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-docs/docs/flights'),
      env,
      params: { id: 'trip-docs', type: 'flights' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(404);
  });
});

describe('PUT /api/trips/:id/docs/:type', () => {
  it('建立/更新文件 → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-docs/docs/flights', 'PUT', {
        content: '# Flight Info\nCI123',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-docs', type: 'flights' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(200);

    // 驗證可以讀取
    const getCtx = mockContext({
      request: new Request('https://test.com/api/trips/trip-docs/docs/flights'),
      env,
      params: { id: 'trip-docs', type: 'flights' },
    });
    const getResp = await callHandler(onRequestGet, getCtx);
    expect(getResp.status).toBe(200);
    const data = await getResp.json() as Record<string, unknown>;
    expect(data.content).toContain('CI123');
  });

  it('無效 type → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-docs/docs/invalid', 'PUT', { content: 'x' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-docs', type: 'invalid' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-docs/docs/flights', 'PUT', { content: 'x' }),
      env,
      params: { id: 'trip-docs', type: 'flights' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(401);
  });
});
