/**
 * Integration test — GET/POST /api/trip-ideas + PATCH/DELETE /api/trip-ideas/:id
 *
 * 涵蓋：auth gate、permission 403、POI 404、promoted_to_entry_id 保留原 row、
 * archived_at filter、trip cascade delete、PATCH camelCase 欄位映射。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, seedPoi, seedEntry, getDayId, callHandler } from './helpers';
import { onRequestGet, onRequestPost } from '../../functions/api/trip-ideas';
import { onRequestPatch, onRequestDelete } from '../../functions/api/trip-ideas/[id]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
let poiId: number;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'idea-api-trip', owner: 'owner@test.com' });
  poiId = await seedPoi(db, { name: 'Idea Test POI' });
});

afterAll(disposeMiniflare);

describe('GET /api/trip-ideas', () => {
  it('owner 取回該 trip 的 ideas（by added_at DESC）', async () => {
    await db.prepare('INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?)').bind('idea-api-trip', 'First Idea').run();
    await db.prepare('INSERT INTO trip_ideas (trip_id, poi_id, title) VALUES (?, ?, ?)').bind('idea-api-trip', poiId, 'POI Idea').run();

    const ctx = mockContext({
      request: new Request('https://test.com/api/trip-ideas?tripId=idea-api-trip'),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<{ title: string; poiName: string | null }>;
    expect(data.length).toBeGreaterThanOrEqual(2);
    // POI JOIN 正確
    const poiIdea = data.find(d => d.title === 'POI Idea');
    expect(poiIdea?.poiName).toBe('Idea Test POI');
  });

  it('缺 tripId → 400', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trip-ideas'),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(400);
  });

  it('無 permission → 403', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trip-ideas?tripId=idea-api-trip'),
      env,
      auth: mockAuth({ email: 'outsider@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(403);
  });

  it('無 auth → 401', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trip-ideas?tripId=idea-api-trip'),
      env,
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(401);
  });

  it('archived_at IS NOT NULL 的不回傳', async () => {
    await db.prepare(
      "INSERT INTO trip_ideas (trip_id, title, archived_at) VALUES (?, ?, datetime('now'))",
    ).bind('idea-api-trip', 'Archived Idea').run();

    const ctx = mockContext({
      request: new Request('https://test.com/api/trip-ideas?tripId=idea-api-trip'),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    const data = await resp.json() as Array<{ title: string }>;
    expect(data.find(d => d.title === 'Archived Idea')).toBeUndefined();
  });
});

describe('POST /api/trip-ideas', () => {
  it('POI-based idea 成功 → 201', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trip-ideas', 'POST', {
        tripId: 'idea-api-trip',
        poiId,
        title: 'Visit POI',
        note: 'stop for lunch',
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as { id: number; tripId: string; poiId: number; title: string; addedBy: string };
    expect(data.tripId).toBe('idea-api-trip');
    expect(data.poiId).toBe(poiId);
    expect(data.addedBy).toBe('owner@test.com');
  });

  it('自由文字 idea（無 poiId）成功', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trip-ideas', 'POST', {
        tripId: 'idea-api-trip',
        title: 'Maybe check this out',
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
    const data = await resp.json() as { title: string; poiId: number | null };
    expect(data.title).toBe('Maybe check this out');
    expect(data.poiId).toBeNull();
  });

  it('trip 不存在 → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trip-ideas', 'POST', {
        tripId: 'no-such-trip',
        title: 'test',
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(404);
  });

  it('poiId 不存在 → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trip-ideas', 'POST', {
        tripId: 'idea-api-trip',
        poiId: 999999,
        title: 'test',
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(404);
  });

  it('無 permission → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trip-ideas', 'POST', {
        tripId: 'idea-api-trip',
        title: 'test',
      }),
      env,
      auth: mockAuth({ email: 'outsider@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(403);
  });

  it('缺 title → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trip-ideas', 'POST', {
        tripId: 'idea-api-trip',
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });
});

describe('PATCH /api/trip-ideas/:id', () => {
  it('更新 title + note', async () => {
    const row = await db.prepare(
      'INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?) RETURNING id',
    ).bind('idea-api-trip', 'Old Title').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trip-ideas/${row!.id}`, 'PATCH', {
        title: 'New Title',
        note: 'updated note',
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as { title: string; note: string };
    expect(data.title).toBe('New Title');
    expect(data.note).toBe('updated note');
  });

  it('設 promotedToEntryId 時 idea row 保留', async () => {
    const dayId = await getDayId(db, 'idea-api-trip', 1);
    const entryId = await seedEntry(db, dayId, { title: 'Promoted Entry Target' });
    const row = await db.prepare(
      'INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?) RETURNING id',
    ).bind('idea-api-trip', 'To Be Promoted').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trip-ideas/${row!.id}`, 'PATCH', {
        promotedToEntryId: entryId,
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as { promotedToEntryId: number; title: string };
    expect(data.promotedToEntryId).toBe(entryId);

    // Idea row 仍在（關鍵：PATCH 不 delete）
    const still = await db.prepare('SELECT title FROM trip_ideas WHERE id = ?').bind(row!.id).first<{ title: string }>();
    expect(still!.title).toBe('To Be Promoted');
  });

  it('設 archivedAt 後 GET 不回傳', async () => {
    const row = await db.prepare(
      'INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?) RETURNING id',
    ).bind('idea-api-trip', 'To Be Archived').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trip-ideas/${row!.id}`, 'PATCH', {
        archivedAt: new Date().toISOString(),
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
      params: { id: String(row!.id) },
    });
    await callHandler(onRequestPatch, ctx);

    const getCtx = mockContext({
      request: new Request('https://test.com/api/trip-ideas?tripId=idea-api-trip'),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const getResp = await callHandler(onRequestGet, getCtx);
    const data = await getResp.json() as Array<{ title: string }>;
    expect(data.find(d => d.title === 'To Be Archived')).toBeUndefined();
  });

  it('無 permission → 403', async () => {
    const row = await db.prepare(
      'INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?) RETURNING id',
    ).bind('idea-api-trip', 'Guarded').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trip-ideas/${row!.id}`, 'PATCH', { title: 'hack' }),
      env,
      auth: mockAuth({ email: 'outsider@test.com' }),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(403);
  });

  it('idea 不存在 → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trip-ideas/999999', 'PATCH', { title: 'x' }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
      params: { id: '999999' },
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(404);
  });
});

describe('DELETE /api/trip-ideas/:id', () => {
  it('hard delete 自己的 idea → 204', async () => {
    const row = await db.prepare(
      'INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?) RETURNING id',
    ).bind('idea-api-trip', 'To Be Deleted').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trip-ideas/${row!.id}`, 'DELETE'),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(204);

    const after = await db.prepare('SELECT id FROM trip_ideas WHERE id = ?').bind(row!.id).first();
    expect(after).toBeNull();
  });

  it('無 permission → 403', async () => {
    const row = await db.prepare(
      'INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?) RETURNING id',
    ).bind('idea-api-trip', 'Protected').first<{ id: number }>();

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trip-ideas/${row!.id}`, 'DELETE'),
      env,
      auth: mockAuth({ email: 'outsider@test.com' }),
      params: { id: String(row!.id) },
    });
    const resp = await callHandler(onRequestDelete, ctx);
    expect(resp.status).toBe(403);
  });
});

describe('FK cascade — trip_ideas', () => {
  it('trip 被 delete 時 ideas 自動清', async () => {
    await seedTrip(db, { id: 'cascade-idea-trip', owner: 'owner@test.com' });
    await db.prepare('INSERT INTO trip_ideas (trip_id, title) VALUES (?, ?)').bind('cascade-idea-trip', 'Soon Gone').run();

    await db.prepare('DELETE FROM trips WHERE id = ?').bind('cascade-idea-trip').run();

    const row = await db.prepare(
      'SELECT COUNT(*) AS c FROM trip_ideas WHERE trip_id = ?',
    ).bind('cascade-idea-trip').first<{ c: number }>();
    expect(row!.c).toBe(0);
  });
});
