/**
 * Integration test — PATCH/DELETE /api/trips/:id/entries/:eid
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedEntry, getDayId , callHandler } from './helpers';
import { onRequestPatch, onRequestDelete } from '../../functions/api/trips/[id]/entries/[eid]';
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
