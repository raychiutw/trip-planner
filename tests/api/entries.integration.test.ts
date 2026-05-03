/**
 * Integration test — PATCH/DELETE /api/trips/:id/entries/:eid
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedEntry, getDayId , callHandler } from './helpers';
import { onRequestGet, onRequestPatch, onRequestDelete } from '../../functions/api/trips/[id]/entries/[eid]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let entryId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-e' });
  const dayId = await getDayId(db, 'trip-e', 1);
  entryId = await seedEntry(db, dayId, { title: 'Original' });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/entries/:eid', () => {
  it('回 { id, dayId, title } → 200', async () => {
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-e/entries/${entryId}`, { method: 'GET' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    // json() helper does deepCamel — server SELECT day_id 出去變 dayId。
    // 此 endpoint 跟既有 PATCH/DELETE 一樣走 json() camelCase 慣例。
    const body = await resp.json() as { id: number | bigint; dayId: number | bigint; title: string };
    expect(Number(body.id)).toBe(Number(entryId));
    expect(Number(body.dayId)).toBeGreaterThan(0);
    expect(body.title).toBeTruthy();
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-e/entries/${entryId}`, { method: 'GET' }),
      env,
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(401);
  });

  it('entry 不屬於該 trip → 404', async () => {
    await seedTrip(db, { id: 'trip-other' });
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-other/entries/${entryId}`, { method: 'GET' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-other', eid: String(entryId) },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(404);
  });

  it('entry id 不存在 → 404', async () => {
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-e/entries/999999`, { method: 'GET' }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: '999999' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(404);
  });
});

describe('PATCH /api/trips/:id/entries/:eid', () => {
  it('更新 entry → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        title: 'Updated',
        note: 'some note',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const row = await db.prepare('SELECT title, note FROM trip_entries WHERE id = ?').bind(entryId).first();
    expect((row as Record<string, unknown>).title).toBe('Updated');
    expect((row as Record<string, unknown>).note).toBe('some note');
  });

  it('缺 title → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', {
        title: '',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-e/entries/${entryId}`, 'PATCH', { title: 'x' }),
      env,
      params: { id: 'trip-e', eid: String(entryId) },
    });
    expect((await callHandler(onRequestPatch, ctx)).status).toBe(401);
  });
});

describe('DELETE /api/trips/:id/entries/:eid', () => {
  it('刪除 entry → 200', async () => {
    const dayId = await getDayId(db, 'trip-e', 2);
    const eid = await seedEntry(db, dayId, { title: 'ToDelete' });
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/trip-e/entries/${eid}`, { method: 'DELETE', headers: { Origin: 'https://trip-planner-dby.pages.dev' } }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-e', eid: String(eid) },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(200);
    const row = await db.prepare('SELECT * FROM trip_entries WHERE id = ?').bind(eid).first();
    expect(row).toBeNull();
  });
});
