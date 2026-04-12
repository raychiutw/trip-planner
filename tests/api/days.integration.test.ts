/**
 * Integration test — GET /api/trips/:id/days
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, seedTrip , callHandler } from './helpers';
import { onRequestGet } from '../../functions/api/trips/[id]/days';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-days', days: 5 });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/days', () => {
  it('列出所有天', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-days/days'),
      env,
      params: { id: 'trip-days' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<Record<string, unknown>>;
    expect(data).toHaveLength(5);
    expect(data[0].dayNum).toBe(1);
    expect(data[4].dayNum).toBe(5);
  });

  it('不存在的行程 → 空陣列', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/nope/days'),
      env,
      params: { id: 'nope' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<unknown>;
    expect(data).toHaveLength(0);
  });
});
