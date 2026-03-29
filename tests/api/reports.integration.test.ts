/**
 * Integration test — POST /api/reports
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, jsonRequest, seedTrip, callHandler } from './helpers';
import { onRequestPost } from '../../functions/api/reports';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-report' });
});

afterAll(disposeMiniflare);

describe('POST /api/reports', () => {
  it('正常回報 → 201', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/reports', 'POST', {
        tripId: 'trip-report',
        url: 'https://example.com/trip/trip-report',
        errorCode: 'DATA_NOT_FOUND',
        errorMessage: '找不到這筆資料',
        userAgent: 'Mozilla/5.0',
        context: '{"dayNum":1}',
      }),
      env,
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);

    const row = await db.prepare('SELECT * FROM error_reports WHERE trip_id = ?').bind('trip-report').first();
    expect(row).not.toBeNull();
    expect((row as Record<string, unknown>).error_code).toBe('DATA_NOT_FOUND');
  });

  it('缺 tripId → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/reports', 'POST', {
        url: 'https://example.com',
      }),
      env,
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('蜜罐欄位 → 假裝成功但不存', async () => {
    const before = await db.prepare('SELECT COUNT(*) as c FROM error_reports').first<{ c: number }>();
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/reports', 'POST', {
        tripId: 'trip-report',
        website: 'http://spam.com',
      }),
      env,
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const after = await db.prepare('SELECT COUNT(*) as c FROM error_reports').first<{ c: number }>();
    expect(after!.c).toBe(before!.c);
  });

  it('30 秒內重複 → 429', async () => {
    const body = {
      tripId: 'trip-report',
      url: 'https://example.com/trip/trip-report/dup-test',
      errorCode: 'SYS_INTERNAL',
    };
    const ctx1 = mockContext({
      request: jsonRequest('https://test.com/api/reports', 'POST', body),
      env,
    });
    await callHandler(onRequestPost, ctx1);

    const ctx2 = mockContext({
      request: jsonRequest('https://test.com/api/reports', 'POST', body),
      env,
    });
    const resp = await callHandler(onRequestPost, ctx2);
    expect(resp.status).toBe(429);
  });
});
